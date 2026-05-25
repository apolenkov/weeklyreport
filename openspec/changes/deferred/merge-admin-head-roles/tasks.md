# Tasks

- **ROLE-T1** — Audit all tRPC procedures and middleware chains; identify
  places where `role === "admin"` and `role === "head"` are tested separately.

- **ROLE-T2** — Consolidate role checks and update Zod enums in
  `packages/shared/src/schemas/roles.ts`.

- **ROLE-T3** — Update dev-login role selector in `apps/web` and
  `apps/api`.

- **ROLE-T4** — Update role-coverage gate (CI lint rule comparing middleware
  chains). Test: verify all procedures use a canonical middleware builder.

- **ROLE-T5** — Update tests and fixtures to remove "admin vs. head"
  distinctions where no longer relevant.

## Activation trigger

**Trigger:** Product decision to simplify role model OR when the team
explicitly requests this consolidation (e.g., during a permissions audit
phase).
