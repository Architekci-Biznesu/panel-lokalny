# Panel Lokalny

Panel do zarządzania lokalną obecnością online (wizytówka Google, publikacje, opinie, CRM).

## Dokumentacja

| Plik | Rola |
|---|---|
| `.cursor/rules/agents.mdc` | Zasady dla AI (stack, design, bezpieczeństwo) - zawsze aktywne w Cursorze |
| `AGENTS.md` | Wskaźnik do powyższych zasad |
| `docs/panel-lokalny-production-plan.md` | Plan produktowy i kolejność faz |
| `docs/panel-lokalny-zasady-aplikacji.md` | Design system i zasady aplikacji |
| `cursor/faza-XX-*.md` | Specyfikacje kolejnych faz budowy |

## Setup lokalny

1. Skopiuj `.env.example` do `.env.local` (lub uzupełnij istniejący `.env.local`).
2. Uzupełnij co najmniej `DATABASE_URL` (Neon) i `AUTH_SECRET`.
3. Po Fazie 1: `npm install` i `npm run dev`.

`AUTH_SECRET` możesz wygenerować:

```bash
openssl rand -base64 32
```

## Stack (skrót)

Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui + Drizzle + PostgreSQL (Neon) + Auth.js v5.
