# Panel Lokalny - zasady dla AI (Cursor)

**Ten plik jest tylko wskaźnikiem, nie edytuj go.** Właściwe zasady projektu żyją w `.cursor/rules/agents.mdc` (Cursor Rules, format `.mdc` z `alwaysApply: true`) - Cursor wczytuje je automatycznie w KAŻDEJ sesji nad tym repo, bez potrzeby proszenia go o to.

Ten plik zostaje w korzeniu repo z dwóch powodów:
1. Pliki faz (`faza-XX-*.md`) i inne dokumenty projektu odwołują się do "AGENTS.md" po nazwie - to zostaje aktualne, bo faktyczna treść jest teraz w `.cursor/rules/agents.mdc`, a Cursor i tak ma ją zawsze w kontekście niezależnie od tego pliku.
2. `AGENTS.md` to też ogólnobranżowy standard (czytany przez część innych narzędzi AI poza Cursorem) - jeśli kiedyś użyjesz innego edytora AI na tym repo, ten plik wciąż działa jako fallback. Jeśli chcesz z tego korzystać, wklej tu treść `.cursor/rules/agents.mdc` (bez frontmattera YAML na górze).

Pełny kontekst produktowy: `docs/panel-lokalny-production-plan.md` i `docs/panel-lokalny-zasady-aplikacji.md`.
