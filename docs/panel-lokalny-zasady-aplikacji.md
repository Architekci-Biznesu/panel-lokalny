# Panel Lokalny - zasady aplikacji

Dokument referencyjny dla kodu (do wklejenia jako kontekst dla Cursor/Claude Code przy pracy nad projektem). Obowiązuje przy każdym nowym komponencie i widoku.

---

## 1. CSS i design system

Obowiązuje **Styl 4** - specyfikacja i makiety: `docs/design/styl-4/README.md` (PNG w `docs/design/styl-4/screens/`). Wartości nie przepisuj stąd ani z makiety - źródłem prawdy jest kod.

**Design tokeny: `styles/tokens.css`** (`:root`, jedyne miejsce z wartościami). Skrót:

- Marka indygo `--brand` (+ `--brand-deep`, `--brand-soft`, `--brand-50...700`), akcent koral `--warning` (+ `--warning-soft`, `--warning-strong`).
- Szare płótno `--canvas`, białe kafle `--card`, tekst `--foreground`, opisy `--muted-foreground`, separatory `--border`.
- Statusy: `--success*`, `--danger*` / `--destructive`, `--info`. Szarości: `--neutral-50...700`.
- Promienie: `--radius-pill` (przyciski, pola, pille, segmenty), `--radius-card` 24px (kafle), `--radius-block` 16px (bloki wewnętrzne, textarea). Cień kafla `--shadow-card` - kafle bez obramowania.
- Fonty: Geist (`--font-sans`) i JetBrains Mono (`--font-mono`, klasa `.mono`) dla liczb, dat, godzin, telefonów, URL-i, liczników. Font bazowy 14px.

**Primary CTA:** `.ui-btn-primary` - czarny (`--primary`), nie indygo. Indygo to marka i akcent (logo, aktywne stany, soft fills). Na szarym płótnie drugorzędny przycisk to `.ui-btn-white`.

Ikony: obrys (nie wypełnienie), `stroke-width:2`, zaokrąglone końce - `lucide-react`.

**Gdzie są style:** `app/globals.css` to tylko importy i `@theme`. Reguły: `styles/ui.css` (design system `.ui-*`), `styles/shell.css`, `styles/auth.css` i po jednym pliku na moduł (`styles/wizytowka.css`, `styles/raporty.css`, `styles/pulpit.css`...). Szczegóły i procedura dodania modułu: `.cursor/rules/agents.mdc`, sekcja Design system. Porządku pilnuje `npm run lint:css`.

**Szkielety ładowania:** klocki `.ui-skel`, `.ui-skel-circle`, `.ui-skel-block`, `.ui-skel-row`, `.ui-skel-stack`, `.ui-skel-grid` (`styles/ui.css`). Szkielet ma odwzorowywać układ widoku (te same kontenery), żeby po załadowaniu nic nie skakało. Wspólny szkielet modułów: `app/(app)/loading.tsx`.

**Biblioteka globalnych klas komponentowych** (`styles/ui.css`, `@layer components`): `.ui-card`, `.ui-section` (kontener sekcji - pojedyncza ramka + tło, patrz zasada niżej), `.ui-btn` + warianty `-primary` / `-secondary` / `-white` / `-outline` / `-ghost` / `-danger` + rozmiar `-sm`, `.ui-field` / `.ui-select` / `.ui-textarea` (focus: `box-shadow:0 0 0 3px` w kolorze `--ring`), `.ui-pill` + warianty `-info` / `-success` / `-danger` / `-neutral` / `-warn` (statusy i etykiety), `.ui-kpi` (kafelki liczbowe na dashboardzie), `.ui-table-shell`, `.banner` (komunikaty informacyjne), `.locked-note` (funkcja zablokowana/do dokupienia).

**Jeden plik tokenów.** Wszystkie tokeny (kolory, spacing, promienie zaokrągleń, cienie, typografia) definiowane jako CSS custom properties w jednym pliku (`styles/tokens.css`), nie rozrzucone po komponentach. Style komponentów: `styles/ui.css` (design system) + po jednym pliku na moduł w `styles/`, wszystkie importowane w `app/globals.css`. Tailwind config czyta te tokeny, nie definiuje własnych równoległych wartości.

**Globalne klasy, nie powtarzany inline-soup.** Powtarzalne wzorce (karta, przycisk, pigułka statusu, input) definiowane raz jako klasa w warstwie `@layer components` (np. `.ui-card`, `.ui-btn`, `.ui-pill`) - tak jak w makiece. Nie kopiuj tego samego zestawu 15 klas Tailwind w każdym miejscu, gdzie występuje karta - to źle się skaluje i przy zmianie designu trzeba poprawiać w dziesiątkach miejsc zamiast w jednym.

**Bez em dashy w tekstach UI.** Myślnik zwykły (`-`), nie em dash (`—`), we wszystkich labelach, opisach, komunikatach błędów, treściach generowanych przez AI wyświetlanych w interfejsie.

**Zasada jednego poziomu kontenera (przeciw "kafelkom w kafelku").** To częsty błąd generowania AI: karta z obramowaniem/tłem, a w niej kolejna karta z obramowaniem/tłem, a w niej jeszcze jedna. Zasada: w obrębie jednej sekcji może być **tylko jeden** wizualnie wydzielony kontener (obramowanie + tło + cień). Elementy wewnątrz niego rozdzielaj:
- odstępem (spacing), nie kolejną ramką
- linią-separatorem (`border-bottom` na pojedynczej krawędzi), nie zamkniętym boxem
- wagą i rozmiarem czcionki (nagłówek sekcji vs treść), nie kolorowym tłem
Jeśli coś wygląda jak "wymaga wydzielenia", w pierwszej kolejności próbuj typografii i odstępu, dopiero na końcu kolejnej ramki.

**Responsywność mobile-first.** Layout projektowany od najmniejszego ekranu (375px) w górę, nie odwrotnie. Nawigacja na mobile chowa się do szuflady za hamburgerem - nie ściska się do nieczytelnej wersji desktopowej. Tabele z danymi (np. lista leadów, lista publikacji) na mobile przechodzą na układ kart, nie scrollują się w bok jako ścięta tabela.

*Breakpointy (max-width): `639px` telefon (siatki kart w jedną kolumnę), `899px` tablet (split-screen logowania pokazuje tylko formularz, dwukolumnowe układy w jedną kolumnę), `1099px` wąski laptop, `1279px` - poniżej tej szerokości pozycje górnego navbaru chowają się do szuflady (hamburger). Nawigacja to górny navbar (`features/shell/app-shell.tsx`), nie sidebar.*

**Spójna skala odstępów i typografii.** Jedna skala spacingu (np. wielokrotności 4px) i jedna skala rozmiarów czcionek w całej aplikacji - żadnych dowolnych wartości typu `padding: 13px`.

## 2. Konwencje kodu

- Struktura folderów po domenach (`features/publikacje`, `features/opinie`, `features/crm`), nie po typach plików (`components/`, `hooks/`, `utils/` na najwyższym poziomie) - łatwiej nawigować przy dużej liczbie modułów
- Server Components domyślnie, `"use client"` tylko tam, gdzie faktycznie potrzebna interaktywność (stan, eventy) - nie na całych widokach
- Walidacja danych wejściowych przez Zod na granicy API (Server Actions/Route Handlers) zawsze, nawet jeśli frontend już waliduje - front można obejść
- Jeden wspólny adapter na kanał publikacji (Meta, GBP) z jednym interfejsem `publish()`, `fetchReviews()` itd. - dodanie nowego kanału nie dotyka istniejącej logiki
- Nazewnictwo: angielskie w kodzie (zmienne, funkcje, nazwy tabel), polskie tylko w treściach user-facing i komentarzach biznesowych, jeśli potrzebne
- Feedback po akcjach (sukces / błąd / ostrzeżenie / info) wyłącznie przez `gooey-toast` - bez inline komunikatów pod polami, transientnych bannerów po submitcie ani natywnych baniek walidacji przeglądarki (`noValidate` na formularzach); stałe UI (np. `.locked-note`, statusy) zostają

## 3. Dostępność (a11y)

- Kontrast tekstu do tła zgodny z WCAG AA (min. 4.5:1 dla tekstu podstawowego)
- Pełna obsługa klawiatury - każda akcja (akceptuj/edytuj/odrzuć, przełącznik profilu, nawigacja) dostępna bez myszy
- `aria-label` na przyciskach z samą ikoną (bez widocznego tekstu)
- Formularze: każdy input ma powiązany `<label>`; transientne błędy/sukcesy idą przez gooey-toast (biblioteka obsługuje a11y toasta), nie przez osobne akapity przy polach

## 4. Bezpieczeństwo

To przy multi-tenancy jest krytyczne, nie kosmetyczne - błąd w izolacji danych oznacza, że klient A może zobaczyć dane klienta B.

**Izolacja danych (najważniejsze)**
- Każde zapytanie do bazy filtrowane po `account_id`/`profile_id` na poziomie query builder, nigdy poleganie wyłącznie na tym, że UI nie pokazuje cudzych danych
- Postgres Row Level Security jako dodatkowa warstwa (defense in depth) - nawet błąd w logice aplikacji nie ujawni cudzych rekordów
- `profile_id` przekazywany w żądaniu zawsze weryfikowany po stronie serwera jako należący do zalogowanego konta - nigdy ufanie wartości przesłanej przez klienta bez sprawdzenia właściciela

**Sekrety i tokeny**
- Tokeny OAuth klientów (Gmail, Outlook, Meta, GBP) szyfrowane w bazie (nie plaintext), osobny klucz szyfrujący trzymany poza repo
- Zmienne środowiskowe/sekrety wyłącznie przez mechanizm sekretów Coolify, nigdy w repo ani w plikach `.env` commitowanych do gita

**API i webhooki**
- Rate limiting na publicznych endpointach (logowanie, rejestracja, formularz leadowy) - ochrona przed brute force i spamem
- Weryfikacja podpisu webhooków (Stripe signing secret, Meta webhook verify token) przed przetworzeniem payloadu
- CSRF - Server Actions w Next.js mają wbudowaną ochronę (origin check), ale każdy dodatkowy Route Handler przyjmujący mutacje musi to mieć sprawdzone jawnie

**Pliki i upload**
- Walidacja typu i rozmiaru pliku przy uploadzie zdjęć (klient dodający zdjęcia do wizytówki/posta) - whitelist rozszerzeń, skanowanie/re-encoding obrazów zamiast serwowania surowego uploadu

**Audyt**
- Log zdarzeń wrażliwych (zmiana planu/płatności, publikacja posta, zmiana uprawnień w koncie) z `account_id`, `user_id`, `timestamp` - przyda się zarówno do supportu, jak i do wyjaśnienia sporu z klientem

## 5. RODO / zgodność prawna

- Jasna podstawa prawna i retencja dla danych leadów zbieranych przez formularz na stronie klienta (CRM) - to dane osób trzecich, nie tylko klienta panelu
- Mechanizm usunięcia danych na żądanie (prawo do bycia zapomnianym) - zarówno dla klienta panelu (konto), jak i dla leada w CRM
- Polityka przechowywania logów i danych analitycznych (PostHog) zgodna z RODO - anonimizacja/pseudonimizacja gdzie możliwe
- Umowy powierzenia danych (DPA) z dostawcami przetwarzającymi dane osobowe w Twoim imieniu (Brevo, SMSAPI, Neon, Stripe) - do zebrania przed startem sprzedaży
