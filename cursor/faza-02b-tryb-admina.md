# Faza 2b - panel admina (wejście w konto klienta)

Zaimplementowane zgodnie z instrukcją fazy w czacie / `docs/panel-lokalny-production-plan.md`.

## Flaga staff

```sql
UPDATE users SET is_staff = true WHERE email = 'twoj@architekcibiznesu.pl';
```

Czytana z bazy przy każdym sprawdzeniu - nie siedzi w JWT.

## Migracja

`drizzle/0003_admin_staff.sql`: `users.is_staff`, `accounts.last_active_at` (aktualizacja przy logowaniu).
