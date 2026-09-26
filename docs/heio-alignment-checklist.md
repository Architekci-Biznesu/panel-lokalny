# Checklist: Panel Lokalny → styl Heio 1:1

Źródło prawdy Heio: `heio-dashboard-ref/DESIGN.md` + `app/styles/ui.css`.
Stan PL: `app/globals.css`, `docs/panel-lokalny-zasady-aplikacji.md`.

Cel: ten sam look & feel co Heio (czarne CTA, fiolet tylko jako accent, te same rozmiary kontrolek/sekcji), bez kopiowania domeny Heio (CRM board, charty STL itd.).

---

## P0 - wizualne „odjechanie” (zrób najpierw)

### 1. Primary CTA = czarny, nie fiolet
- [x] `.ui-btn-primary` → `background: var(--primary); color: var(--primary-foreground)`
- [x] Hover primary → lekko jaśniejszy/ciemniejszy czarny (jak Heio), **nie** `--brand-deep`
- [x] Usunąć nadpisania `.wiz-page .ui-btn-primary` (też brand)
- [ ] Przejrzeć miejsca, gdzie „główna akcja” jest fioletowa poza `.ui-btn-primary` (linki CTA, big buttons w onboardingu „Dalej” jeśli mają zostać brand - decyzja produktowa: Heio = czarny)

### 2. Canvas background
- [x] `--background: #fafafa` (dziś `#f5f5f6`)
- [x] Zsynchronizować `.app-canvas-dots` / admin, żeby nie walczyły z nowym tłem
- [x] Zaktualizować `docs/panel-lokalny-zasady-aplikacji.md` jeśli w kodzie jest inaczej niż w docs

### 3. Tytuły sekcji jak Heio (~15px), nie 18px
- [x] `.ui-section-title` → `font-size: 0.9375rem` (albo `var(--type-md)` = 15px)
- [x] `.ui-section-desc` → `0.75rem` / `var(--type-xs)` (dziś często `--type-sm` 13px)

### 4. `ui-btn-sm` jak Heio
- [x] Height `1.75rem` (28px - już `--btn-height-sm`)
- [x] Font-size `0.8rem` (~12.8px), nie `var(--type-base)` 14px

---

## P1 - tokeny i kontrakt CSS

### 5. Alias brandu (opcjonalnie, pod Tailwind)
Heio: `--heio` / `--heio-deep` / `--heio-soft`.  
PL może zostać przy `--brand` **albo** dodać aliasy 1:1:

```css
--heio: var(--brand);
--heio-deep: var(--brand-deep);
--heio-soft: var(--brand-soft);
```

- [ ] Dodać aliasy **albo** przemigrować TSX/`text-brand` → `text-heio` (wybrać jedną ścieżkę)
- [ ] W `@theme` wystawić `heio` jeśli używasz klas Tailwind `bg-heio` itd.
- [ ] **Nie** przenosić `--stl` (pomarańcz Speed-to-Lead) - to produkt Heio, nie PL

### 6. Font variables jak Heio
- [ ] `next/font`: `variable: "--font-sans"` / `"--font-mono"` (dziś `--font-montserrat` / `--font-jetbrains-mono` + pośredni alias)
- [ ] Uprościć `:root` `--font-sans` / `--font-mono` do bezpośredniego mapowania

### 7. Typografia - uprościć skalę do Heio
Heio praktycznie: **14 / 12 / ~15** (+ H1 strony).  
PL ma 7 stopni + 13px.

Propozycja mapowania:

| Rola | Heio | Token PL docelowy |
|------|------|-------------------|
| H1 strony | ~24 (jeśli jest) | `--type-xl: 24px` |
| Tytuł sekcji | 15px | `--type-md: 15px` (używać w `.ui-section-title`) |
| Body / label / btn | 14px | `--type-base: 14px` |
| Meta / help / desc | 12px | `--type-xs: 12px` |
| Badge | ~10–12 | `--type-badge` lub xs |

- [ ] Przestać używać `--type-sm` (13px) w nowych miejscach; zamienić istniejące na `base` lub `xs`
- [ ] `--type-lg` (18px) ograniczyć do wyjątków marketing/auth, nie tytułów kart w panelu
- [ ] Zaktualizować komentarz skali w `:root` i docs

### 8. Radius theme
- [ ] Albo zostać przy `±2px` (PL), albo przejść na mnożniki Heio (`*0.6` / `*0.8` / `*1.4`) - **wybrać jedno** i trzymać konsekwentnie
- [ ] Karty/sekcje: `calc(var(--radius) + 2px)` - już zgodne z Heio

---

## P2 - biblioteka `ui-*` (braki względem Heio)

### 9. Dodać brakujące utility (jeśli używane w PL)
- [ ] `.ui-label` (14px / 500)
- [ ] `.ui-help` (12px / muted) - zamiast ad-hoc `auth-hint` / mieszanych desc
- [ ] Spójne `.ui-table` / `.ui-table-th` / `.ui-table-td` (Heio) vs obecne `.admin-table-wrap` / ad-hoc
- [ ] Switch ON = emerald `#10b981` (Heio), nie fiolet - sprawdzić `.wiz-hours-switch` i inne

### 10. Forma CSS: `@layer components` vs `@utility`
Heio: `@utility ui-*` (Tailwind v4).  
PL: `@layer components`.  

- [ ] **Nie trzeba** migrować wszystkiego na `@utility` od razu - działanie wizualne ważniejsze
- [ ] Nowe klasy `ui-*` pisać w tym samym stylu co reszta PL **albo** stopniowo przechodzić na `@utility` jak Heio (jeden PR architekturalny)

### 11. Rozbicie plików (opcjonalne, później)
- [x] `styles/ui.css` - same `ui-*`, `styles/tokens.css` - tokeny
- [x] Domena: po jednym pliku na moduł w `styles/` (`wizytowka.css`, `raporty.css`, `pulpit.css`...)
- [x] `globals.css` = importy + `@theme`; pilnuje tego `npm run lint:css`

---

## P3 - miejsca specjalne PL (nie kopiować ślepo Heio)

Zostawić jako wyjątki produktowe (nie istnieją w Heio):

- [ ] Auth / onboarding **split-screen** (duże H1 `clamp` / `1.75rem`) - Heio ma prostszy login; nie spłaszczać na siłę
- [ ] Gradienty brand w hero / `.app-canvas-dots` - OK jako atmosphere, byle tokeny `--brand*`
- [ ] Wizytówka Google (`.wiz-*`) - domena PL; po P0 tylko CTA/section titles
- [ ] Profile switcher / admin shell - po P0 te same btn/field/section

---

## P4 - docs i reguły Cursor

- [ ] Zaktualizować `.cursor/rules/agents.mdc`: primary CTA = `--primary` (czarny), fiolet = accent
- [ ] Zaktualizować `docs/panel-lokalny-zasady-aplikacji.md` (background `#fafafa`, primary buttons)
- [ ] Opcjonalnie: skopiować skrót `DESIGN.md` Heio jako `docs/design-system.md` z adnotacją „źródło: Heio, adaptacja PL”

---

## Kolejność wdrożenia (sugerowana)

1. **PR A (30–60 min):** P0.1 + P0.2 + P0.3 + P0.4 - od razu widać „to jest Heio”
2. **PR B:** typografia (P1.7) + font variables (P1.6)
3. **PR C:** `ui-label` / `ui-help` / switch emerald / spójność tabel
4. **PR D (opcjonalnie):** aliasy `--heio`, rozbicie CSS, migracja `@utility`

---

## Smoke test po zmianach

- [ ] Onboarding krok 1: „Dalej” wygląda jak Heio primary (czarny, chyba że świadomy wyjątek)
- [ ] Sidebar: nav active = muted bg, ikona active może zostać brand
- [ ] Wizytówka: „Akceptuj wszystkie” / primary actions = czarne
- [ ] Focus ring inputów = fiolet (`--ring`)
- [ ] Pill / badge brand = fiolet soft (accent OK)
- [ ] Karty `.ui-section` bez cienia, border 1px, radius `+2px`
- [ ] Porównanie side-by-side z Heio: settings section + tabela + primary button

---

## Świadomie NIE przenosić z Heio

- Tokeny / UI **STL** (pomarańcz)
- CRM board utilities (`ui-crm-*`)
- Chart palette jako wymóg (chyba że raporty GBP dostaną te same `--chart-*`)
- Sonner zamiast gooey-toast (PL ma własną decyzję feedbacku)
- Struktura folderów / auth multi-tenant Heio
