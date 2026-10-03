# Faza 5 - kolejki i zadania cykliczne (BullMQ)

Przeczytaj najpierw `AGENTS.md`. Zakłada ukończone Fazy 1-4, 3b, 6 i 6b (opinie i migawki - zbudowane przed tą fazą).

## Cel

Wszystko, co dziś leci w tle przez `after()` z `next/server`, przenosimy do kolejki z osobnym procesem workera. Powód nie jest teoretyczny - w obecnym kodzie są dwa realne błędy, które ta faza zamyka:

1. **Zaplanowane posty nigdy się nie publikują.** Klient może wybrać datę publikacji (`DateField` w akceptacji posta), cel dostaje status `scheduled` - i na tym się kończy, bo nic nie przegląda zaplanowanych celów. To jest błąd widoczny dla klienta już teraz
2. **Zadanie przerwane restartem aplikacji wisi na `running` na zawsze.** `after()` ginie razem z procesem. Skany pozycji mają zabezpieczenie (`RANK_STALE_RUNNING_MS`), ale `content_generation_runs` i `gbp_audit_runs` nie mają - a UI Publikacji odpytuje o status co 2 sekundy, więc przy zawieszonym zadaniu kręci się bez końca

## Stan repo, na którym budujesz

Tło jest dziś uruchamiane w pięciu miejscach, każde oznaczone `// TODO: ... (Faza 5)`:

| Miejsce | Co uruchamia | Funkcja robiąca pracę |
|---|---|---|
| `features/publikacje/actions.ts` (akceptacja posta) | publikacja celów `queued` | `publishTargets(itemId)` z `features/publikacje/publish.ts` |
| `features/publikacje/generate.ts` | generowanie tematów / postów | `runContentGeneration(runId)` |
| `features/wizytowka/audit.ts` | analiza wizytówki | runner audytu |
| `features/wizytowka/rank/actions.ts` + `run-scan.ts` | skan pozycji | `runScan(scanId)` |
| `lib/integrations/gbp/client.ts` (`scheduleGbpAnalysis`) | analiza po podpięciu wizytówki | deleguje do `audit.ts` |
| moduł Opinii (Faza 6) | synchronizacja opinii, szkice AI, odpowiedzi automatyczne | `runReviewSync(runId)` i generowanie szkiców |
| `features/wizytowka/snapshots/read.ts` (Faza 6b) | odświeżenie migawki w tle | `runGbpSnapshotRefresh()` z `snapshots/refresh.ts` |

Uwaga do `audit.ts`: poza statycznym importem `requireOwnedProfile` ma też **dynamiczny** `import("@/lib/session")` (okolice `getActiveProfile`). Test grafu importów nie śledzi dynamicznych importów, więc ten przypadek musisz usunąć ręcznie z kodu wykonywanego przez worker - test go nie wyłapie.

**Przesuwanie i anulowanie zaplanowanych postów już istnieje** (`rescheduleContent`, `cancelScheduledContent` w `features/publikacje/actions.ts`, dymek w kalendarzu i na liście). Klient może dziś przesunąć albo anulować post, który i tak by się nie opublikował. Mechanizm z punktu 4 (baza jako źródło prawdy) obsługuje to bez dodatkowej pracy - nie twórz osobnych opóźnionych zadań, które trzeba by przy tych akcjach przesuwać lub usuwać.

Tabela to stan z chwili pisania tej fazy. **Zanim zaczniesz, wyszukaj w repo wszystkie `after(` i wszystkie `TODO` z "Faza 5"** - jeśli któreś miejsce nie jest w tabeli, obejmij je tak samo i wypisz w planie.

Funkcje robiące pracę są w większości już pisane jako "bez sesji, bezpieczne dla workera" (komentarze w `publish.ts`, `generate.ts`, `run-scan.ts`). **Wyjątek: `features/wizytowka/audit.ts` importuje `requireOwnedProfile` z `lib/session.ts`**, który woła `auth()` - w workerze nie ma sesji, więc to wywołanie rzuci błąd. Sprawdzenie własności profilu musi zostać w akcji, która zleca zadanie; funkcja wykonawcza dostaje już zweryfikowane id. To samo sprawdź w każdej funkcji, którą przenosisz: w kodzie wykonywanym przez worker nie może być nic z `lib/session.ts`, `lib/auth.ts`, `next/headers`, `next/cache` ani `after()`.

Dla każdego rodzaju pracy wydziel funkcję wykonawczą do osobnego pliku bez tych importów, jeśli dziś siedzi w pliku, który je ma. Worker importuje tylko te pliki.

**Wzorce z Fazy 6, które masz już w repo - użyj ich, nie wymyślaj od nowa:**

- Token Google bez sesji: `lib/integrations/gbp/token.ts` (`getGbpAccessTokenForProfile(profile)`). `audit.ts` ma przejść na niego zamiast na ścieżkę przez `access.ts` / `lib/session.ts`
- Test grafu importów: `features/opinie/no-session-imports.test.ts` sprawdza statycznie, że funkcje wykonawcze opinii nie importują (bezpośrednio ani pośrednio) `next/*`, `lib/session` ani `lib/auth`. **Uogólnij go** tak, żeby punktem wejścia był `worker/index.ts` - wtedy jeden test pilnuje całego kodu workera, łącznie z tym, co ktoś doda w przyszłości
- Przejęcie z blokadą i progiem porzucenia: `publishReviewReply()` w `features/opinie/publish-reply.ts` (`publishStatus = 'publishing'` + `PUBLISH_STALE_MS`) i jeden `running` na profil przez częściowy indeks unikalny w `review_sync_runs`. Publikacja postów (punkt 3) ma działać tym samym wzorcem
- Wstrzykiwane zależności do testów: `features/opinie/review-deps.ts` + `test-support.ts` (baza lokalna, atrapa Google). Testy kolejek pisz w tym samym stylu

## Zakres

**1. Infrastruktura**

- Redis: lokalnie `docker run -p 6379:6379 redis:7`, produkcyjnie serwis w Coolify. Odkomentuj `REDIS_URL` w `.env.example`
- `lib/queue/` - jedno miejsce z połączeniem i definicjami kolejek. Reszta aplikacji woła funkcje typu `enqueuePublish(...)`, nigdy `new Queue()` bezpośrednio - ta sama zasada co `lib/ai/` i `lib/storage/`
- Połączenie dla workera wymaga `maxRetriesPerRequest: null` (wymóg BullMQ dla blokujących poleceń Redis) - bez tego worker rzuca błędem przy starcie
- Worker jako osobny proces: `worker/index.ts`, skrypt `npm run worker` przez `tsx` (już używany w projekcie do testów), z obsługą aliasu `@/`. W Coolify drugi serwis z tego samego repo, z tymi samymi zmiennymi środowiskowymi
- Łagodne zamknięcie: na `SIGTERM` worker kończy bieżące zadanie i zamyka połączenia (`worker.close()`), zamiast ginąć w połowie publikacji

**2. Kolejki - tylko te, które mają dziś realną pracę**

- `publish` - publikacja celów posta
- `content-generation` - tematy i posty
- `gbp-audit` - analiza wizytówki
- `rank-scan` - skany pozycji
- `reviews` - synchronizacja opinii, szkice AI i publikacja odpowiedzi
- `maintenance` - zadania porządkowe i cykliczne (punkty 4-6 i 6a)

**Nie twórz kolejki powiadomień ani żadnej innej "pod przyszłą fazę"** - ta sama zasada co z tabelami w Fazie 1. Faza 7 doda swoją kolejkę, kiedy będzie miała co do niej wkładać.

**3. Publikacja - bez duplikatów w Google**

To jest najważniejszy punkt tej fazy. Google nie ma dla postów klucza idempotencji: ponowienie zadania, które post już utworzyło, tworzy **drugi identyczny post na wizytówce klienta**. Mechanizm retry z BullMQ zastosowany naiwnie zrobi dokładnie to.

- Dodaj status `publishing` do `content_target_status`. Worker **przejmuje** cel atomowo: `UPDATE ... SET status = 'publishing' WHERE id = ? AND status IN ('queued', 'scheduled') RETURNING` - jeśli nic nie wróciło, ktoś inny już go przejął i zadanie kończy się bez akcji
- Zaktualizuj `features/publikacje/content-status.ts`, żeby `publishing` na poziomie celu dawało wyświetlany status "publikowanie"
- Ponawiaj **tylko** błędy przejściowe, co do których wiadomo, że posta nie utworzyły: odpowiedź Google 5xx, 429 albo 408. Wtedy cel wraca na `queued` i zadanie idzie do ponowienia
- Pozostałe odpowiedzi 4xx (400, 403, 404 itd.) to od razu `failed` z treścią błędu, bez ponowień - kolejna próba da ten sam wynik
- **Nie ponawiaj automatycznie**, gdy wynik jest nieznany - timeout albo zerwane połączenie już po wysłaniu żądania. Post mógł powstać. Cel dostaje `failed` z komunikatem "Nie wiemy, czy post został opublikowany - sprawdź wizytówkę przed ponowieniem", a ponowienie zostaje decyzją klienta
- Wygasła autoryzacja: `failed` od razu, bez ponowień (istniejący `isGbpUnauthenticatedError()`), bo kolejna próba z tym samym tokenem nic nie zmieni
- Ponowienia: 3 próby, odstęp wykładniczy. Po wyczerpaniu - `failed` z ostatnim błędem w `content_targets.error`

**4. Zaplanowane posty - baza jest źródłem prawdy**

- **Nie twórz osobnego opóźnionego zadania BullMQ dla każdego zaplanowanego celu.** Klient może zmienić datę albo odrzucić post, a wtedy zadanie w Redis i rekord w bazie się rozjeżdżają - post wychodzi o starej godzinie albo mimo odrzucenia
- Zamiast tego zadanie cykliczne co minutę w kolejce `maintenance`: wybiera cele `scheduled` z `scheduled_at <= now()` i dla każdego dodaje zadanie do kolejki `publish`. Przejęcie z punktu 3 chroni przed podwójną publikacją, gdy dwa przebiegi nałożą się w czasie
- Dokładność do minuty jest wystarczająca dla postów na wizytówce
- Zmiana daty albo odrzucenie posta to wtedy zwykły zapis w bazie, bez sprzątania w Redis

**5. Sprzątanie zawieszonych zadań**

Zadanie cykliczne w `maintenance` (co 5 minut): rekordy ze statusem `running` starsze niż próg przechodzą na `failed` z komunikatem, że zadanie zostało przerwane.

- Obejmuje `content_generation_runs`, `gbp_audit_runs` i `rank_scans`
- Progi w jednym pliku konfiguracyjnym obok `lib/config/rank-limits.ts`; dla skanów użyj istniejącego `RANK_STALE_RUNNING_MS`, nie definiuj go drugi raz
- Cele w stanie `publishing` starsze niż próg traktuj jak wynik nieznany z punktu 3: `failed` z tym samym komunikatem, bez automatycznego ponowienia
- Dzięki temu odpytywanie z UI Publikacji zawsze kiedyś dostaje stan końcowy

**6. Skany cykliczne**

- Zadanie cykliczne w `maintenance` wybiera frazy, których ostatni skan jest starszy niż `RANK_AUTO_SCAN_INTERVAL_DAYS`, i zleca je do `rank-scan`
- Wartość domyślna: **30 dni**. To świadomie ostrożne ustawienie: przy obecnych limitach (`RANK_MAX_KEYWORDS = 10`, siatka 5×5) jeden profil to do 260 zapytań na cykl. Częstotliwość ma być jedną stałą w `lib/config/rank-limits.ts`, żeby jej zmiana nie wymagała zmian w kodzie
- Skanuj automatycznie tylko frazy, dla których klient wykonał choć jeden skan ręcznie. Fraza dodana i nigdy nie sprawdzona nie powinna generować kosztów
- **Limit skanów egzekwuje worker, nie tylko UI** - przed wykonaniem skanu wołaj tę samą funkcję limitów, której używa przycisk "Skanuj teraz" (`features/wizytowka/rank/limits.ts`). Skan ponad limit kończy się bez wywołania ScrapingDog
- Ręczny "Skanuj teraz" też idzie przez kolejkę `rank-scan`, a nie przez `after()`

**6a. Opinie cyklicznie**

- Zadanie cykliczne w `maintenance` co 30 minut zleca synchronizację opinii dla profili z podpiętą wizytówką i `review_mode = 'auto'`. Pozostałe podpięte profile - co 3 godziny (stała w `lib/config/`). Faza 7 skróci ten cykl, gdy dojdą powiadomienia o negatywnych opiniach. Od tego momentu tryb automatyczny odpowiada bez czekania, aż ktoś otworzy `/opinie` - zmień tekst pod przełącznikiem trybu w `/opinie/ustawienia`, który dziś mówi, że odpowiedzi idą "przy każdym sprawdzeniu"
- Synchronizacja przy wejściu na `/opinie` i przycisk "Odśwież" zostają, tylko zlecają zadanie do kolejki zamiast `after()`
- Publikacja odpowiedzi może być ponawiana bez obaw o duplikaty: `PUT .../reply` w Google nadpisuje odpowiedź, a nie tworzy drugiej. To inaczej niż przy postach z punktu 3 - nie przenoś tamtych ograniczeń ponowień na odpowiedzi
- Reguły trybu automatycznego (ocena 1-2, opinie sprzed włączenia trybu) muszą działać identycznie w workerze - testy z `test:reviews` przechodzą bez zmian
- Sprzątanie zawieszonych zadań z punktu 5 obejmuje też `review_sync_runs`

**6b. Migawki Google**

- Odświeżenie migawki idzie przez kolejkę zamiast `after()`, z tą samą blokadą `refreshing_since`
- Próg świeżości z `lib/config/freshness.ts` (np. 10 minut dla lokalizacji) dotyczy wejścia klienta: stara migawka pokazuje się od razu i odświeża w tle (punkt 2 z Fazy 6b) - to zostaje bez zmian. Odświeżanie z wyprzedzeniem **nie** goni tego progu
- Zadanie cykliczne w `maintenance` pilnuje tylko, żeby przy pierwszym wejściu dane nie były sprzed wielu godzin. Odświeża migawki profili aktywnych w ostatnich 7 dniach (logowanie albo wejście w panel):
  - lokalizacja: co 3 godziny w godzinach 6-22 (ok. 6 razy na dobę na profil)
  - zdjęcia: raz na dobę rano (6:00)
  - statystyki: raz na dobę o 3:00 (Google i tak aktualizuje je raz dziennie)
- Częstotliwości jako stałe w `lib/config/freshness.ts`
- Profile nieaktywne nie są odświeżane cyklicznie - nie ma sensu zużywać limitów Google na wizytówki, których nikt nie ogląda

**7. Podpięcie istniejącego kodu**

- Każde z pięciu miejsc z tabeli zamień na `enqueue...()` z `lib/queue/`. Po tej fazie `after()` nie występuje w repo w ogóle - weryfikacja: `grep -rn "after(" app features lib` nie zwraca wywołań
- Usuń komentarze `// TODO: ... (Faza 5)` z miejsc, które zostały przepięte
- Kształt odpowiedzi akcji i stany w UI się nie zmieniają - UI dalej odpytuje o status w bazie. Nie przebudowuj odpytywania na WebSockety ani SSE w tej fazie

**8. Podgląd kolejek**

- Bull Board (`@bull-board/api` z adapterem dla Next.js App Router albo osobny mały serwer w procesie workera - wybierz i uzasadnij w planie) pod `/admin/kolejki`
- **Dostęp wyłącznie przez `requireStaff()`** z `lib/session.ts`, 404 dla pozostałych - tak samo jak `/admin` z Fazy 2b. Nie wiąż dostępu z rolą `owner`: `owner` to rola **klienta** w jego koncie, a Bull Board pokazuje zadania wszystkich klientów, łącznie z treścią ich postów

## Kryteria akceptacji

- **Zaplanowany post publikuje się sam**: zaakceptuj post z datą za 3 minuty, nie dotykaj aplikacji, post pojawia się na wizytówce w ciągu minuty od wyznaczonej godziny
- Zmiana daty zaplanowanego posta na późniejszą (istniejący dymek terminu) powoduje publikację o nowej godzinie, nie o starej
- Anulowany zaplanowany post nie publikuje się o pierwotnej godzinie
- Lista punktów wejścia w teście grafu importów obejmuje cały kod workera (najlepiej jako jeden punkt `worker/index.ts`), a `audit.ts` w ścieżce workera nie ma ani statycznego, ani dynamicznego importu `lib/session`
- **Brak duplikatów**: zabij worker (`kill -9`) w trakcie publikacji. Po restarcie na wizytówce jest co najwyżej jeden post, a cel ma status `published` albo `failed` z komunikatem o nieznanym wyniku - nigdy dwa posty
- Wymuszony błąd 5xx (np. atrapa w teście) daje 3 próby, a po nich `failed` z treścią błędu; wygasła autoryzacja i pozostałe 4xx (poza 408 i 429) dają `failed` od razu, bez ponowień
- Zabicie workera w trakcie generowania tematów: po czasie progu przebieg ma status `failed`, a UI Publikacji przestaje odpytywać i pokazuje komunikat, zamiast kręcić się bez końca
- Analiza wizytówki uruchomiona z workera działa - kod wykonywany przez worker nie woła niczego z `lib/session.ts`
- Skan cykliczny nie uruchamia się dla frazy bez żadnego ręcznego skanu i nie przekracza limitu planu (test: ustaw limit na 1, wykonaj skan ręczny, skan cykliczny nie wywołuje ScrapingDog)
- Nowa 5-gwiazdkowa opinia na profilu w trybie automatycznym dostaje odpowiedź w ciągu 30 minut bez otwierania panelu; nowa 1-gwiazdkowa nie dostaje
- `grep -rn "after(" app features lib` nie zwraca wywołań `after()`
- `/admin/kolejki` zwraca 404 dla zwykłego konta, łącznie z właścicielem konta klienta
- Worker startuje przez `npm run worker`, a `SIGTERM` kończy go bez przerwania bieżącego zadania
- Uogólniony test grafu importów z punktem wejścia `worker/index.ts` przechodzi - kod workera nie sięga do `next/*`, `lib/session` ani `lib/auth`
- Testy: `npm run test:content`, `npm run test:rank` i `npm run test:reviews` przechodzą; dodaj `test:queue` z testami przejęcia celu (dwa równoległe przejęcia tego samego celu - tylko jedno wygrywa) i klasyfikacji błędów publikacji (co ponawiać, czego nie)
- `npm run lint`, `npx tsc --noEmit`, `npm run lint:css`, `npm run format:check` bez nowych błędów
