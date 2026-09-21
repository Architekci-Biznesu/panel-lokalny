# Panel Lokalny - zasady aplikacji

Dokument referencyjny dla kodu (do wklejenia jako kontekst dla Cursor/Claude Code przy pracy nad projektem). Obowiązuje przy każdym nowym komponencie i widoku.

---

## 1. CSS i design system

Wygląd aplikacji ma odpowiadać makiecie (https://claude.ai/artifact/Wn2ZrSXrAJ64WWwh28aFTY) - poniższe tokeny są wyciągnięte wprost z jej kodu, nie do wymyślania na nowo.

**Design tokeny (`globals.css`, `:root`)**

```css
:root{
  --brand:#6d4de8;
  --brand-deep:#4c2fd4;
  --brand-soft:#c4b5fd;

  --background:#fafafa;
  --foreground:#171717;
  --card:#ffffff;
  --primary:#171717;
  --primary-foreground:#fafafa;
  --secondary:#f4f4f5;
  --secondary-foreground:#27272a;
  --muted:#f4f4f5;
  --muted-foreground:#71717a;
  --accent:#f5f3ff;
  --accent-foreground:#4c2fd4;
  --destructive:#dc2626;
  --border:#e4e4e7;
  --input:#d4d4d8;
  --ring:#6d4de8;
  --radius:0.5rem;

  --font-sans:'Montserrat', system-ui, sans-serif;
  --font-mono:'JetBrains Mono', ui-monospace, monospace;
}
```

Fonty: Montserrat (tekst), JetBrains Mono (liczby, daty, wartości - `.mono` z `font-variant-numeric:tabular-nums`). Font podstawowy 14px (`0.875rem`), line-height 1.4.

Ikony: obrys (nie wypełnienie), `stroke-width:2`, zaokrąglone końce (`stroke-linecap:round`) - biblioteka typu Lucide pasuje 1:1 do tego stylu.

**Skala promieni zaokrągleń** - konsekwentnie pochodna jednego `--radius` (0.5rem), nie dowolne wartości:
- `var(--radius)` - standardowe elementy (przyciski, inputy, ikony akcji)
- `calc(var(--radius) + 2px)` - kontenery najwyższego poziomu (karty, sekcje, panele, `.ui-kpi`)
- `calc(var(--radius) - 2px)` / `calc(var(--radius) - 3px)` - elementy zagnieżdżone wewnątrz kontenera (item w liście, mały przycisk akcji)

**Cień** - używany oszczędnie, tylko przy elementach unoszących się nad treścią (dropdown, hover na karcie kanban), nigdy jako domyślna dekoracja karty: `0 8px 24px -8px rgba(0,0,0,0.18)` (menu/dropdown), `0 4px 14px -6px rgba(0,0,0,0.12)` (hover karty).

**Biblioteka globalnych klas komponentowych** (nazewnictwo z makiety, do przeniesienia 1:1 jako `@layer components`): `.ui-card`, `.ui-section` (kontener sekcji - pojedyncza ramka + tło, patrz zasada niżej), `.ui-btn` + warianty `-primary` / `-outline` / `-ghost` / `-danger` + rozmiar `-sm`, `.ui-field` / `.ui-select` / `.ui-textarea` (focus: `box-shadow:0 0 0 3px` w kolorze `--ring`), `.ui-pill` + warianty `-heio` / `-heio-soft` / `-info` / `-success` / `-danger` / `-neutral` / `-warn` (statusy i etykiety), `.ui-kpi` (kafelki liczbowe na dashboardzie), `.ui-table-shell`, `.banner` / `.category-note` (komunikaty informacyjne w kolorze marki), `.locked-note` (funkcja zablokowana/do dokupienia).

**Jeden globalny plik stylów.** Wszystkie tokeny (kolory, spacing, promienie zaokrągleń, cienie, typografia) definiowane jako CSS custom properties w jednym pliku (`globals.css`), nie rozrzucone po komponentach. Tailwind config czyta te tokeny, nie definiuje własnych równoległych wartości.

**Globalne klasy, nie powtarzany inline-soup.** Powtarzalne wzorce (karta, przycisk, pigułka statusu, input) definiowane raz jako klasa w warstwie `@layer components` (np. `.ui-card`, `.ui-btn`, `.ui-pill`) - tak jak w makiece. Nie kopiuj tego samego zestawu 15 klas Tailwind w każdym miejscu, gdzie występuje karta - to źle się skaluje i przy zmianie designu trzeba poprawiać w dziesiątkach miejsc zamiast w jednym.

**Bez em dashy w tekstach UI.** Myślnik zwykły (`-`), nie em dash (`—`), we wszystkich labelach, opisach, komunikatach błędów, treściach generowanych przez AI wyświetlanych w interfejsie.

**Zasada jednego poziomu kontenera (przeciw "kafelkom w kafelku").** To częsty błąd generowania AI: karta z obramowaniem/tłem, a w niej kolejna karta z obramowaniem/tłem, a w niej jeszcze jedna. Zasada: w obrębie jednej sekcji może być **tylko jeden** wizualnie wydzielony kontener (obramowanie + tło + cień). Elementy wewnątrz niego rozdzielaj:
- odstępem (spacing), nie kolejną ramką
- linią-separatorem (`border-bottom` na pojedynczej krawędzi), nie zamkniętym boxem
- wagą i rozmiarem czcionki (nagłówek sekcji vs treść), nie kolorowym tłem
Jeśli coś wygląda jak "wymaga wydzielenia", w pierwszej kolejności próbuj typografii i odstępu, dopiero na końcu kolejnej ramki.

**Responsywność mobile-first.** Layout projektowany od najmniejszego ekranu (375px) w górę, nie odwrotnie. Sidebar nawigacyjny na mobile chowa się za hamburgerem albo zamienia w dolny pasek nawigacji - nie ściska się do nieczytelnej wersji desktopowej. Tabele z danymi (np. lista leadów, lista publikacji) na mobile przechodzą na układ kart, nie scrollują się w bok jako ścięta tabela.

*Uwaga: makieta faktycznie definiuje breakpoint chowający sidebar - przy `900px` grid `.app` przechodzi na jedną kolumnę, sidebar staje się elementem `position:fixed` chowanym poza ekran (`transform:translateX(-100%)`) i otwieranym przyciskiem-hamburgerem (`.icon-btn.mobile-only`) w topbarze, klasa `.sidebar.open` go pokazuje. Ten sam `900px` przełącza też dwukolumnowy edytor strony (podgląd + czat AI) na jedną kolumnę. Dodatkowy breakpoint `640px` chowa nawigację strony klienta w podglądzie i zwija siatki kart do jednej kolumny. Wzorzec do przeniesienia 1:1 do realnej implementacji, nie do wymyślania na nowo.*

**Spójna skala odstępów i typografii.** Jedna skala spacingu (np. wielokrotności 4px) i jedna skala rozmiarów czcionek w całej aplikacji - żadnych dowolnych wartości typu `padding: 13px`.

## 2. Konwencje kodu

- Struktura folderów po domenach (`features/publikacje`, `features/opinie`, `features/crm`), nie po typach plików (`components/`, `hooks/`, `utils/` na najwyższym poziomie) - łatwiej nawigować przy dużej liczbie modułów
- Server Components domyślnie, `"use client"` tylko tam, gdzie faktycznie potrzebna interaktywność (stan, eventy) - nie na całych widokach
- Walidacja danych wejściowych przez Zod na granicy API (Server Actions/Route Handlers) zawsze, nawet jeśli frontend już waliduje - front można obejść
- Jeden wspólny adapter na kanał publikacji (Meta, GBP) z jednym interfejsem `publish()`, `fetchReviews()` itd. - dodanie nowego kanału nie dotyka istniejącej logiki
- Nazewnictwo: angielskie w kodzie (zmienne, funkcje, nazwy tabel), polskie tylko w treściach user-facing i komentarzach biznesowych, jeśli potrzebne

## 3. Dostępność (a11y)

- Kontrast tekstu do tła zgodny z WCAG AA (min. 4.5:1 dla tekstu podstawowego)
- Pełna obsługa klawiatury - każda akcja (akceptuj/edytuj/odrzuć, przełącznik profilu, nawigacja) dostępna bez myszy
- `aria-label` na przyciskach z samą ikoną (bez widocznego tekstu)
- Formularze: każdy input ma powiązany `<label>`, komunikaty błędów czytelne dla screen readerów (`aria-describedby`)

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
