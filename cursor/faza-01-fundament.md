# Faza 1 - fundament projektu

Przeczytaj najpierw `AGENTS.md` w tym repo - obowiązuje przy tym i każdym kolejnym zadaniu.

**Zakładany stan repo przed startem tej fazy** (setup zrobiony przeze mnie, nie Twoje zadanie): w korzeniu są `.cursor/rules/agents.mdc`, `AGENTS.md`, `README.md` i `.gitignore`, a w `docs/` leżą `panel-lokalny-production-plan.md` i `panel-lokalny-zasady-aplikacji.md`. Repo jest zainicjalizowane w gicie. Jeśli któregoś z tych plików nie widzisz na tych ścieżkach - zatrzymaj się i zapytaj, nie zgaduj ich treści i nie przenoś/nie reorganizuj plików samodzielnie.

**Konsekwencja dla punktu 1:** repo NIE jest puste, więc `create-next-app` może odmówić działania w korzeniu. W takim wypadku **nie usuwaj istniejących plików** - zainicjalizuj aplikację w tymczasowym podkatalogu i przenieś wygenerowane pliki do korzenia, zachowując wszystko, co już tam jest. Przy kolizji `.gitignore` scal zawartość obu plików, nie nadpisuj. `README.md` zostaw bez zmian.

## Cel

Postawić szkielet projektu: inicjalizacja, multi-tenancy w bazie (konto → profil → grupa publikacji), autentykacja, warstwa izolująca dane. Bez tego nic dalej nie da się bezpiecznie zbudować.

## Zakres

**1. Inicjalizacja projektu**
- `create-next-app` z App Router, TypeScript, Tailwind CSS 4, ESLint
- Instalacja: `drizzle-orm`, `drizzle-kit`, `zod`, `react-hook-form`, `@hookform/resolvers`, `next-auth@beta` (Auth.js v5), `gooey-toast`, `lucide-react`
- shadcn/ui: `npx shadcn@latest init`, dołóż podstawowe komponenty (button, input, dialog, dropdown-menu, avatar, tabs)
- Skopiuj tokeny z `AGENTS.md` do `app/globals.css`, podłącz fonty Montserrat + JetBrains Mono (Google Fonts, `next/font`)

**2. Schemat bazy (Drizzle, PostgreSQL)**

Tabele minimalne na start:

```
accounts        id, email, created_at, stripe_customer_id
users           id, account_id, email, name, password_hash, role (owner | member)
profiles        id, account_id, name, kind (local_business), created_at
publish_groups  id, account_id, name
profile_groups  profile_id (UNIQUE), group_id  (profil może być w jednej grupie na raz w MVP - UNIQUE na profile_id wymusza to na poziomie bazy, nie tylko konwencją w kodzie; struktura zostaje many-to-many pod przyszłe rozluźnienie tego ograniczenia)
```

`password_hash` - hasło hashowane (bcrypt/argon2, nie plaintext) trzymane bezpośrednio w `users`, bez osobnej tabeli `credentials` - to wystarcza na MVP z jednym providerem (email+hasło); jeśli w przyszłości dojdzie magic link/OAuth, credentials i tak mieszkają gdzie indziej (u providera), więc nie ma powodu rozdzielać tego teraz.

Każda kolejna faza dokłada własne tabele do tego schematu - nie twórz ich teraz na zapas.

**Baza danych (Neon)**: baza Neon już istnieje/zaraz powstanie - connection string trafi bezpośrednio do `.env.local` (nigdy do repo, nigdy hardcode'owany w kodzie czy w tym pliku, zgodnie z zasadą bezpieczeństwa z AGENTS.md o sekretach). Migracje Drizzle piszesz pod zwykły Postgres (Neon jest nim pod spodem) - nie zakładaj nic Neon-specyficznego poza connection stringiem. Dorzuć `.env.example` z placeholderem `DATABASE_URL=postgresql://user:password@host/dbname` dla każdego kto sklonuje repo bez dostępu do prawdziwej bazy.

**3. Auth.js v5**
- Provider: email+hasło na start (magic link/OAuth społecznościowe - do rozważenia później, nie blokuje MVP)
- Sesja zawiera `accountId` i `activeProfileId` (aktywny profil w cookie/sesji, zgodnie z sekcją 7.1 production-plan.md - profil NIE jest częścią URL)
- Strony: `/logowanie`, `/rejestracja` - w tej fazie mają **działać**, nie wyglądać docelowo. Zwykły, czysty formularz zgodny z tokenami wystarczy; pełny layout tych ekranów (dwukolumnowy, ze zdjęciem i paskiem zaufania) przychodzi w Fazie 2, więc nie inwestuj tu w wygląd, który zostanie przepisany

**4. Proxy (dawne middleware) - ochrona tras i izolacja**
- **Plik nazywa się `proxy.ts`, funkcja `proxy()` - nie `middleware.ts`/`middleware()`.** Next.js 16 zmienił tę nazwę, stara wywołuje ostrzeżenie o deprecacji. To czysta zmiana nazwy, zachowanie identyczne. Zachowaj wzorzec Auth.js: `export default auth((req) => { ... })` plus `export const config = { matcher: [...] }`
- Każda trasa poza `/logowanie` i `/rejestracja` wymaga sesji - `/onboarding` też jest chroniony (dzieje się zaraz po rejestracji, użytkownik ma już sesję, tylko nie ma jeszcze profilu)
- **Bramka onboardingu obejmuje wyłącznie trasy UI.** Przekierowanie "konto bez profilu → `/onboarding`" NIE może dotyczyć `/api/*` - inaczej wywołanie API przez konto bez profilu dostaje `307` zamiast właściwego kodu z handlera, co maskuje błędy i wywraca testy izolacji oczekujące `403`. Trasy API mają dochodzić do swoich handlerów i tam zwracać poprawny status
- Helper `getActiveProfile()` używany w KAŻDYM Server Action/query - zwraca profil TYLKO jeśli należy do aktywnego konta, inaczej rzuca błąd. To jest fundament pod zasadę bezpieczeństwa z AGENTS.md - napisz go raz, dobrze przetestuj, będzie używany wszędzie
- Nic poza tym helperem nie czyta `accountId` bezpośrednio z sesji (zasada z AGENTS.md) - w kolejnej fazie dochodzi tryb admina, który podmienia aktywne konto właśnie w tym jednym miejscu

**5. Layout aplikacji**
- Sidebar z nawigacją (grupy: Ogólne / Obecność online / Sprzedaż / Rozwój) - patrz `docs/panel-lokalny-production-plan.md` sekcja 7 na pełną listę pozycji i sekcja 7.1 na routing
- Przełącznik profilu w górnej części sidebara (na razie może pokazywać tylko jeden profil - reszta logiki grup dochodzi w kolejnej fazie)
- Puste, ale routowalne strony pod każdą pozycję nawigacji (placeholder "wkrótce") - żeby routing i layout były kompletne zanim dojdzie realna treść

## Kryteria akceptacji

- `npm run dev` odpala aplikację bez błędów
- Rejestracja → sesja → przekierowanie na `/onboarding` (placeholder na razie) działa end-to-end
- Próba wejścia na chronioną trasę bez sesji przekierowuje na `/logowanie`
- W repo istnieje `proxy.ts`, nie `middleware.ts`, a `npm run dev` nie wypisuje ostrzeżenia o deprecacji middleware
- Wywołanie `/api/*` przez zalogowane konto bez profilu dochodzi do handlera i zwraca jego kod błędu (np. `403`), a nie `307` z przekierowaniem na `/onboarding`
- Sidebar wygląda wizualnie zgodnie z tokenami z AGENTS.md (kolory, radius, fonty) - porównaj z makietą: https://claude.ai/artifact/Wn2ZrSXrAJ64WWwh28aFTY
- Test ręczny izolacji: dwa konta testowe, próba odwołania się do `profileId` należącego do cudzego konta przez API musi zwrócić błąd, nie dane
