# Panel Lokalny

Zasady projektu obowiązują w każdej sesji, niezależnie od zadania. Jedno źródło prawdy dla Cursora i Claude Code - nie kopiuj ich tutaj, edytuj pliki poniżej:

@.cursor/rules/agents.mdc

Wygląd (Styl 4) - przy każdej zmianie JSX, klas, plików w `styles/`:

@.cursor/rules/styl-4.mdc

Pliki faz leżą w `cursor/faza-XX-*.md`. Gdy zadanie odwołuje się do "AGENTS.md", chodzi o zasady zaimportowane wyżej.

Przed zakończeniem zadania: `npm run lint`, `npx tsc --noEmit`, `npm run lint:css`, `npm run format:check` oraz testy `npm run test:*` dotyczące zmienianego modułu.
