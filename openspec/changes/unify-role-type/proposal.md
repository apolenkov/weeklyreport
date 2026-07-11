## Why

The role vocabulary (`lead`/`head`/`admin`/`viewer`) has TWO deliberate Zod
sources of truth in `packages/shared` (`roleSchema` → `DbRole` for the
persistence axis, `sessionRoleSchema` → `Role` for the session axis, kept as
separate aliases so the axes can diverge later) — but `DbRole` has zero
consumers and the full literal union is re-declared across the workspace:
11 production sites (9 web, 2 api), 8 unit-test fixtures, plus seed and e2e
mirrors. The backlog names the dev role switcher's duplicate `Role` list as
an open cleanup; reconnaissance plus a two-seat council (deep-reasoning
adviser + Codex, verifying independently) found the switcher is only one of
four bare duplicate exported types.

## What Changes

- Convert every full-union re-declaration in web/api source to the shared
  type, split by axis: `Role` for session state (session-provider, last-role,
  login session guards, `CurrentRole = Role | null`), `DbRole` for
  persistence-derived values (admin user models, every `authorRole` mirror of
  the wire read model, the dev role switcher's Prisma-sourced rows and the
  dev-login request helpers).
- Delete the four bare duplicate exported types (`UserRole` ×2,
  login-page `Role`, `LastRole`); consumers import from shared. Meaningful
  compositions and deliberate UI subsets stay.
- Type `ROLE_LABEL` as `Record<Role | DbRole, string>` (it serves both axes),
  `ROLE_ORDER` as `readonly DbRole[]` with a completeness type test,
  `DEV_EMAIL_FOR_ROLE` as `Record<DbRole, string>`.
- Runtime guards keep their literals (type-position-only change); new parity
  tests pin `isRole` and last-role storage against `sessionRoleSchema.options`.
- Add a `DbRole` ↔ Prisma `$Enums.Role` identity test (the
  `report-status-type` pattern).
- Reduce the two Prisma seed unions to the one documented toolchain mirror;
  e2e stays self-contained (isolated tsconfig, no workspace resolution).
- Update `architecture-refactor-backlog`: the switcher cleanup closes,
  follow-ups are named with corrected inventory.

Non-goals:

- No runtime behavior change anywhere; no DB or payload change.
- The two Zod enums in `auth.ts` stay verbatim — the rule is one literal home
  PER AXIS, not one home total.
- Role-label drift (nav "Group Head", users-tab option labels, RoleBadge raw
  token, dashboard string-widened roles) is a named follow-up, not folded in.
- The api auth bridge seams (`roles.guard.ts` validating sessions with the DB
  schema, Prisma-typed provisioning/dev-login inputs) stay untouched — named
  follow-up; changing an authz-adjacent file is not a type-only edit.
- No lint gate in this change (stays merged with the standing literal-union
  gate follow-up).

## Capabilities

### New Capabilities

- `role-type`: Defines the two-axis shared role type contract
  (`Role`/`DbRole`), its per-axis single-literal-home rule, and the DB
  identity pin.

### Modified Capabilities

- `architecture-refactor-backlog`: Records the role-vocabulary unification as
  closed with corrected inventory and named follow-ups.

## Impact

- `packages/shared`: one type annotation widened (`ROLE_LABEL`); no schema or
  value changes.
- `apps/api`: 2 source files, 1 new identity test, 6 test fixtures.
- `apps/web`: 9 source files, 2 test fixtures, new parity tests.
- `prisma`: comment + type derivation only; seeded values unchanged.
- No API surface, database, dependency, route, or UI behavior changes.
- Gates: `pnpm --filter @customreport/api db:generate`, `pnpm typecheck`,
  `pnpm lint`, `pnpm test`, `pnpm format:check`, residual-union sweep, and
  OpenSpec strict validation.
