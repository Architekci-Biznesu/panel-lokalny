# Faza 3 - Wizytówka Google (edycja + optymalizacja AI)

Przeczytaj najpierw `AGENTS.md`. Zakłada ukończone Fazy 1-2b (auth, multi-tenancy, tryb admina, onboarding z podłączoną wizytówką i `profile_briefs`).

To pierwszy moduł, który realny klient zobaczy po onboardingu i pierwszy, który pokazuje wartość produktu. Wzorzec akceptacji propozycji AI zbudowany tutaj będzie potem reużyty w pętli contentowej (Faza 4) i w opiniach (Faza 6) - zrób go porządnie.

Makieta (moduł "Wizytówka Google", pięć zakładek): https://claude.ai/artifact/Wn2ZrSXrAJ64WWwh28aFTY

## Cel

Klient wchodzi w zakładkę Wizytówka i od razu widzi: co w jego wizytówce jest niekompletne, co AI proponuje poprawić i czego AI nie wie, a on musi potwierdzić. Każdą propozycję przyjmuje, poprawia albo odrzuca pojedynczo, a przyjęta zmiana trafia od razu do Google.

## Warstwa AI - już istnieje

Warstwa providerów AI (`lib/ai/`) powstała w Fazie 2, bo tam generuje się brief w onboardingu. **Nie buduj jej drugi raz i nie twórz drugiej ścieżki wywołań do OpenAI.** Jeśli brakuje w niej metody potrzebnej tutaj (np. dedykowanej do optymalizacji pól wizytówki), dołóż ją do istniejącego interfejsu `TextProvider`. Zasada z `AGENTS.md` obowiązuje dalej: nic poza `lib/ai/` nie importuje z pakietu `openai`.

## Mapa API - z czego dokładnie korzystasz

Stare "Google My Business API" zostało rozbite na rodzinę osobnych API, każde z własnym hostem. To nie jest jedno `mybusiness.googleapis.com` - pomyłka w hoście to pierwszy błąd, na jaki się natkniesz. Wszystkie wymagają scope `https://www.googleapis.com/auth/business.manage`.

**Business Information API** - host `mybusinessbusinessinformation.googleapis.com`, tu siedzi cała edycja wizytówki:

| Co robisz | Wywołanie |
|---|---|
| Lista lokalizacji konta | `GET /v1/{parent=accounts/*}/locations` - **`readMask` jest obowiązkowy**, bez niego dostajesz błąd; `pageSize` max 100 |
| Odczyt jednej lokalizacji | `GET /v1/locations/{locationId}` (też z `readMask`) |
| Zapis dowolnego pola | `PATCH /v1/locations/{locationId}?updateMask=...` |
| Walidacja bez zapisu | ten sam `patch` z `validateOnly=true` |
| Zmiany zrobione przez Google | `GET /v1/locations/{locationId}:getGoogleUpdated` |
| Atrybuty lokalizacji - odczyt | `GET /v1/locations/{locationId}:getAttributes` |
| Atrybuty lokalizacji - zapis | `PATCH /v1/locations/{locationId}:updateAttributes` |
| Atrybuty **dostępne dla kategorii** | `GET /v1/attributes?categoryName=categories/{id}&regionCode=PL&languageCode=pl` |
| Lista kategorii | `GET /v1/categories?regionCode=PL&languageCode=pl&view=...` |
| Kategorie po ID (i ich `serviceTypes`) | `GET /v1/categories:batchGet` |

**Account Management API** - host `mybusinessaccountmanagement.googleapis.com`: `GET /v1/accounts` zwraca konta, do których użytkownik ma dostęp (format `accounts/{id}`). To jest pierwsze wywołanie po OAuth, zanim zapytasz o lokalizacje.

**Business Profile Performance API** - **inny host: `businessprofileperformance.googleapis.com`**. Statystyk nie ma ani w Business Information, ani w v4. Dwie metody: `GET /v1/{name=locations/*}:fetchMultiDailyMetricsTimeSeries` (wiele metryk w jednym wywołaniu - używaj tej) albo `GET /v1/{name=locations/*}:getDailyMetricsTimeSeries` (jedna metryka). Zakres dat przekazywany jako rozbite parametry: `dailyRange.start_date.year/month/day` i to samo dla `end_date`. Dostępne metryki `DailyMetric`: `BUSINESS_IMPRESSIONS_DESKTOP_MAPS`, `BUSINESS_IMPRESSIONS_DESKTOP_SEARCH`, `BUSINESS_IMPRESSIONS_MOBILE_MAPS`, `BUSINESS_IMPRESSIONS_MOBILE_SEARCH`, `BUSINESS_CONVERSATIONS`, `BUSINESS_DIRECTION_REQUESTS`, `CALL_CLICKS`, `WEBSITE_CLICKS`, `BUSINESS_BOOKINGS`, `BUSINESS_FOOD_ORDERS`, `BUSINESS_FOOD_MENU_CLICKS`. Do zakładki Raporty bierz wyświetlenia (cztery warianty mapy/szukajki × desktop/mobile), `CALL_CLICKS`, `WEBSITE_CLICKS`, `BUSINESS_DIRECTION_REQUESTS`.

**Legacy v4** (`mybusiness.googleapis.com/v4`) - część funkcji nigdy nie doczekała się wersji v1 i nadal żyje tylko tutaj: `accounts.locations.reviews` (opinie - potrzebne w Fazie 6), `accounts.locations.media` (zdjęcia), `accounts.locations.localPosts` (posty - Faza 4), `accounts.locations.questions` (pytania i odpowiedzi). Stare `reportInsights` z v4 jest wyłączone od 2023 - statystyki wyłącznie przez Performance API.

**Produkty ("Edytuj ofertę" w panelu Google) - nie mają API, ale jest obejście, które w praktyce wystarcza**

Product Editor jest wyłącznie w interfejsie Google. Potwierdzone z trzech stron: pełna lista usług w pakiecie `google.mybusiness.v4` zawiera tylko `FoodMenuService`, `LocalPosts`, `Media` i `Reviews`; rodzina API v1 nie ma zasobu produktów; własny przewodnik Google o dodawaniu oferty przez API opisuje wyłącznie usługi. **Nie szukaj endpointu do produktów - nie istnieje.**

Ale: Google przewiduje Product Editor dla firm, które "mają lokalny sklep sprzedający towary fizyczne". Firmy usługowe - a takie są prawie wszystkie profile w tym panelu (mechanik, beauty, cukiernia, agencja) - mają do tego **Usługi**, czyli `serviceItems`, i te mają pełne API. Jeśli klient trzyma dziś swoją ofertę w produktach, to zwykle dlatego, że nie wiedział o usługach, a nie dlatego, że sprzedaje towar.

Wniosek dla tej fazy: **optymalizujemy Usługi, nie Produkty**. Produkty zostają nietknięte i niepokazane w panelu - nie buduj dla nich pola, atrapy ani "przygotowania na przyszłość".

**Usługi - dwa ograniczenia, które muszą wejść do implementacji:**
- **Sprawdź `canModifyServiceList` w `metadata` lokalizacji przed jakąkolwiek próbą zapisu.** Nie każda lokalizacja może edytować listę usług; przy braku uprawnienia pokaż to klientowi jako komunikat, nie wysyłaj żądania skazanego na błąd
- **Aktualizacja pojedynczej usługi nie jest obsługiwana - każdy zapis podmienia CAŁĄ listę `serviceItems`.** To znaczy, że akceptacja jednej propozycji AI wymaga wysłania kompletnej listy z tą jedną zmianą. Jeśli wyślesz tylko nowy element, wyczyścisz wszystkie pozostałe usługi klienta. To jest najłatwiejszy sposób na utratę danych w tym module - zbuduj to jako "odczytaj aktualną listę, zmodyfikuj w pamięci, wyślij całość"

**Pozostałe rzeczy, których przez API zrobić nie można:**
- `name` (identyfikator lokalizacji), `languageCode` i `metadata` są niezmienne - nie próbuj ich patchować
- `latlng` jest zapisywalne tylko dla zatwierdzonych przez Google klientów - dla nas praktycznie tylko do odczytu
- Posty ofertowe (`LocalPostOffer` z kodem rabatowym i linkiem) istnieją w v4 `localPosts`, ale to czasowa promocja, nie katalog - temat Fazy 4, nie tej

**Pola zapisywalne przez `locations.patch`** (użyj ich jako listy pól edytowalnych w UI): `title`, `categories`, `profile`, `serviceItems`, `regularHours`, `specialHours`, `moreHours`, `phoneNumbers`, `websiteUri`, `storefrontAddress`, `serviceArea`, `openInfo`, `labels`.

**Usługi (`serviceItems`) - dwa różne typy, nie mieszaj ich:**
- `structuredServiceItem` - z `serviceTypeId` pochodzącym z `serviceTypes` danej kategorii (pobierasz przez `categories:batchGet`). To są usługi, które Google zna i rozumie - preferuj je, gdy pasują
- `freeFormServiceItem` - własna nazwa usługi, wymaga `category` i `label`. Tu wchodzą usługi, których w słowniku Google nie ma
- `serviceTypeId` musi pasować do kategorii - kombinacje nie są dowolne, AI nie może ich zmyślać
- Limity: nazwa usługi do 140 znaków, opis do 250 znaków. Walidację długości zrób w Zodzie po stronie serwera, nie licz na to, że Google zwróci czytelny błąd

## Zakres

**1. Schemat bazy**

```
gbp_suggestions   id, profile_id, field, current_value text, suggested_value text,
                  rationale text, risk (none|high), status (pending|accepted|rejected|superseded),
                  accepted_at, risk_ack_at, created_at

gbp_audit_runs    id, profile_id, status (running|done|failed), error text,
                  started_at, finished_at
```

- `field` to identyfikator pola wizytówki, którego dotyczy propozycja: `title`, `description`, `primary_category`, `additional_categories`, `services`
- `risk = 'high'` ustawiane wyłącznie dla `title` (patrz punkt 5) - jedyne pole, przy którym akceptacja wymaga potwierdzenia ryzyka
- `superseded` - propozycja zastąpiona nowszą przy ponownej analizie; nie kasuj starych rekordów, potrzebne do sprawdzenia, czy czegoś już nie proponowaliśmy i nie zostało odrzucone
- Atrybutów i braków faktograficznych **nie zapisuj jako propozycji** - liczone są na bieżąco z danych GBP (punkty 6 i 7)

**2. Analiza - kiedy się uruchamia**
- Pierwsze uruchomienie: **automatycznie na końcu onboardingu**, zaraz po utworzeniu profilu z podłączoną wizytówką. Cel jest taki, żeby zanim klient doklika się do zakładki, propozycje już czekały
- Jeśli klient wejdzie szybciej niż analiza się skończy (`gbp_audit_runs.status = 'running'`) - zakładka pokazuje stan "Analizujemy Twoją wizytówkę" zamiast pustych pól, i odświeża się po zakończeniu
- Ręczne ponowienie: przycisk "Przeanalizuj ponownie" w nagłówku zakładki
- Po zapisaniu zmienionego briefu (punkt 9) panel proponuje ponowną analizę - to jest domknięcie pętli "propozycje mi nie pasują → poprawiam kontekst → generuję od nowa"
- W tej fazie analiza jest wywołaniem synchronicznym z widocznym stanem ładowania. Zostaw komentarz `// TODO: przenieść do kolejki BullMQ (Faza 5)` - cyklicznych analiz jeszcze nie ma, to świadoma decyzja, nie brak

**3. Dane wejściowe do analizy**

Do providera AI przekazujesz komplet, nie pojedyncze pole:
- `profile_briefs` tego profilu (usługi, ton, grupa docelowa, uwagi) - to jest deklaracja właściciela
- najnowszy `company_context` ze źródłem `website` (scrape strony) i `gbp` (snapshot wizytówki)
- aktualną treść wizytówki pobraną z GBP na żywo
- kategorię główną i dodatkowe
- **listę atrybutów dostępnych dla tej kategorii, pobraną z Google** (`GET /v1/attributes?categoryName=...`) - AI nie może wymyślać atrybutów, tylko wybierać z tego, co Google akceptuje dla tej kategorii
- **listę kategorii i ich `serviceTypes`** (`categories.list` / `categories:batchGet`) - to samo ograniczenie: kategorie i typy usług pochodzą ze słownika Google, nie z modelu
- listę wcześniejszych propozycji odrzuconych przez klienta - żeby nie proponować w kółko tego samego, co już odrzucił

**4. Trzy rodzaje sygnałów - to jest sedno tego modułu**

Wizualnie w makiecie wygląda to podobnie, ale semantycznie są to trzy różne rzeczy i **nie wolno ich mieszać w jednym mechanizmie**:

- **Propozycja treści** (opis, usługi, kategorie dodatkowe, nazwa) - AI potrafi to napisać i ocenić. Klient akceptuje, poprawia ołówkiem albo odrzuca. To jedyny rodzaj, który trafia do `gbp_suggestions`. **Pusta lista usług to też propozycja, nie brak** - jeśli `serviceItems` jest puste (typowe u klientów, którzy trzymają ofertę w Produktach), AI proponuje komplet usług z briefu i strony, a nie komunikat "uzupełnij usługi"
- **Fakt do potwierdzenia** (atrybuty) - AI nie wie, czy lokal ma podjazd dla wózków ani czy przyjmuje karty. Może tylko pokazać, które atrybuty dostępne dla tej kategorii są niewypełnione, i poprosić właściciela o zaznaczenie tych, które są prawdą. **Nigdy nie akceptuj tego hurtem ani automatycznie** - to deklaracje o firmie składane w Google, nieprawdziwa psuje zaufanie i naraża klienta
- **Brak do uzupełnienia poza panelem** (brak zdjęć, brak strony www, niezweryfikowana wizytówka, puste godziny) - nie ma czego proponować, jest tylko sygnał "zrób to" z jednozdaniowym uzasadnieniem, dlaczego to ma znaczenie

Każdy z trzech rodzajów ma mieć wyraźnie inne oznaczenie wizualne. Klient musi rozpoznać w pół sekundy, czy patrzy na tekst do zaakceptowania, pytanie o fakt, czy zadanie dla siebie.

**5. Nazwa firmy - propozycja SEO z ostrzeżeniem o ryzyku**

Decyzja produktowa: AI **proponuje** nazwę zoptymalizowaną pod wyszukiwanie (np. dodanie głównej usługi i dzielnicy), ale klient dostaje jasne ostrzeżenie i zmienia na własną odpowiedzialność.

- Propozycja nazwy ma `risk = 'high'` i **inne oznaczenie wizualne niż pozostałe propozycje** - wariant ostrzegawczy (`--destructive` lub pomarańczowy akcent), nie ta sama plakietka co przy opisie. Inaczej klient przeklika ją tym samym ruchem co pięć poprzednich sugestii i nie zauważy, że podjął decyzję innej wagi
- Akceptacja jest **dwuetapowa**: kliknięcie "Akceptuj" otwiera potwierdzenie z konkretną treścią ryzyka, nie ogólnikiem. Treść ma mówić wprost: wytyczne Google wymagają nazwy faktycznie używanej przez firmę, dodawanie słów kluczowych i lokalizacji jest ich naruszeniem, w razie zgłoszenia lub audytu grozi zawieszeniem wizytówki razem z opiniami, a odzyskanie trwa tygodniami
- W potwierdzeniu pytanie kontrolne: **czy tak brzmi nazwa na Twoim szyldzie lub materiałach firmowych?** Jeśli tak, ryzyko realnie maleje, bo to jest nazwa używana w świecie rzeczywistym. Przy okazji klient dowiaduje się, że może tę nazwę zalegalizować, zmieniając szyld
- Przycisk potwierdzający: "Rozumiem ryzyko, zmień nazwę". Bez checkboxów i akapitów prawniczych - jedno dodatkowe kliknięcie
- Zapisz `risk_ack_at` przy akceptacji - ślad, że ostrzeżenie zostało pokazane i przyjęte
- **Nazwa jest na stałe wyłączona z jakiegokolwiek trybu automatycznego**, gdyby taki kiedyś doszedł do tego modułu

**6. Kategorie**

Kategoria ma większy wpływ na to, w jakich wynikach pokazuje się klient, niż cała reszta treści razem wzięta - dlatego AI ją proponuje, a nie tylko wyświetla.

- **Kategorie dodatkowe**: AI proponuje swobodnie, na podstawie briefu i strony (np. cukiernia sprzedająca kawę na miejscu → propozycja "Kawiarnia"). Zwykła propozycja, zwykła akceptacja
- **Kategoria główna**: propozycja zmiany tylko z wyraźnym wyjaśnieniem konsekwencji - przestawia firmę w zupełnie inne wyniki wyszukiwania i w rzadkich przypadkach potrafi wywołać ponowną weryfikację wizytówki. Nie podawaj jej jako zwykłej podpowiedzi obok innych
- Obie muszą pochodzić z listy kategorii Google, nie z wyobraźni modelu - pobierz dostępne kategorie z API i każ AI wybierać z niej

**7. Zakładki i pola do edycji**

Pięć zakładek jak w makiecie. Wszystkie pola edytowalne wprost (ołówek przy wierszu), zapis przez GBP Management API `locations.patch` z poprawnym `updateMask` - nigdy nie wysyłaj całego obiektu lokalizacji.

- **Informacje**: nazwa, kategoria główna, kategorie dodatkowe, opis (`profile.description`), data otwarcia (`openInfo`), usługi (`serviceItems`). To tutaj siedzi większość propozycji AI. **Produktów nie ma** - nie mają API (patrz mapa API wyżej). Oferta klienta optymalizowana jest jako Usługi, nie Produkty; nie buduj dla produktów ani pola, ani atrapy
- **Kontakt i lokalizacja**: telefon, witryna, profile społecznościowe (tyle, ile API udostępnia), adres, obsługiwany obszar
- **Godziny i atrybuty**: godziny standardowe i niestandardowe (święta, wyjątki) oraz siatka atrybutów - dostępny zestaw pobierasz z `GET /v1/attributes?categoryName=...&regionCode=PL`, aktualne wartości przez `locations:getAttributes`, zapis przez `locations:updateAttributes` (osobne wywołanie, NIE przez `locations.patch`). Zestaw nigdy nie zaszyty w kodzie. Niewypełnione atrybuty pokazane jako fakty do potwierdzenia (punkt 4)
- **NAP i katalogi**: lista wpisów w katalogach zewnętrznych - realizuje je zespół agencji, klient tylko widzi listę i ma przycisk "Dokup dodatkowe wpisy NAP". Na MVP przycisk zgłasza zainteresowanie (rekord w bazie plus powiadomienie do agencji), nie jest podłączony do płatności - Stripe jest poza MVP
- **Raporty**: karty KPI ze statystykami z Performance API przez `fetchMultiDailyMetricsTimeSeries` - wyświetlenia (mapy i szukajka, desktop i mobile), `CALL_CLICKS`, `WEBSITE_CLICKS`, `BUSINESS_DIRECTION_REQUESTS`. **Mapa pozycji lokalnych NIE wchodzi do tej fazy** - to osobny system skanowania, robimy go w Fazie 3b. Zostaw zakładkę bez mapy, nie buduj atrapy
- Funkcję pobierającą statystyki napisz osobno w `lib/integrations/gbp/`, nie wprost w komponencie - ten sam odczyt będzie reużyty na pulpicie w Fazie 7

**8. Podsumowanie kompletności**
- Nad zakładkami pasek podsumowania: ile pól wypełnionych, ile propozycji czeka na decyzję, ile braków faktograficznych do potwierdzenia, kiedy była ostatnia analiza
- Liczone na bieżąco z aktualnych danych GBP i `gbp_suggestions`, nie zapisywane jako osobna tabela - zawsze świeże, zero synchronizacji

**9. Edytor briefu** (`/ustawienia/kontekst`)
- Formularz edycji `profile_briefs` tego profilu - **pełny zestaw pól**, nie tylko te cztery z onboardingu:
  - wypełnione w onboardingu przez AI: usługi, ton komunikacji, grupa docelowa, wyróżniki
  - puste po onboardingu, bo AI ich nie zgadnie: **obszar działania** (miasta/dzielnice, nie tylko adres z GBP), **czego unikać w komunikacji**, **czego nie robimy** (usługi poza zakresem)
  - plus adres strony i uwagi własne
- Pola puste oznacz jako opcjonalne, ale przy każdym daj jedno zdanie, po co jest - klient sam nie domyśli się, że "czego unikać" to najważniejsze pole w całym briefie
- **"Czego unikać" wypełnia się samo w trakcie używania.** Przy odrzuceniu propozycji AI (punkt 10) pokaż jedno pole "dlaczego?" - wpisaną odpowiedź dopisz do `avoid` w briefie tego profilu. To jedyny moment, w którym klient naprawdę wie, co chce wykluczyć, i jest gotów to napisać. Bez tego mechanizmu pole zostanie puste na zawsze
- React Hook Form + Zod, walidacja też po stronie serwera
- Po zapisaniu panel proponuje ponowną analizę wizytówki (punkt 2)
- W module Wizytówki, przy liście propozycji, link prowadzący tutaj - w treści coś w rodzaju "Propozycje nie pasują do tego, czym się zajmujesz? Zaktualizuj kontekst firmy". To jest moment, w którym klient jest najbliżej zrozumienia, że problem siedzi w kontekście, a nie w samej propozycji
- Historii zmian briefu nie rób - `updated_at` wystarcza

**10. Akceptacja propozycji**
- Akceptacja wysyła zmianę **od razu** do Google (`locations.patch`), ustawia `status = 'accepted'` i `accepted_at`. Bez stanu "zaakceptowane, ale nieopublikowane"
- Odrzucenie ustawia `status = 'rejected'` - propozycja znika z widoku i nie wraca przy kolejnej analizie w tej samej formie
- Po odrzuceniu pokaż jedno, opcjonalne pole "dlaczego?" - treść dopisz do `profile_briefs.avoid` (punkt 9). Nie blokuj odrzucenia brakiem odpowiedzi
- Ołówek pozwala poprawić treść przed akceptacją; zapisywana jest wersja po poprawce klienta, nie oryginalna propozycja AI
- Błąd z API Google przy zapisie pokazany klientowi wprost, z treścią błędu - propozycja zostaje `pending`, nie udawaj, że się udało

## Kryteria akceptacji

- Po ukończeniu onboardingu z podłączoną wizytówką analiza startuje automatycznie, a wejście w zakładkę przed jej końcem pokazuje stan "Analizujemy", nie pustą stronę
- Zakładka pokazuje realne dane z podłączonej lokalizacji GBP, nie placeholdery
- Edycja dowolnego pola zapisuje się w Google i po odświeżeniu strony widać nową wartość pobraną z API (nie tylko z lokalnej bazy)
- `locations.patch` jest wywoływany z `updateMask` ograniczonym do zmienianych pól
- Atrybuty zapisują się przez `locations:updateAttributes`, nie przez `locations.patch` - sprawdzalne w logach wywołań
- `accounts.locations.list` jest wołane z `readMask` (bez niego Google zwraca błąd) - nie ma w kodzie wywołania bez tego parametru
- Usługi zapisane jako `structuredServiceItem` mają `serviceTypeId` z `serviceTypes` kategorii tego profilu, a nie wymyślony; usługi spoza słownika idą jako `freeFormServiceItem`
- Nazwa usługi dłuższa niż 140 znaków i opis dłuższy niż 250 są odrzucane przez walidację Zod po stronie serwera, zanim polecą do Google
- W repo nie ma żadnego kodu dotyczącego produktów GBP - to świadomie poza zakresem, bo nie mają API; oferta idzie przez `serviceItems`
- Przed zapisem usług sprawdzany jest `canModifyServiceList`, a brak uprawnienia pokazywany jako komunikat zamiast nieudanego żądania
- **Test utraty danych**: profil z trzema usługami, akceptacja propozycji AI dla jednej z nich - po zapisie w Google nadal są trzy usługi (zmieniona plus dwie nietknięte), nie jedna. To jest najważniejszy test w tej fazie
- Zaakceptowana propozycja opisu faktycznie zmienia opis w Google, sprawdzalne w Profilu Firmy w Google poza panelem
- Propozycja nazwy ma inne oznaczenie wizualne niż pozostałe, jej akceptacja wymaga dodatkowego potwierdzenia z treścią ryzyka, a po akceptacji rekord ma wypełnione `risk_ack_at`
- Atrybutów nie da się zaakceptować hurtem - każdy wymaga osobnego zaznaczenia przez klienta
- Siatka atrybutów dla profilu z inną kategorią pokazuje inny zestaw - pobrany z `attributes.list`, nie z listy zaszytej w kodzie
- Odrzucona propozycja nie wraca w tej samej formie po kliknięciu "Przeanalizuj ponownie"
- Zmiana briefu w `/ustawienia/kontekst` i ponowna analiza dają propozycje odpowiadające nowej treści briefu
- Edytor briefu pokazuje wszystkie pola z `profile_briefs`, w tym te niewypełnione w onboardingu
- Odrzucenie propozycji z podaniem powodu dopisuje go do `avoid`, a kolejna analiza uwzględnia tę treść
- Zakładka Raporty pokazuje statystyki z GBP Performance API i **nie zawiera mapy pozycji** ani jej atrapy
- Żaden plik poza `lib/ai/` nie importuje z pakietu `openai` (weryfikacja: wyszukaj `from 'openai'` w repo)
- UI bez kafelków w kafelku, zgodny z tokenami z AGENTS.md
