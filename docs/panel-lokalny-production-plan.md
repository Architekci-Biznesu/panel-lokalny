# Panel Lokalny - plan produkcyjny

Dokument bazowy do budowy aplikacji. Łączy: teze produktu i zakres MVP, model danych, strukturę aplikacji (na podstawie makiety), stack technologiczny z wersjami oraz status integracji zewnętrznych.

Powiązane materiały:
- Makieta klikalna (UI): https://claude.ai/artifact/Wn2ZrSXrAJ64WWwh28aFTY

---

## 1. Teza produktu

Samoobsługowy SaaS zastępujący całą ręczną obsługę klienta, jaką dziś świadczy agencja Architekci Biznesu - nie tylko content i publikację, ale każdy powtarzalny element pracy pracownika przy koncie klienta: pisanie postów i blogów, optymalizację wizytówki Google (nazwa, opis, usługi, kategorie), odpowiadanie na opinie i komentarze. Wszystko, co dziś pracownik researchuje/przygotowuje i wysyła klientowi do akceptacji, w produkcie generuje AI - klient akceptuje, edytuje przez chat lub odrzuca (albo, tam gdzie sam tak zdecyduje, włącza pełny automat bez własnego udziału). Zero człowieka po stronie agencji w całym tym procesie obsługi (poza supportem błędów aplikacji) - stąd niższa cena niż obecna usługa z obsługą.

Budowane od startu jako samodzielny SaaS na rynek zewnętrzny. Dystrybucja: płatne reklamy + lejek webinarowy, nie sieć franczyzowa - franczyza nie jest kanałem sprzedaży tego produktu.

Zależność blokująca start testów/sprzedaży: nagranie webinaru ("jak zarządzać firmą lokalną w 2026") jako część lejka.

## 2. Rdzeń MVP: pętla contentowa

1. **Onboarding klienta** - klient podaje tylko adres strony (albo krótki opis, jeśli strony nie ma), a AI pisze na tej podstawie brief: usługi, ton komunikacji, grupa docelowa. Klient brief zatwierdza lub poprawia, nie wypełnia formularza. Potem opcjonalnie podłącza wizytówkę Google, z której pobieramy opis, usługi, zdjęcia i NAP
2. **AI proponuje temat** posta/bloga na podstawie kontekstu firmy i planu wydawniczego
3. **AI generuje treść** (tekst + grafika, gpt-image do grafik)
4. **Klient przegląda** w widoku "do akceptacji" (inbox)
5. **Klient akceptuje / edytuje przez chat / odrzuca** - bez formularzy, edycja rozmową z AI
6. **Publikacja** wg planu wydawniczego na wybrane kanały: GBP i blog na stronie w MVP; Facebook i Instagram poza MVP (architektura kanałów przygotowana pod nie od początku - patrz sekcja 3)

Ta sama logika dotyczy **odpowiadania na opinie** - dwa tryby do wyboru przez klienta:
- **tryb z akceptacją** - AI proponuje odpowiedź, klient zatwierdza lub edytuje przed publikacją
- **tryb pełnego automatu** - AI odpowiada samodzielnie, z wyjątkiem opinii 1-2 gwiazdkowych, które zawsze trafiają do trybu z akceptacją niezależnie od wybranego trybu

## 3. Zakres modułów MVP

**Strona WWW**
- budowana przez zespół Architekci Biznesu (AI-assisted po stronie zespołu, nie self-serve generator dla klienta)
- architektura pozwalająca na: (a) edycję treści przez AI/inline editor po stronie klienta, (b) automatyczną publikację blogów z panelu
- pełny AI-chat editor struktury strony (nie tylko treści, ale sekcje/layout)
- analityka ruchu - podstawowa (wyświetlenia, źródła), heatmapa poza MVP
- backlinki - realizuje pracownik agencji, klient widzi listę w panelu, może dokupić dodatkowe

**Wizytówka Google** *(Faza 3 - pierwszy moduł, który klient widzi po onboardingu)*
- pełna edycja pól wizytówki z zapisem do Google (`locations.patch`): informacje, kontakt, lokalizacja, godziny, atrybuty
- optymalizacja generowana przez AI (opis, usługi, kategorie dodatkowe) - akceptacja/edycja/odrzucenie przy polu, zmiana leci do Google od razu po akceptacji
- **produkty wypadają z zakresu**: Google nie udostępnia dla nich żadnego API (Product Editor jest tylko w interfejsie Google), więc panel ich nie edytuje - wcześniejsze wzmianki o optymalizacji produktów przez AI są nieaktualne
- **nazwa pod SEO**: AI ją proponuje, ale z dwuetapowym ostrzeżeniem - dodawanie słów kluczowych i lokalizacji do nazwy narusza wytyczne Google i grozi zawieszeniem wizytówki. Świadoma decyzja produktowa: klient zmienia na własną odpowiedzialność, panel zapisuje potwierdzenie przyjęcia ryzyka
- atrybuty traktowane osobno od treści - AI nie wie, czy lokal ma podjazd dla wózków, więc pokazuje niewypełnione atrybuty dostępne dla kategorii jako fakty do potwierdzenia przez właściciela, nigdy do akceptacji hurtem
- NAP - realizuje pracownik agencji, klient widzi listę w panelu, może dokupić dodatkowe
- mapa pozycji lokalnych (siatka punktów, ScrapingDog) - Faza 3b, osobno od edycji wizytówki

**Publikacja i komunikacja (w MVP: GBP; Facebook + Instagram poza MVP)**
- posting - jeden composer, jedna treść na wszystkie podpięte kanały
- planowanie/social calendar - prosty harmonogram
- zarządzanie opiniami/komentarzami - z jednego miejsca dla wszystkich kanałów
- **W MVP realnie działa tylko kanał GBP.** Facebook i Instagram (Meta Graph API) przechodzą poza MVP - ale wyłącznie jako implementacja, nie jako decyzja architektoniczna: adapter kanałów, selektor kanałów w composerze, kolumna/filtr kanału w opiniach i historii publikacji są budowane od początku jako wielokanałowe, z Meta widocznym w UI jako kanał niepodłączony. Dodanie Meta ma być dopisaniem implementacji istniejącego interfejsu, nie przebudową tych ekranów

**Dashboard + CRM**
- dashboard: dane wyłącznie ze strony i GBP (ruch, publikacje, statystyki)
- CRM: kanban z automatycznym wpadaniem leadów z formularza strony
- email/SMS automation przy nowym leadzie

**Kampanie wysyłkowe do bazy klientów**
- SMS/e-mail (jednorazowe i wieloetapowe sekwencje follow-up) + trackowane linki/kody QR, w tym opcjonalna bramka gwiazdek do opinii - patrz sekcja 3.1
- w zakresie MVP (przeniesione z "poza MVP" - priorytet podniesiony, buduje się zaraz po Fazie 7, przed płatnościami) - `cursor/faza-08-kampanie-wysylkowe.md`

**Poza MVP - priorytet zaraz po MVP**
- **Kanały Meta (Facebook + Instagram)** - publikacja postów i pobieranie opinii/komentarzy przez Meta Graph API, razem z App Review (Advanced Access). Wymaga tylko dopisania implementacji adaptera kanału i ekranu połączenia w Ustawieniach - reszta UI (composer, inbox opinii, historia) jest już wielokanałowa
- statystyki słów kluczowych (Senuto API)
- heatmapa ruchu na stronie (podstawowa analityka - wyświetlenia, źródła - zostaje w MVP, heatmapa nie)
- **Płatności (Stripe)** - self-serve billing per profil; do czasu wdrożenia rozliczenia idą poza panelem, ręcznie - patrz `cursor/faza-10-platnosci.md`

### 3.1 Kampanie wysyłkowe do bazy klientów, w tym bramka opinii (w zakresie MVP)

Nazwa modułu w UI i w routingu to **Kampanie wysyłkowe** / `kampanie-wysylkowe` (wcześniej roboczo "Bramka opinii" - zmieniono, bo moduł obejmuje też promocje/wysyłki niezwiązane z opiniami, samo "Bramka opinii" było za wąskie; routing/identyfikator widoku zmienione razem z etykietą). Nazwa pliku fazy Cursora (`cursor/faza-08-kampanie-wysylkowe.md`) zostaje bez zmian z przyczyn historycznych - to plik dokumentacji, nie wpływa na UI ani URL-e.

Osobny moduł, niezależny od CRM (osobna tabela kontaktów, nie leady z pipeline'u sprzedażowego z sekcji 3/CRM) - klient panelu buduje własną bazę **klientów końcowych** (nie leadów) i wysyła do niej SMS/e-mail: prośby o opinię i promocje. Wspólny mechanizm trackowanych linków i kodów QR obsługuje oba przypadki użycia.

**1. Baza kontaktów** (`contacts`)
- `id, profile_id, name, phone, email, source (manual|import), consent_marketing (bool), consent_at, created_at`
- Dodawanie ręczne + import CSV (mapowanie kolumn przy imporcie, bez automatycznego zgadywania)
- Formularz dodania ręcznego ma dodatkowe, opcjonalne pole **"Zapisz do sekwencji"** (lista aktywnych sekwencji) - zaznaczenie od razu po dodaniu kontaktu tworzy dla niego jeden `sequence_enrollment`, bez wybierania grupy. To główna droga dla przypadku "po każdej wizycie dopisz klienta do przypomnień o opinię" - patrz punkt 6
- Zgoda marketingowa (`consent_marketing`) obowiązkowe pole przy dodawaniu/imporcie - to odpowiedzialność właściciela profilu (ma zgody od swoich klientów), panel tylko wymusza pole i datę, nie weryfikuje jej prawdziwości
- Link/mechanizm rezygnacji (`unsubscribe`) w każdej wysłanej wiadomości - wymóg prawny (RODO + ustawa o świadczeniu usług drogą elektroniczną dla e-maila, Prawo telekomunikacyjne dla SMS), nie opcja do wyłączenia

**2. Trackowane linki - dwa typy do wyboru przy konfiguracji** (`short_links`, `short_link_events`)
- `short_links: id, profile_id, target_url, slug, type (review_request|promo|qr_standalone), review_mode (direct|gated, tylko dla type=review_request), gate_threshold (int, domyślnie 4 - próg gwiazdek przepuszczający do Google), is_template boolean (domyślnie false - true dla linków tworzonych w widoku Linki i kody QR do wielokrotnego podpięcia pod wiadomości/sekwencje, false dla per-odbiorca klonów tworzonych automatycznie przy wysyłce/enrollmencie), created_at`
- Przy konfiguracji linku/kodu QR typu "prośba o opinię" wybór jednej z dwóch opcji:
  - **Link bezpośredni** (`review_mode=direct`) - kliknięcie/skan trackuje się i przekierowuje wprost do formularza opinii Google, bez żadnego pośredniego ekranu
  - **Link z bramką gwiazdek** (`review_mode=gated`) - kliknięcie/skan otwiera najpierw ekran z wyborem 1-5 gwiazdek (`/r/[slug]`, ta sama trasa, bez przekierowania na starcie); ocena `>= gate_threshold` przekierowuje do Google, ocena niższa zapisuje się jako prywatna wiadomość do właściciela profilu (`private_feedback`, punkt 5) i nie trafia na Google
- **Uwaga do świadomej decyzji**: bramka gwiazdek jest formą filtrowania opinii (review gating), co Google w swoich wytycznych wprost odradza i traktuje jako naruszenie - w skrajnym przypadku grozi to usunięciem opinii wizytówki lub sankcją konta. To Twoja świadoma decyzja produktowa (obie opcje mają być dostępne, wybór po stronie klienta panelu) - dokument to tylko odnotowuje, nie blokuje
- Redirect/gate: `GET /r/[slug]` - publiczna trasa poza bramką auth w `proxy.ts`. Dla `review_mode=direct` (albo `type` innych niż `review_request`): zapisuje zdarzenie kliknięcia (`short_link_events: id, short_link_id, contact_id nullable, clicked_at`), 302 na `target_url`. Dla `review_mode=gated`: renderuje ekran gwiazdek zamiast przekierowania
- `POST /r/[slug]` - submit oceny z ekranu bramki: `rating` (1-5) + opcjonalna wiadomość tekstowa. `rating >= gate_threshold` → zapis `short_link_events` + 302 na `target_url` (Google). `rating < gate_threshold` → zapis do `private_feedback`, ekran podziękowania (bez przekierowania do Google), powiadomienie właściciela profilu (kanał z Fazy 7)
- Wysyłka do konkretnego kontaktu - link generowany per-odbiorca (ten sam `target_url`/`review_mode`, osobny `slug`/rekord), żeby kliknięcie dało się przypisać do konkretnej osoby, nie tylko zliczyć zbiorczo
- Użycie offline (naklejka/stojak QR z modułu Sklep) - `short_link` bez `contact_id`, tylko zliczanie anonimowych skanów/ocen

**3. Generowanie kodów QR**
- Serwerowe generowanie PNG/SVG z URL trackowanego linku (biblioteka `qrcode`, dopisana do tabeli stacku w sekcji 8) - QR koduje link `/r/[slug]`, więc dziedziczy tryb (bezpośredni/bramka) ustawiony przy jego konfiguracji
- Do pobrania i wydruku - zasila fizyczne produkty ze Sklepu (stojak QR, naklejki NFC) tym samym mechanizmem śledzenia co linki wysyłane w SMS/e-mailu, nie osobnym systemem

**4. Wiadomości** (nie "kampanie")
- Kreator wiadomości: typ (prośba o opinię / promocja) → dla prośby o opinię - wybór trybu linku z punktu 2 (bezpośredni/bramka) → kanał (SMS/e-mail) → odbiorcy (wszyscy z aktywną zgodą / segment) → treść → wyślij/zaplanuj
- `outreach_messages: id, profile_id, type (review_request|promo), channel (sms|email), body, audience (all|segment), segment_filter jsonb nullable, scheduled_at nullable, status` + `outreach_recipients: id, message_id, contact_id, short_link_id, status (queued|sent|failed|clicked), sent_at, clicked_at`
- Wysyłka przez infrastrukturę kolejek z Fazy 5 (nowa `outreach-queue` obok `publish-queue`/`generate-queue`/`notification-queue`), nie synchronicznie - przy bazie w tysiącach kontaktów wysyłka nie może blokować requestu

**5. Prywatne oceny** (`private_feedback`)
- `id, profile_id, short_link_id, contact_id nullable, rating smallint, message text nullable, created_at`
- Wszystkie oceny niższe niż `gate_threshold` zebrane przez bramkę gwiazdek - widok listy dla właściciela profilu (ocena, treść, źródło, data), nie widoczne publicznie, nie trafiają na Google
- Cel: pozwolić właścicielowi zareagować na niezadowolenie klienta bezpośrednio, zamiast dowiadywać się o nim z publicznej, niskiej opinii

**6. Sekwencje wiadomości - wieloetapowe wysyłki** (`sequences`, `sequence_steps`, `sequence_enrollments`, `sequence_step_runs`)
- Sekwencja to zdefiniowana raz seria kroków w czasie, np. prośba o opinię - krok 1 od razu, krok 2 po 7 dniach jeśli brak kliknięcia, krok 3 po 30 dniach jeśli wciąż brak kliknięcia. Liczba kroków i odstępy są konfigurowalne, powyższe to przykład, nie sztywna reguła
- **Dwa niezależne sposoby, którymi kontakt trafia do aktywnej sekwencji** - to główna różnica względem jednorazowej wiadomości z punktu 4:
  - **Pojedynczo, na bieżąco** - pole "Zapisz do sekwencji" w formularzu dodania kontaktu (punkt 1) albo akcja "Dodaj do sekwencji" z widoku kontaktu już w bazie. Tworzy jeden `sequence_enrollment` od razu, bez wybierania grupy. To droga dla przypadku "po każdej zakończonej wizycie dopisz tego jednego klienta do przypomnień o opinię" - najczęstszy scenariusz dla `type=review_request`
  - **Grupowo, na żądanie** - akcja "Dodaj kontakty do sekwencji" na sekwencji, tym samym mechanizmem wyboru odbiorców co w kreatorze wiadomości z punktu 4 (wszyscy z aktywną zgodą / segment / ręczne zaznaczenie). Tworzy enrollmenty dla wszystkich wybranych na raz - do wysyłek do istniejącej bazy (np. promocja sezonowa do segmentu). Można użyć wielokrotnie, w różnym czasie, na tej samej sekwencji
- Sekwencja **nie jest zamrożona po pierwszym użyciu** - dopóki ma status `active`, przyjmuje kolejne enrollmenty obiema drogami, w dowolnym momencie. Wstrzymanie (`paused`) zatrzymuje przyjmowanie nowych enrollmentów bez ruszania już zaplanowanych kroków istniejących; archiwizacja (`archived`) też blokuje nowe enrollmenty, a istniejące dobiegają swoich zaplanowanych kroków do końca
- `sequences: id, profile_id, name, type (review_request|promo), link_id (FK do short_links z is_template=true - link podpięty do sekwencji, wybrany z listy już utworzonych w widoku Linki i kody QR), stop_on_click boolean (domyślnie true), status (draft|active|paused|archived), created_at`
- `sequence_steps: id, sequence_id, step_order, delay_days int (liczony od momentu zapisania danego enrollmentu do sekwencji, nie od poprzedniego kroku - unika kumulowania się błędu i pozwala zaplanować wszystkie kroki z góry, niezależnie kiedy dany kontakt trafił do sekwencji), channel (sms|email), body, created_at`
- `sequence_enrollments: id, sequence_id, contact_id, short_link_id (jeden trackowany link na cały enrollment, wspólny dla wszystkich kroków - dzięki temu "czy kliknięto" sprawdza się w jednym miejscu, nie osobno na krok), status (active|completed_clicked|completed_all_steps|stopped_unsubscribed|stopped_manual), enrolled_at, completed_at`
- `sequence_step_runs: id, enrollment_id, step_id, status (pending|sent|failed|skipped), scheduled_at, sent_at`
- Każdy nowy enrollment (pojedynczy albo część grupowego uruchomienia) tworzy natychmiast: jeden `short_link` sklonowany z linku wskazanego przez `sequences.link_id` (kopiuje `target_url`/`type`/`review_mode`/`gate_threshold` z linku-szablonu, generuje własny unikalny `slug` per-kontakt, `is_template=false`) + z góry zaplanowane zadania w `outreach-queue` (BullMQ, jedno zadanie na krok, delay = `delay_days` tego kroku licząc od `enrolled_at` tego konkretnego enrollmentu)
- Worker przed wysyłką każdego kroku sprawdza po kolei: (a) czy `short_link_events` ma już zdarzenie dla `short_link_id` tego enrollmentu (ktoś kliknął) → jeśli tak, `status: completed_clicked`, pomija ten i wszystkie kolejne kroki (`sequence_step_runs.status: skipped`); (b) czy kontakt ma `consent_marketing = false` (rezygnacja) → `status: stopped_unsubscribed`, pomija; (c) w przeciwnym razie wysyła krok, zapisuje `sent_at`. Po wysłaniu ostatniego kroku bez kliknięcia → `status: completed_all_steps`. Status samej `sequences` nie przełącza się automatycznie na podstawie stanu enrollmentów (sekwencja może przyjmować nowe enrollmenty w nieskończoność) - `paused`/`archived` to wyłącznie decyzja właściciela profilu
- Kreator/edycja sekwencji w UI: nazwa → typ (jak w punkcie 4) → **powiązany link** (patrz niżej) → lista kroków budowana jako linia czasu (dodaj krok: liczba dni od zapisania + kanał + treść) → zapisz jako aktywną (albo jako szkic `draft`, jeśli nie gotowa). Wybór odbiorców nie jest już częścią tego kreatora - odbiorcy trafiają do sekwencji osobno, przez jedną z dwóch dróg opisanych wyżej
- **Powiązany link wybierany z istniejących linków** (`sequences.link_id`, FK do `short_links` oznaczonego jako wielokrotnego użytku/szablon), a nie konfigurowany od nowa przy każdej sekwencji - w kreatorze/edytorze sekwencji pole "Powiązany link" to lista rozwijana z linkami już utworzonymi w widoku Linki i kody QR (punkt 2), bez rozróżnienia czy to link "z bramką" czy "bezpośredni" czy zwykła promocja - dowolny stworzony wcześniej link można podpiąć pod dowolną sekwencję. Ten sam link zostaje wspólny dla wszystkich kroków sekwencji (jak w punkcie o `sequence_enrollments.short_link_id` niżej) - znacznik `[link]` w treści kroku wstawia się przyciskiem "+ Wstaw [link]" przy polu treści. Przy każdym nowym enrollmencie system klonuje konfigurację wybranego linku (`target_url`, `type`, `review_mode`, `gate_threshold`) do świeżego rekordu `short_links` z unikalnym slugiem per-kontakt - dzięki temu kliknięcia nadal liczą się per-odbiorca, a nie zbiorczo na jednym slugu współdzielonym przez wszystkich uczestników
- **Włączanie/wyłączanie sekwencji wprost na karcie** - przełącznik (switch) obok nazwy, bez wchodzenia w edycję: `active ↔ paused`, natychmiastowy zapis. Wyłączenie (`paused`) zatrzymuje przyjmowanie nowych enrollmentów obiema drogami z punktu wyżej, ale nie rusza już zaplanowanych kroków obecnych uczestników - te kończą się zgodnie z planem
- **"Edytuj" - osobny przycisk na karcie, otwiera ten sam kreator co przy tworzeniu, wypełniony bieżącymi danymi** (nazwa + lista kroków, każdy krok edytowalny lub usuwalny, można dodać kolejny). Zmiana treści/odstępów kroku dotyczy wysyłek **od teraz** - nie modyfikuje `sequence_step_runs` już zaplanowanych dla istniejących enrollmentów z ich starą treścią/terminem, żeby nie zaskoczyć kogoś, kto już dostał krok 1 inną wersją wiadomości. Edytor ma też akcję "Archiwizuj sekwencję" (`status: archived`) - trwałe zatrzymanie, różne od tymczasowego `paused`
- "Duplikuj" zostaje przydatne, gdy potrzebny inny wariant treści/odstępów (np. inny ton dla promocji), ale nie jest już potrzebne tylko po to, żeby wysłać do innej grupy - ta sama, wciąż aktywna sekwencja obsługuje to przez "Dodaj kontakty do sekwencji"
- **"Dodaj kontakty do sekwencji" to ta sama akcja co pojedynczy zapis kontaktu (pole "Zapisz do sekwencji"/przycisk "Dodaj do sekwencji"), tylko od razu dla wielu kontaktów** - nazwa celowo zmieniona z wcześniejszego "Uruchom dla grupy" (mogła sugerować osobny mechanizm "uruchamiania"), żeby jasno pokazać, że to ta sama operacja dodawania do sekwencji, tylko zbiorcza. Otwiera ten sam wybór odbiorców co w kreatorze wiadomości z punktu 4 (wszyscy z aktywną zgodą / segment / ręczne zaznaczenie) i zapisuje wszystkich zaznaczonych do tej sekwencji jednym kliknięciem, każdego z własnym `enrolled_at` = teraz. Używane, gdy chcesz wysłać tę samą serię do wielu osób naraz (np. promocja do segmentu 40 klientów), a nie czekać, aż trafią pojedynczo
- Kliknięcie karty sekwencji (albo osobny link "Zobacz uczestników") otwiera listę wszystkich zapisanych do niej kontaktów z aktualnym etapem każdego (który krok wysłany/w toku/zaplanowany/pominięty, data zapisania, data ostatniej wysyłki) - to widok "kto jest w tej sekwencji i na jakim jest etapie", odróżniony od widoku szczegółów jednego kontaktu z punktu 7 (tam jest odwrotna perspektywa - jeden kontakt, jego pełna historia)

**7. Widok szczegółów kontaktu** (`/kampanie-wysylkowe/kontakty/[contactId]`)
- Kliknięcie wiersza w tabeli kontaktów (punkt 1) otwiera szczegóły: dane kontaktu, aktualny status sekwencji (jeśli zapisany) z wizualną linią czasu kroków - który krok wysłany, który w toku, który zaplanowany, który pominięty i czemu (kliknięcie / rezygnacja) - oraz pełna historia wszystkich wysłanych wiadomości (jednorazowych z punktu 4 i kroków sekwencji z punktu 6) z kanałem, datą, statusem i informacją o kliknięciu
- To jedno miejsce, w którym widać cały przebieg komunikacji z konkretnym kontaktem: jaki workflow ma skonfigurowany, na jakim jest etapie, czy i kiedy kliknął

**Dashboard modułu**: liczba wysłanych wiadomości, kliknięć, CTR, liczba przepuszczonych do Google vs zatrzymanych w bramce (dla linków `gated`), liczba rezygnacji z subskrypcji, liczba aktywnych sekwencji i kontaktów aktualnie w toku sekwencji - osobny zestaw KPI w widoku modułu, nie mieszany z dashboardem głównym z sekcji 7.

**Poza MVP - bez ustalonego priorytetu**
- sklep i moduły dokupywane (produkty fizyczne - stojaki QR, NFC, naklejki do zbierania opinii; moduły osobne - Google Ads, Meta Ads, heio.ai, konsultacje eksperckie) - było wcześniej błędnie wymienione też jako część zakresu MVP wyżej w tej sekcji; obowiązuje ta linia - poza MVP, zgodnie z kolejnością budowy w sekcji 10 i plikami faz Cursora
- kalendarz (integracja Google Calendar/TidyCal)
- płatności jako produkt (link płatniczy typu Stripe do usług jednorazowych)
- ads, leady z reklam jako dane w dashboardzie

## 4. Model danych - multi-profil i grupy publikacji

Jeden klient (konto) może zarządzać więcej niż jedną wizytówką/stroną na dwa sposoby:
- **ta sama marka, wiele lokalizacji** (np. warsztat z 3 wizytówkami) - w większości identyczny content publikowany jednocześnie
- **różne, niepowiązane biznesy pod jednym właścicielem** - osobny kontekst firmy, osobny plan wydawniczy, osobne propozycje AI

**Hierarchia:**
- **Konto** - jednostka rozliczeniowa (login, płatność, subskrypcja)
- **Profil** - jednostka operacyjna: własna wizytówka Google (NAP), własne kanały social, własny kontekst firmy (brief, ton, grupa docelowa, usługi), własny plan wydawniczy, własny licznik limitów AI. Jedno konto = wiele profili.
- **Grupa publikacji** - opcjonalna relacja między profilami tej samej marki - tag łączący profile współdzielące wygenerowany content. NAP, wizytówka, kanały zostają osobnymi rekordami per profil nawet w grupie, współdzielona jest tylko treść posta w momencie publikacji.

**W praktyce:** przy tworzeniu posta/opinii-odpowiedzi klient w grupie widzi checkboxy z pozostałymi profilami z tej samej grupy ("Publikuj też w: ..."). Profile spoza grupy działają w pełni niezależnie, z własnym AI-kontekstem. Przełącznik profilu w panelu pokazuje wszystkie profile klienta, z grupami wizualnie zwiniętymi pod jedną marką.

## 5. Model cenowy

Pakiet bazowy: strona www, wizytówka Google, content (pętla generowania/publikacji + opinie). Płatne dodatki poza pakietem bazowym: heio.ai, Google Ads, Meta Ads, konsultacje eksperckie, sklep z produktami fizycznymi.

Cena **per profil** (nie per konto) - koszt generowania AI i limity skalują się per profil. Przy grupie publikacji - rabat ilościowy (część treści współdzielona, generowana raz).

Limit generowań AI w planie podstawowym - punkt wyjścia: 4 blogi/miesiąc per profil (dokładna liczba do doprecyzowania na podstawie kosztu tokenów/obrazów per klient).

## 6. Architektura - kluczowe decyzje

- **Multi-tenancy od dnia pierwszego** - pełna izolacja danych klientów (produkt sprzedawany na zewnątrz, nie tylko franczyzie)
- **Konto → profile → opcjonalne grupy publikacji** (patrz sekcja 4)
- **Panel admina zamiast pełnej persony agencyjnej** (decyzja zawężona): panel ma jedną personę produktową - właściciela lokalnego biznesu zarządzającego swoimi profilami. Zespół Architekci Biznesu dostaje wewnętrzne narzędzie serwisowe: listę kont klientów z rozwijanymi profilami i wejście w dowolne z nich, z pełnymi uprawnieniami właściciela i oznaczeniem trybu w przełączniku profilu (`cursor/faza-02b-tryb-admina.md`). Bez logu dostępu i bez ograniczeń operacji - świadomie, bo to mały zaufany zespół wewnętrzny; cała logika siedzi w jednym helperze, więc dopisanie logu później jest tanie. Pełna persona agencyjna/resellerska z własnym dashboardem i rozliczeniami klientów jest poza zakresem - franczyza nie jest kanałem sprzedaży tego produktu
- **Self-serve onboarding + billing** - rejestracja, płatność (Stripe), pierwsze uruchomienie panelu bez udziału zespołu
- **Kontekst firmy rozdzielony na dwie warstwy o różnym cyklu życia** - `profile_briefs` to deklaracja właściciela (typowane kolumny, jeden rekord na profil, edytowalny z panelu w `/ustawienia/kontekst`), `company_context` to niezmienne migawki tego, co pobraliśmy (scrape strony, snapshot wizytówki). Brief jest wejściem do każdego generowania AI w produkcie, więc musi dać się poprawić, gdy oferta klienta się zmieni - inaczej panel generuje nieaktualne treści w nieskończoność
- **Strona jako komponent w architekturze panelu** - zdefiniowany kontrakt (API/schemat treści), przez który panel publikuje blogi i edytuje sekcje contentowe. Rozstrzygnięte: każdy klient ma indywidualny projekt strony (osobny design/repo), hostowany na Coolify jak panel, ale wszystkie strony konsumują tę samą Content API panelu i wystawiają identyczny `site.manifest.json` + endpoint rewalidacji - pełny kontrakt w `cursor/faza-11-strona-content-api.md` (strona panelu) i `cursor/strona-www-wytyczne.md` (strona klienta)

## 7. Struktura aplikacji (na podstawie makiety)

Makieta: https://claude.ai/artifact/Wn2ZrSXrAJ64WWwh28aFTY

**Przełącznik profilu** (góra sidebara) - pokazuje aktywny profil, w rozwinięciu: pozostałe profile z tej samej grupy publikacji (z odznaczeniem "grupa publikacji (N)") oraz osobną sekcję "Pozostałe profile" (niepowiązane marki klienta) + akcję "Dodaj profil".

**Nawigacja główna (sidebar), pogrupowana:**

*Ogólne*
- **Pulpit** - dashboard: statystyki strony WWW, statystyki wizytówki Google, ruch na stronie (14 dni), wykorzystanie limitów AI, ostatnia aktywność, "do zrobienia dziś"

*Obecność online*
- **Strona WWW** - trzy podwidoki: Treści strony (edycja inline, "zmiany zapisują się automatycznie"), Backlinki (lista pozyskanych, opcja dokupienia), Analityka
- **Wizytówka Google** - Informacje o firmie, Atrybuty, Godziny otwarcia, Kontakt, Lokalizacja, NAP i katalogi (lista + dokupienie), Statystyki wizytówki Google
- **Publikacje** - trzy podwidoki: Do akceptacji (inbox - karty z propozycją AI + akcje: Akceptuj / Edytuj przez czat / Odrzuć), Wszystkie publikacje (historia), Kalendarz (social calendar)
- **Opinie i komentarze** - inbox opinii/komentarzy ze wszystkich podłączonych kanałów (w MVP: GBP; Facebook/Instagram po dodaniu Meta poza MVP - widok od początku wielokanałowy, z filtrem/oznaczeniem kanału), z przełącznikiem trybu: "Tryb: akceptacja" / "Tryb: pełny automat" (widoczny w UI jako `modeSwitch`/`modeLabel`) - opinie 1-2 gwiazdkowe zawsze wymuszają tryb akceptacji niezależnie od ustawienia

*Sprzedaż*
- **Klienci (CRM)** - kanban, leady wpadają automatycznie z formularza strony
- **Kampanie wysyłkowe** *(w zakresie MVP, Faza 8)* - baza kontaktów klientów końcowych (osobna od CRM), wysyłka SMS/e-mail jednorazowa lub w wieloetapowych sekwencjach follow-up (prośby o opinię z opcjonalną bramką gwiazdek + promocje), trackowane linki i kody QR, prywatne oceny niższe niż próg bramki, widok szczegółów kontaktu z historią i statusem sekwencji - patrz sekcja 3.1

*Rozwój*
- **Sklep i dodatki** - produkty fizyczne + moduły dokupywane (Ads, heio.ai, konsultacje)
- **Ustawienia i plan** - plan i rozliczenia (widoczny też w stopce sidebara: nazwa planu + wykorzystanie limitu, np. "3 z 4 blogów wykorzystane w tym miesiącu")

**Wzorzec interakcji powtarzający się w całym UI** (pętla akceptacji z sekcji 2): karta z propozycją AI → `Akceptuj` / `Edytuj przez czat` / `Odrzuć`. Ten sam wzorzec ma się przenieść 1:1 z makiety na realną implementację - to centralny element UX całego produktu, nie tylko sekcji Publikacje.

### 7.1 Struktura URL (routing, Next.js App Router)

Aktywny profil trzymany w sesji/cookie (przełącznik w sidebarze go zmienia), nie w URL - upraszcza to routing i unika przenoszenia `profileId` w każdym linku. Wyjątek: `/[profileId]/ustawienia` tam, gdzie link ma trafić do konkretnego profilu niezależnie od tego, który jest aktualnie aktywny w sesji (np. link z e-maila powiadomienia).

```
/                              → redirect do /logowanie lub /pulpit (zależnie od sesji)
/logowanie
/rejestracja
/onboarding                    → brief + scraping strony/GBP, tworzenie pierwszego profilu

/pulpit                        → dashboard (sekcja "Ogólne")

/strona                        → redirect do /strona/tresci
/strona/tresci                 → edycja treści strony (inline editor)
/strona/backlinki
/strona/analityka

/wizytowka                     → redirect do /wizytowka/informacje
/wizytowka/informacje          → nazwa, kategorie, opis, usługi (tu większość propozycji AI)
/wizytowka/kontakt             → telefon, witryna, profile społecznościowe, adres, obsługiwany obszar
/wizytowka/godziny             → godziny standardowe i wyjątki + atrybuty zależne od kategorii
/wizytowka/nap                 → lista wpisów NAP + dokupienie
/wizytowka/raporty             → statystyki z GBP Performance API (Faza 3) + mapa pozycji lokalnych (Faza 3b)

/publikacje                    → redirect do /publikacje/inbox
/publikacje/inbox              → do akceptacji
/publikacje/wszystkie          → historia
/publikacje/kalendarz          → social calendar
/publikacje/nowy                → composer (nowy post/temat)

/opinie                        → inbox opinii i komentarzy (wszystkie kanały)
/opinie/ustawienia             → tryb akceptacji / pełny automat per kanał

/crm                           → kanban leadów
/crm/[leadId]                  → szczegóły leada

/kampanie-wysylkowe            → redirect do /kampanie-wysylkowe/kontakty (w zakresie MVP, Faza 8)
/kampanie-wysylkowe/kontakty
/kampanie-wysylkowe/kontakty/[contactId]  → szczegóły kontaktu - status sekwencji + historia wysyłek
/kampanie-wysylkowe/nowa-wiadomosc
/kampanie-wysylkowe/historia
/kampanie-wysylkowe/sekwencje  → lista sekwencji + kreator (nazwa, typ, kroki jako linia czasu)
/kampanie-wysylkowe/linki
/kampanie-wysylkowe/prywatne-oceny
/r/[slug]                      → publiczna trasa (w zakresie MVP, Faza 8) - redirect + zapis kliknięcia dla linków bezpośrednich, ekran wyboru gwiazdek dla linków z bramką

/sklep                         → produkty fizyczne + moduły dokupywane
/sklep/zamowienia

/ustawienia                    → redirect do /ustawienia/plan
/ustawienia/plan               → plan i rozliczenia (Stripe)
/ustawienia/profile             → zarządzanie profilami i grupami publikacji
/ustawienia/kontekst            → edytor briefu firmy (`profile_briefs`) - wejście do każdego generowania AI
/ustawienia/integracje          → połączenia GBP / email klienta (OAuth); Meta jako pozycja widoczna, ale nieaktywna do czasu wdrożenia kanałów Meta poza MVP
/ustawienia/zespol               → role/dostępy (persona agencji zarządzającej wieloma klientami)

/admin                         → lista kont klientów z rozwijanymi profilami + akcja "Wejdź" (tryb admina) - dostęp tylko dla kont wewnętrznych (`users.is_staff`), dla pozostałych 404 - patrz sekcja 6 i `cursor/faza-02b-tryb-admina.md`
```

Każda trasa pod `/[cokolwiek]` poza `/logowanie`, `/rejestracja` chroniona w `proxy.ts` (Next.js 16 - dawne middleware) sprawdzającym sesję i przynależność aktywnego profilu do zalogowanego konta (zgodnie z zasadami bezpieczeństwa w `panel-lokalny-zasady-aplikacji.md`, sekcja 4 - serwer zawsze weryfikuje właściciela `profile_id`, nie ufa samemu istnieniu sesji). `/onboarding` też jest chroniony - następuje zaraz po rejestracji, użytkownik ma już sesję, tylko nie ma jeszcze profilu. `/r/[slug]` (Faza 8, w zakresie MVP) jest trzecim wyjątkiem - to publiczny redirect trackujący kliknięcia z SMS/e-maila, otwierany przez odbiorcę wiadomości bez sesji w panelu.

## 8. Stack technologiczny

| Warstwa | Technologia | Wersja | Koszt |
|---|---|---|---|
| Framework | Next.js | 16.3.5 | darmowy |
| Język | TypeScript | 7.0.2 | darmowy |
| Styling | Tailwind CSS | 4.3.3 | darmowy |
| Komponenty UI | shadcn/ui (CLI `shadcn`) | 4.21.0 | darmowy |
| Toasty | gooey-toast | 0.2.2 | darmowy |
| Walidacja | Zod | 4.6.5 | darmowy |
| Formularze | React Hook Form | 7.88.0 | darmowy |
| ORM | Drizzle ORM | 0.45.2 | darmowy |
| Migracje | Drizzle Kit | 0.31.10 | darmowy |
| Baza danych | PostgreSQL (Neon) | 18 | darmowy próg → płatny przy skali |
| Auth | Auth.js (next-auth) | 5.0.0-beta.32 | darmowy |
| AI - tekst (domyślny) | OpenAI SDK (`openai`, model z `OPENAI_TEXT_MODEL`) | 7.15.0 | płatny za użycie (tokeny) |
| AI - tekst (alternatywa, niezaimplementowana) | Anthropic SDK (`@anthropic-ai/sdk`, Claude) | 0.126.0 | płatny za użycie (tokeny) |
| AI - grafika | OpenAI SDK (`openai`, gpt-image) | 7.15.0 | płatny za użycie (obrazy) |
| Płatności | Stripe (`stripe`) | 22.6.2 | prowizja od transakcji (zawsze płatne) |
| Email systemowy | Brevo (`@getbrevo/brevo` / SMTP) | 6.0.3 | darmowy próg (300/dzień) → płatny |
| Email klienta - SMTP fallback | Nodemailer | 10.0.10 | darmowy |
| Email klienta - Gmail | googleapis | 181.0.0 | darmowy |
| Email klienta - Outlook | @microsoft/microsoft-graph-client | 3.0.7 | darmowy |
| SMS | SMSAPI (REST) | - | zawsze płatne (doładowania) |
| Storage plików | AWS SDK S3 client (kompatybilny z R2) | 3.1129.0 | darmowy próg → płatny (tanio, brak egress) |
| Kolejki/cron | BullMQ | 6.3.4 | darmowy |
| Broker kolejki | Redis | 8.6 | darmowy (self-hosted) |
| Analityka + error tracking | posthog-js / posthog-node | 1.433.5 / 5.52.4 | darmowy próg (1 mln zdarzeń/mies.) → płatny |
| Hosting | Coolify | 4.x (self-hosted) | darmowy (koszt: VPS) |
| Pozycje lokalne (moduł Wizytówka, Faza 3b) | ScrapingDog (REST) | - | płatne za zapytanie - koszt rośnie iloczynowo (profile × frazy × punkty siatki × częstotliwość) |
| Kody QR (moduł Kampanie wysyłkowe, w zakresie MVP) | qrcode | 1.5.4 | darmowy |
| Krótkie linki - generowanie slugów (moduł Kampanie wysyłkowe, w zakresie MVP) | nanoid | 6.0.1 | darmowy |

Uwaga: Auth.js v5 ma formalny status beta, ale jest jedyną wersją poprawnie działającą z App Routerem Next.js - traktowana jako produkcyjna.

Zawsze płatne bez darmowego progu: Stripe (prowizja), SMSAPI (doładowania), ScrapingDog (zapytania), serwer VPS pod Coolify/Redis/Postgres.

## 9. Integracje zewnętrzne - status

**Meta Graph API (Facebook + Instagram)** - *kanały przeniesione poza MVP, poniższy stan przygotowania zostaje aktualny na moment wdrożenia*
- Aplikacja "Lokalny Panel" utworzona, App ID: 1787515202401915
- Podpięta do zweryfikowanego Business Portfolio "Architekci Biznesu"
- Use case'y dodane: "Manage everything on your Page" (Pages API), "Manage messaging & content on Instagram"
- Dostęp do Instagrama przez token Strony (`instagram_business_account` na obiekcie Page), nie przez osobny login Instagrama
- Wymagane uprawnienia dla obu use case'ów: `public_profile`, `pages_show_list`, `business_management` - wszystkie przetestowane udanymi wywołaniami API
- **Zostało**: App Review (Advanced Access) - do złożenia dopiero, gdy panel ma realnie działającą funkcję do pokazania w screencaście (wymóg Meta). Bez tego aplikacja działa tylko w trybie deweloperskim (dla Ciebie i ról w apce), nie dla realnych klientów

**Google Business Profile API**
- API włączone w jednym z projektów Google Cloud
- **Zostało**: konfiguracja OAuth consent screen (typ External - klienci logują się spoza organizacji), dodanie scope'u `business.manage`, weryfikacja aplikacji przez Google przed produkcyjnym użyciem z realnymi klientami

**Senuto API** - pod statystyki słów kluczowych, faza 2/3 (poza zakresem MVP)

## 10. Kolejność budowy

Numer fazy odpowiada kolejności budowy. Fazy z literką (2b, 3b) to wstawki przy fazie, której dotyczą.

**MVP:**

1. Fundament: multi-tenancy (konto → profile → grupy), Auth.js, `proxy.ts` chroniący trasy, helper izolacji (`cursor/faza-01-fundament.md`)
2. Logowanie i onboarding: docelowy wygląd ekranów wejściowych, trzy kroki (adres strony → brief napisany przez AI na podstawie scrape'a, zatwierdzany przez klienta → podłączenie wizytówki, opcjonalne), `profile_briefs`, multi-select lokalizacji. Tu powstaje warstwa providerów AI (`cursor/faza-02-onboarding.md`)
2b. Panel admina - wejście zespołu w konto klienta (`cursor/faza-02b-tryb-admina.md`). Celowo przed Fazą 3: zmienia helper izolacji, który wywołuje każda kolejna faza
3. Wizytówka Google: edycja pól z zapisem do GBP, optymalizacja AI (opis, usługi, kategorie, nazwa z ostrzeżeniem o ryzyku), atrybuty do potwierdzenia, statystyki GBP, edytor briefu (`cursor/faza-03-wizytowka-google.md`)
3b. Mapa pozycji lokalnych przez ScrapingDog - siatka punktów, frazy per profil, skan na żądanie, limity kosztowe (`cursor/faza-03b-mapa-pozycji.md`)
4. Pętla contentowa: generowanie AI → inbox akceptacji → edycja przez chat → publikacja. W MVP jeden kanał: GBP (`cursor/faza-04-petla-contentowa.md`)
5. Kolejki (BullMQ) pod harmonogram publikacji, generowanie w tle i cykliczne skany pozycji (`cursor/faza-05-kolejki.md`)
6. Opinie i komentarze - tryb akceptacji i pełnego automatu (`cursor/faza-06-opinie.md`)
7. Dashboard + CRM + powiadomienia systemowe przez Brevo/SMSAPI (`cursor/faza-07-dashboard-crm-powiadomienia.md`)
8. Kampanie wysyłkowe do bazy klientów (`cursor/faza-08-kampanie-wysylkowe.md`)
9. Weryfikacja aplikacji przez Google (OAuth consent, scope `business.manage`) na bazie działających funkcji - **blokuje wydanie** (`cursor/faza-09-weryfikacja-google.md`, sekcja Google)

**Poza MVP - budowane po pierwszym wydaniu:**

- Kanały Meta (Facebook + Instagram): implementacja adaptera, ekran połączenia w Ustawieniach, App Review / Advanced Access (`cursor/faza-09-weryfikacja-google.md`, sekcja Meta)
- Faza 10 - Stripe: subskrypcje per profil, rabat grupowy (`cursor/faza-10-platnosci.md`). Do tego czasu rozliczenia idą ręcznie
- Faza 11 - Content API i kanał publikacji "site" dla stron klientów (`cursor/faza-11-strona-content-api.md`)
- Sklep i moduły dokupywane
