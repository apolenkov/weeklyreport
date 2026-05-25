# Tasks

- **DEACT-T1** — Add Prisma migration: `is_active` column with default
  `true`. Update `User` model.

- **DEACT-T2** — Create tRPC procedure `users.toggleActive()` with
  head-role-coverage middleware.

- **DEACT-T3** — Add deactivation logic to auth middleware: reject login if
  `user.isActive === false`.

- **DEACT-T4** — Add a toggle button component in user lists; wire to the
  tRPC procedure.

- **DEACT-T5** — Update tests: verify deactivated user cannot log in, and
  toggle appears in UI.

- **DEACT-T6** — Manual verification: deactivate a user, attempt login (expect
  rejection), reactivate, confirm login succeeds.

## Activation trigger

**Trigger:** User explicitly requests user deactivation feature OR team
prioritizes user lifecycle management improvements.
