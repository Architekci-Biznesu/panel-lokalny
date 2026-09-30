# Styl 4 - paczka handoff dla Cursora

Źródło prawdy wyglądu Panelu Lokalnego po redesignie "Styl 4" (indygo + koral, szare płótno, białe kafle r24, pigułki).
Style (tokeny, klasy `.ui-*`, nadpisania Wizytówki) są JUŻ w repo - etapy 1-5 niżej. Ta paczka opisuje to, czego CSS nie załatwi:
**układ, elementy i treści ekranów** (zmiany w JSX).

## Jak z tego korzystać (instrukcja dla Cursora)

1. **Obraz = cel.** `screens/*.png` to docelowy wygląd 1:1 (szerokość 1440 px). Zawsze otwórz PNG ekranu, nad którym pracujesz.
2. **HTML = wymiary.** `html/*.html` to wyrenderowany DOM makiety z inline stylami - stąd bierz dokładne px, gapy, rozmiary fontów i kolory.
   **Nie kopiuj inline stylów do komponentów.** Zamień je na tokeny z `styles/tokens.css` i klasy (`.ui-*`, `.wiz-*`, `.split-*`, ...). Brakujące klasy dopisz w pliku modułu w `styles/` (np. `styles/wizytowka.css`), w `@layer components`.
3. **Treści w nawiasach** (`[Nazwa firmy]`, `[data]`, `[n]`) to placeholdery - podstaw prawdziwe dane z istniejących propsów/loaderów. Stałe teksty (nagłówki, etykiety, przyciski, empty states) przepisz dosłownie.
4. **Nie zmieniaj logiki.** Server actions, loadery, typy, walidacja, API Google, BullMQ - bez zmian. Zmieniasz JSX, klasy i CSS. Jeśli makieta pokazuje daną, której nie ma w propsach - zostaw TODO w komentarzu i zgłoś, nie wymyślaj zapytań.
5. **Jedno zadanie = jeden commit** z prefiksem `Styl 4 - Zx:` (np. `Styl 4 - Z3: Wizytówka - Informacje`). Dzięki temu weryfikacja idzie zadanie po zadaniu.
6. Po każdym zadaniu: `npm run lint` i `npx tsc --noEmit` bez nowych błędów.
7. Myślnik `-`, nigdy em dash. Liczby, daty, kody, godziny, URL-e - `font-family: var(--font-mono)` (klasa `.mono`).

## Status - co już jest w repo (gałąź `redesign/styl-4`)

| Etap | Commit | Zakres |
|---|---|---|
| 1 | `137ed21` | Tokeny P4 w `globals.css`, Geist + JetBrains Mono (`app/layout.tsx`), kolory toastów, logo PL-3 (`features/shell/brand-logo.tsx`), kolory wykresów (`REPORT_COLORS`) |
| 2 | `c6393d9` | Komponenty `.ui-*`: pigułkowe przyciski 36/32, `.ui-btn-secondary`, pola-pigułki, select r999 + menu r16, checkbox, karty r24 z cieniem, pille 22 px |
| 3 | `9148d58` | Górny navbar zamiast sidebaru (`app-shell.tsx`, `nav-config.ts`, `profile-switcher.tsx` variant `navbar`), nagłówek Wizytówki, `.ui-btn-white`, h1 40/400 |
| 4a | `95ca675` | Split-screen logowania/rejestracji/onboardingu (formularz lewo, zdjęcie prawo), "Krok 1/3" koralowa pigułka, segment `path-toggle` |
| 4b | `19b97f8` | Blok CSS "Styl 4 - Wizytówka": karty, subnav, pola, porównanie AI, luki, dni specjalne, atrybuty, mapa pozycji |
| 5 | `37c1b9c` | Usunięte martwe reguły CSS, `CharCount` przy nazwie (100) i opisie (750) |

Zadania Z1-Z10 (niżej) są zrobione i zweryfikowane: Wizytówka (wszystkie zakładki), Raporty z mapą pozycji, logowanie, rejestracja, onboarding, Pulpit. Potem: porządki w CSS i podział stylów na pliki w `styles/` (mapa plików i zasady: `.cursor/rules/agents.mdc`, sekcja Design system).

Otwarte: Pulpit - "Ostatnie publikacje" i "Nowe opinie" czekają na dane z modułów Publikacje i Opinie (TODO w `features/pulpit/pulpit-view.tsx`).

## Assety w repo

- `public/images/textures/v4-halftone.svg` - tekstura siatki kresek (zanika od prawego dolnego rogu). Tło kafli "promocyjnych" (obecnie nieużywana w aplikacji; kafel NAP ma styl kart propozycji).
- `public/images/auth/lokalny-przedsiebiorca.jpg` - zdjęcie do prawej części logowania/rejestracji/onboardingu.
- Logo PL-3 - komponent `BrandLogo` (`features/shell/brand-logo.tsx`), nie osobny plik.

---

## 1. Fundamenty

Plik: `screens/01-fundamenty.png`. Wszystko jest w `styles/tokens.css` - używaj zmiennych, nie hexów.

**Kolory**

| Token | Wartość | Użycie |
|---|---|---|
| `--brand` | `#4f46e5` | marka, aktywne ikony, wykres "Mapy"/"Telefon", badge "Ty" |
| `--brand-deep` | `#3730a3` | tekst na jasnym indygo, hover linków |
| `--brand-soft` | `#a5b4fc` | druga seria wykresów, akcenty |
| `--brand-50` / `--brand-100` | `#eef2ff` / `#e0e7ff` | tło "Dlaczego ta zmiana", pill "Propozycja AI", zaznaczony wiersz |
| `--warning` | `#f26b3a` | koral - akcent: "Krok 1/3", kropki niezapisanych zmian, CTA-strzałki w kafelkach AI, seria "Dojazd" |
| `--warning-foreground` / `--warning-soft` | `#e5582b` / `#fef0eb` | banery luk, tekst ostrzeżeń |
| `--canvas` / `--canvas-strong` | `#f5f5f5` / `#ebebeb` | tło strony / tło kafli drugorzędnych (placeholder, NAP-status) |
| `--card` | `#ffffff` | kafle |
| `--foreground` | `#0a0a0a` | tekst |
| `--primary` | `#171717` (hover `#2e2e2e`) | główne CTA - czarne pigułki |
| `--muted-foreground` | `#737373` | opisy, etykiety pól, nieaktywne taby |
| `--border` | `#e5e5e5` | separatory wierszy (kafle NIE mają obramowania) |
| `--destructive` / `--success` / `--info` | `#e7000b` / `#16a34a` / `#6366f1` | statusy |

**Radiusy:** pigułka `999px` (przyciski, pola, pille, segmenty, taby-chipsy) - kafel `24px` (`--radius-card`) - blok wewnętrzny `16px` (`--radius-block`: textarea, porównanie AI 20, menu selecta) - mały `10px` (ikony w kwadracie, inicjały katalogów).

**Cień kafla:** `--shadow-card` = `0 1px 2px rgba(0,0,0,.04), 0 12px 32px -16px rgba(0,0,0,.10)`. Kafle bez `border`.

**Typografia (Geist):** H1 strony 40/400, H2 sekcji 28/400, tytuł kafla 20/400, body 14, meta 12, badge 10-11. Duże liczby KPI 40-48/400 w JetBrains Mono.

**JetBrains Mono** dla: liczb (KPI, liczniki, oceny, pozycje), dat i godzin, telefonów, kodów pocztowych, URL-i/domen, liczników znaków `186 / 750`, badge'y z liczbą na tabach, "Krok 1/3", zakresów dat. Nie dla: nagłówków, etykiet, treści.

**Layout strony w aplikacji:** navbar 76 px (padding 0 32), `main` padding `16px 32px 40px`, pionowy gap sekcji 28, gap siatek kafli 24. Nagłówek strony: H1 + podtytuł 14 muted po lewej, akcje (pigułki) po prawej wyrównane do dołu.

## 2. Komponenty

Plik: `screens/02-komponenty.png` + `05-toasty.png`. Klasy już istnieją - ten ekran to katalog do porównania.

- **Przyciski** `.ui-btn` pigułka 36 px (`-sm` 32): `-primary` czarny, `-secondary` szary `#f5f5f5`, `-white` biały (na szarym płótnie), `-outline`, `-ghost`, `-danger`. Ikona 16 px, gap 8. Okrągły przycisk-ikona 32-40 px (ołówek, zamknij X - czarny).
- **Pola** `.ui-field`/`.ui-select` pigułki 40 px, `.ui-textarea` r16. Licznik znaków pod polem po prawej `.wiz-char-count` (mono 11, koral od 95%).
- **Pille statusu** `.ui-pill` 22 px z kropką: success zielona, warn koral, neutral szara, info indygo.
- **Badge liczby** na tabie: czarne kółko 18 px, biała cyfra mono.
- **Pill "Propozycja AI"**: tło `--brand-50`, tekst `--brand`, ikona iskierki.
- **Segment** (Tak/Nie, 5/10/15 km, okres): szary tor pigułka, aktywny element czarny z białym tekstem.
- **Toasty** gooey-toast - kolory już podpięte w etapie 1.

---

## Zadania (Z1-Z10)

Kolejność sugerowana. Przy każdym: pliki do zmiany, co zbudować, stany, kryteria akceptacji.

### Z1. Wizytówka - wspólna góra (karta podglądu + kompletność + propozycje AI)

Ref: `screens/04a-wizytowka-informacje.png` (górna część, do tabów). Na pozostałych planszach 04b-04f ten blok jest zastąpiony szarym placeholderem - na wszystkich zakładkach wygląda tak samo jak w 04a.

Pliki: `app/(app)/(wizytowka)/wizytowka/layout.tsx`, `features/wizytowka/components/gbp-preview-card.tsx`, `proposal-cards.tsx`.

- **Rząd 1, siatka 2 kolumny (~2/3 + 1/3), gap 24:**
  - **Karta podglądu** (kafel r24, padding 24): po lewej zdjęcie 240×180 r16 (kolaż/placeholder `[Zdjęcie]` na `--canvas-strong`); po prawej nazwa firmy 22/400, kategoria główna 12 muted, pille `Google Business Profile` + `[Miasto]`, na dole 3 kolumny faktów oddzielone pionową kreską: `Adres` / `Telefon` / `Strona WWW` (etykieta 11 muted, wartość mono 13). W prawym górnym rogu okrągły przycisk ↗ (otwiera wizytówkę w Google).
  - **Kompletność profilu** (kafel): tytuł "Kompletność profilu" + wynik `7/10` mono 28 (mianownik muted). Pasek z pionowych kresek (40 kresek; wypełnione czarne, 3 ostatnie wypełnione w koralu, reszta `#e5e5e5`). Pod spodem 2 kolumny checklisty (10 pozycji: Nazwa, Opis, Strona, Godziny, Zdjęcia | Kategoria, Telefon, Adres, Usługi, Atrybuty) - spełnione: czarne kółko z ✓, niespełnione: szare kółko i tekst muted. Dane z `computeCompleteness`.
- **Rząd 2 - "Propozycje AI do Twojej decyzji"** + badge liczby; po prawej `Przejrzyj po kolei` (`.ui-btn-white`) i `Akceptuj wszystkie` (`.ui-btn-primary`).
  - Siatka 5 kafli (auto-fit, min 200 px), każdy: ikona w kwadracie r10 (kolor brand; dla luk - koral), pill kategorii w prawym górnym rogu (`Informacje`/`Atrybuty`/`Google`), tytuł 16, opis 12 muted (max 3 linie), na dole pigułka-CTA na szarym tle z tekstem i okrągłą strzałką po prawej (czarna dla propozycji AI, koralowa dla luk/akcji).
  - Brak propozycji: kafle znikają, zostaje nagłówek + tekst "Brak propozycji - wizytówka jest aktualna".
- Toast "Zmiana zapisana w Google" pokazany na makiecie w prawym górnym rogu to gooey-toast - nie budować osobno.

Akceptacja: blok identyczny na wszystkich 6 zakładkach; na <1100 px kompletność pod kartą podglądu; na <640 px kafle propozycji w 1 kolumnie.

### Z2. Wizytówka - Informacje

Ref: `04a-wizytowka-informacje.png` (od tabów w dół). Pliki: `informacje-editor.tsx`, `outside-gaps.tsx`, `inline-suggestion.tsx`, `suggestion-display.tsx`, `categories-suggestion.tsx`, `location-nap-fields.tsx`, `godziny-view.tsx`.

- Nagłówek sekcji "Informacje o firmie" (H2 28) + "Kliknij ołówek, aby edytować. Propozycje AI są wyróżnione przy polach."
- **Banery luk** (`outside-gaps.tsx`) w **siatce 2 kolumn**: tło `--warning-soft`, r16, ikona ! koral, tytuł 13/500, opis 12, link-akcja po prawej ze strzałką (`Otwórz w Google ›`, `Sprawdź status ›`).
- **Jeden kafel z listą pól** - każdy wiersz to grid `180px | 1fr | 40px` (etykieta muted 13 / wartość / okrągły ołówek), separator `border-bottom` między wierszami. Kolejność: Nazwa firmy, Kategorie, Opis, Status, Data otwarcia, Telefon, Adres, Obszar obsługi, Witryna.
- **Pole z propozycją AI** (Kategorie, Opis): zamiast ołówka pill "Propozycja AI" nad wartością; blok porównania r20 z obramowaniem: 2 kolumny `Obecnie` | `Po zmianie` (etykieta "Po zmianie" w `--brand`); pod nimi pas "Dlaczego ta zmiana" na `--brand-50` z ikoną; pod blokiem po prawej `Popraw` (white+outline), `Odrzuć` (ghost z X), `Akceptuj` (primary z ✓).
  - Kategorie: chipsy; główna czarna z gwiazdką; dodane zielone `+`, usunięte czerwone przekreślone.
  - Opis: licznik mono z mini-paskiem `186 / 750` nad każdą kolumną.
- **Tryb edycji pola** (przykład: Adres): wartość zamienia się w szary blok r16 z polami-pigułkami (Ulica i numer, Miasto, Kod pocztowy mono, Województwo), notka 11 muted i `Zapisz w Google` (primary sm); ołówek zmienia się w czarne kółko X.
- Telefon: wartość mono + pill `+1 dodatkowy`. Status: pill z kropką. Obszar obsługi: czarny chip trybu (`Lokal + dojazd do klienta`) + szare chipsy miejscowości + `+3`.
- **Pod kafelkiem 2 kafle obok siebie:** `Godziny otwarcia` (wiersze dzień / godziny mono, dzień zamknięty muted "Zamknięte", ołówek w nagłówku) i `Dni specjalne` (lista: kafelek daty 40×40 z dniem mono i skrótem miesiąca, nazwa święta + dzień tygodnia, po prawej godziny mono albo pill `Zamknięte`; minione wyszarzone z dopiskiem "minione"; `+` w nagłówku).

Akceptacja: żadnej "karty w karcie" poza blokiem porównania i trybem edycji; ołówek ukryty, gdy pole ma oczekującą propozycję.

### Z3. Wizytówka - Usługi

Ref: `04b-wizytowka-uslugi.png`. Plik: `uslugi-editor.tsx`.

- Stan "propozycja AI": ten sam wiersz-pole co w Z2 - porównanie list usług (`Obecnie` z licznikiem mono 3 | `Po zmianie` 4), nazwa 14 + opis 12 muted, nowa usługa z `+`.
- Stan "edycja listy": kafel z nagłówkiem `Usługi` + badge liczby + "Edycja - zmiany trafią do Google po zapisaniu" + czarne X. **Siatka 2 kolumn** kart usług (obramowanie 1 px, r20): pole nazwy (pigułka) + kosz (okrągły), textarea opisu, licznik `38 / 250` mono. Stopka kafla (na `--canvas` lub separator): select `Dodaj ze słownika Google...`, `+ Dodaj własną` (secondary), po prawej `Anuluj` + `Zapisz w Google`.

### Z4. Wizytówka - Kontakt

Ref: `04c-wizytowka-kontakt.png`. Plik: `kontakt-editor.tsx`.

- Nagłówek + po prawej notka muted "Główna witryna jest w zakładce Informacje".
- Jeden kafel, wiersze jak w Z2: Facebook, Instagram, YouTube, LinkedIn, TikTok, X (Twitter), Pinterest, Link do rezerwacji. Wartość URL mono + ikonka ↗; pusty = `-` muted.
- Edycja: szary blok r16 z polem-pigułką (URL mono), `Wyczyść` (ghost) + `Zapisz w Google`.
- Stopka pod kaflem 11 muted: "Pola to atrybuty URL z Google - lista zależy od kategorii wizytówki. Puste pole i „Zapisz w Google" usuwa link."

### Z5. Wizytówka - Atrybuty

Ref: `04d-wizytowka-atrybuty.png`. Plik: `atrybuty-view.tsx`.

- Grupy jako osobne kafle w **2 kolumnach (masonry: kolumna lewa / prawa)**: Dostępność, Płatności | Udogodnienia, Planowanie, Inne (z podtytułem sekcji np. "Oferta").
- Wiersz: etykieta 13 + po prawej segment `Tak | Nie` (aktywny czarny; brak wartości = oba szare). Atrybuty wyboru (np. Wizyty) - `UiSelect` pigułka. Zmieniony, niezapisany wiersz - **koralowa kropka** przed segmentem.
- **Sticky pasek na dole** (czarny, pigułka, pełna szerokość treści, `position: sticky; bottom: 24px`): koralowa kropka + "N niezapisane zmiany" po lewej; `Anuluj` (ciemnoszary) + `Zapisz w Google` (biały) po prawej. Widoczny tylko gdy N > 0.
- Tryb podglądu (bez edycji): te same grupy, wartość tekstem "Tak / Nie / Brak". Przełączenie trybu - czarne kółko X przy nagłówku.

### Z6. Wizytówka - NAP i katalogi

Ref: `04e-wizytowka-nap.png`. Plik: `nap-view.tsx`.

- Siatka `2fr | 1fr`, gap 24.
- **Lewy kafel "Katalogi"**: w nagłówku po prawej 3 pille-podsumowania (`3 opublikowane` zielona kropka, `2 w trakcie` koral, `2 oczekuje` szara). Wiersz: kwadrat r10 z inicjałami (mono 11, `--canvas`), nazwa 14/500, URL mono 11 muted + ↗, po prawej pill statusu.
- **Prawy kafel "Więcej wpisów"** jak karty propozycji: biały, bez ikony: napis `USŁUGA AGENCJI` (indygo, po prawej zielony pill `Zgłoszono` po zgłoszeniu), tytuł 18 "Twoja firma w 50 katalogach", opis 13 „W Twoim pakiecie publikujemy 5 wpisów miesięcznie. Chcesz szybciej? Dokup dodatkowe katalogi.”, licznik `x/50` z 50 kreskami jak pasek kompletności (indygo opublikowane, koral w trakcie), szara pigułka `Przyspiesz - dokup katalogi` z czarną strzałką, notka (stan zgłoszenia) jako szara stopka przyklejona do dołu.

### Z7. Wizytówka - Raporty + Mapa siatki pozycji

Ref: `04f-wizytowka-raporty.png`, `--kalendarz.png`, `--dodawanie-frazy.png`. Pliki: `raporty-view.tsx`, `raporty-charts.tsx`, `date-range-picker.tsx`, `rank-positions-section.tsx`, `rank-map.tsx`, `rank-scan-calendar.tsx`, `rank-local-pack-table.tsx`.

**Raporty:**
- Nagłówek "Raporty wizytówki" + zakres dat mono pod spodem; po prawej pigułka-przycisk z ikoną kalendarza i zakresem mono. Kliknięcie - popover r24 z dwoma miesiącami i presetami (`--kalendarz.png`).
- **3 kafle KPI**: `Wyświetlenia wizytówki` (liczba mono 40, pod nią paski Mapy / Wyszukiwarka z wartością i % mono, stopka Mobile/Desktop), `Akcje klientów` (Dojazd koral / Telefon indygo / Witryna indygo-300), `Akcje na 100 wyświetleń` (liczba + opis + wskaźnik z 20 kresek).
- **2 wykresy słupkowe stacked** (tygodniowo) w kaflach, legenda z kropkami i wartościami mono w nagłówku. Kolory z `REPORT_COLORS`. Słupki zaokrąglone u góry.
- Pusty okres: "Brak danych w wybranym okresie".

**Mapa siatki pozycji** (pod separatorem):
- H2 z ikoną mapy + podtytuł "Pozycja w Mapach Google w siatce 5×5 wokół firmy · max 10 fraz · 1 skan frazy dziennie".
- **4 kafle KPI**: AGR (śr. pozycja), ATGR (% w top 3), Frazy kluczowe `3 / 10`, Wyszukiwarka `poz. 2`; ikona w kółku w prawym górnym rogu, delta w małej pill (zielona/szara).
- Siatka `8 | 4` kolumny:
  - **Lewa:** frazy jako **chipsy NAD mapą** (aktywna czarna z promieniem mono i X; nieaktywne białe) + chip/przycisk `+ Dodaj frazę`. Po kliknięciu (`--dodawanie-frazy.png`) **inline formularz w tym samym rzędzie**: pole-pigułka "np. dentysta Warszawa" + segment `5 km / 10 km / 15 km` + czarne ✓ + X. Pod spodem mapa (kafel r24, Leaflet), piny-kółka z pozycją (kolory kubełków: 1-3 `#22c55e`, 4-10 `#8dc505`, 11-15 `#ffc211`, 16-20 `#f87305`, 21+ `#cd2b2e`), środek z obwódką brand + tooltip "Twoja firma · punkt środkowy". Legenda-pigułka w lewym dolnym rogu mapy. Pod mapą: meta skanu mono + `Skanuj teraz` (primary sm).
  - **Prawa: "Historia skanów"** - kalendarz miesiąca w kaflu: dni ze skanem - szare tło + kropka brand, wybrany - czarny; pod kalendarzem podsumowanie skanu na `--canvas` r16 (Punkty siatki `25 + 1`, Zasięg `5 km`, Poza top 20 `1` - wartości mono).
  - **Ranking w wyszukiwarce Google** (lewa kolumna, pod mapą): tabela #, Firma, Ocena (★ mono), Opinie (mono); wiersz własnej firmy na `--brand-50` z badge `Ty`; w nagłówku pill "Twoja pozycja: 2".
- **Stany** (dół planszy): brak danych (ikona, tekst, inline formularz frazy), skan w toku (siatka kropek brand + `Trwa pobieranie pozycji w siatce... 11 / 26` + wyłączony przycisk), limit dzienny (szary przycisk + tekst), błąd identyfikacji (koralowy/czerwony blok + `Pobierz ponownie z Google`), pusty Local Pack (tekst).

Akceptacja: frazy nigdy pod mapą; max 10 fraz (przy 10 przycisk `Dodaj frazę` wyłączony z tooltipem); kolory pinów semantyczne, nie brand.

### Z8. Logowanie i rejestracja

Ref: `06-logowanie.png`, `--blad.png`, `07-rejestracja.png`, `--blad.png`. Pliki: `features/shell/split-screen.tsx`, `split-hero-decor.tsx`, `features/auth/auth-forms.tsx`.

- Układ już jest (etap 4a). Do zrobienia: **prawy kafel** - zamiast karuzeli 3 obrazków jedno zdjęcie `lokalny-przedsiebiorca.jpg` (object-fit cover, fokus na twarzy, indygo tint od góry), headline 52/300 biały + lead.
- **Logowanie** - nad zdjęciem pływające białe karty-ilustracje (r16, cień): Wizytówka (kompletność), Strona WWW, Kampania SMS, CRM kanban, opinia z gwiazdkami - rozmieszczenie jak na PNG (nie zasłaniają twarzy).
- **Rejestracja** - 3 karty kroków ułożone równo na dole prawego kafla: `01 Konto` (Imię, e-mail i hasło · `30 s`), `02 Brief od AI` · `1 min`, `03 Wizytówka Google` · `1 min`; numer w kwadracie r10 (pierwszy czarny, reszta `--brand-50`), czasy mono.
- Obie: pill tematu na górze prawego kafla (`Panel dla lokalnych firm` / `3 kroki, ok. 3 minuty`), na dole social proof: stos 3 awatarów + `+300 klientów` | `4.9/5 · 209 opinii Google` (mono).
- Formularz: u góry logo PL-3 + "PANEL LOKALNY" i po prawej "Nie masz konta? [Zarejestruj się]" (secondary sm); H1, lead, pola-pigułki z etykietą (hasło z ikoną oka), `Zaloguj się` primary pełna szerokość, link pod przyciskiem; stopka © 2026 Architekci Biznesu + Regulamin, Polityka prywatności. Bez przycisku Google na makiecie.
- Błąd: pole z czerwonym obrysem + komunikat 12 pod polem + baner r16 nad przyciskiem (jak `--blad.png`).
- <900 px: tylko kafel formularza.

### Z9. Onboarding 1-3

Ref: `08-onboarding-1-firma.png` (+ `--przygotowuje`), `09-onboarding-2-brief.png` (+ `--modal`), `10-onboarding-3-google.png` (+ `--niepolaczono`). Plik: `features/onboarding/onboarding-wizard.tsx`.

- Wspólne: ten sam split co Z8, w prawym górnym rogu formularza użytkownik (imię, e-mail mono 11, awatar z inicjałami). Pill `Krok N/3` koral. Nawigacja na dole: `← Wstecz` (white), akcja dodatkowa (ghost z ikoną), `Dalej →` (primary).
- Prawy kafel: pill tematu (np. "Brief od AI"), headline 52/300, lead, 1-2 białe karty z podglądem tego, co powstaje w danym kroku.
- **Krok 1 - Firma**: "Masz stronę internetową?", segment `Mam stronę WWW | Nie mam strony`, pole URL mono + podpowiedź 11 muted, przycisk `Dalej` po prawej. Stan `przygotowuje` - przycisk szary z loaderem "Przygotowuję...". Prawy kafel: pigułka z domeną + "Czytam stronę" i karta "Brief od AI" ze skeletonami pól.
- **Krok 2 - Brief od AI**: 4 pola z ikoną w etykiecie (Usługi, Ton komunikacji, Grupa docelowa, Czym się wyróżniasz) - auto-resize textarea r16. `Wygeneruj ponownie` otwiera modal r24: tytuł, opis, textarea "Co zmienić lub dodać?", `Anuluj` + `Wygeneruj ponownie` (primary z iskierką); tło przyciemnione.
- **Krok 3 - Google**: połączono = zielony ✓ "Połączono z Google - wybierz lokalizacje do połączenia", szukajka-pigułka, lista wizytówek **bez szarej ramki wokół listy** - każdy wiersz osobna pigułka r16 z checkboxem (zaznaczone mają czarny obrys), nazwa 13 + adres mono 11; pod listą "Jak połączyć te lokalizacje?" (`UiSelect`) + nazwa grupy; `Podłącz profile (2)` primary z licznikiem mono. Prawy kafel: karta "Profil Firmy w Google · Połączono" z podglądem wizytówki i karta "Pobierzemy z Google" z chipsami. Niepołączono = `google-connect-btn` (white pill z logo Google) + opis (patrz `--niepolaczono.png`).

### Z10. Pulpit

Ref: `03-pulpit.png`. Plik: `app/(app)/pulpit/page.tsx` (dziś `PlaceholderPage`) - nowe komponenty w `features/pulpit/`.

- Siatka 12 kolumn, gap 24. Rząd 1: Widoczność (span 7) + Ostatnie publikacje (span 5). Rząd 2: Nowe opinie (span 3) + Automatyczne publikacje (span 4) + Stan wizytówki (span 5).
  - **"Widoczność wizytówki"** (kafel): ikona w kółku + tytuł 32/400 + opis; select-pigułka okresu `Tydzień` w prawym górnym rogu. Po lewej na dole duża zmiana `[+x%]` mono 40 + "Ten tydzień vs poprzedni". Po prawej wykres "lollipop": pionowe kreski z kropką brand, aktywny dzień czarny z tooltipem `[wartość]` i tłem kolumny, dni `Pn...Nd` w kółkach (aktywny czarny).
  - **"Ostatnie publikacje"** (bez kafla - lista na płótnie): nagłówek + `Zobacz wszystkie`. Wiersze: ikona dokumentu w kwadracie r10 (koral = do akceptacji, czarny = opublikowano, szary = szkic, brand = zaplanowano), tytuł, pill statusu z kropką, "Google · [data]", chevron w kółku. Pierwszy rozwinięty: chipsy (`Post`, `Wygenerowane przez AI`), 2 linie treści, meta muted, `Akceptuj` (primary sm) + `Edytuj` (white sm).
  - **"Nowe opinie"** (bez kafla): lista kart-pigułek r16 z awatarem-inicjałami, autorem, badge oceny (czarny 5★ / koral 3★), "Czeka na odpowiedź", okrągły `+`.
  - **"Automatyczne publikacje"** (kafel `--canvas-strong` z teksturą halftone): tytuł, opis, biała pigułka `Zobacz w Sklepie ›`.
  - **"Stan wizytówki"** (kafel): 3 metryki w siatce 3 kolumn z pionową kreską po lewej: Kompletność profilu `7/10`, Propozycje AI `5` (kreski koral), Nowe opinie `[n]` - liczby mono 28 + mini-wykres z kresek; w nagłówku `Ostatnia analiza: [data]` z ikoną kalendarza.
- Dane: podepnij istniejące loadery (GBP performance, publikacje, opinie, completeness). Tam gdzie loadera brak - komponent z pustym stanem + TODO.

---

## Checklista weryfikacji (sprawdzam po każdym Zx)

- [ ] Porównanie zrzutu 1440 px z `screens/*.png` - układ, odstępy, kolejność elementów.
- [ ] Brak hexów i px-radiusów inline w TSX - tylko tokeny/klasy.
- [ ] Liczby, daty, URL-e w mono; nagłówki i etykiety w Geist.
- [ ] Kafle bez obramowań, z `--shadow-card`, r24; brak "karty w karcie".
- [ ] Przyciski tylko `.ui-btn*`; główne CTA czarne; koral tylko jako akcent.
- [ ] Wszystkie stany z plansz (`--*.png`) obsłużone.
- [ ] Responsywność: 1280 (drawer navbaru), 1100, 900, 640.
- [ ] `npm run lint` i `npx tsc --noEmit` bez nowych błędów; logika i server actions bez zmian (`git diff --stat` tylko TSX/CSS).

## Pliki w paczce

```
docs/design/styl-4/
  README.md                ten plik
  screens/                 PNG 1440 px - cel wizualny (w tym warianty stanów "--*.png")
  html/                    statyczny DOM makiet z inline stylami - źródło wymiarów
public/images/textures/v4-halftone.svg
public/images/auth/lokalny-przedsiebiorca.jpg
.cursor/rules/styl-4.mdc   reguła Cursora - wskazuje tę paczkę przy pracy nad UI
```
