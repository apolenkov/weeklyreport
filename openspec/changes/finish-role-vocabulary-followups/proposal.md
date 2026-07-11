## Why

`unify-role-type` (2026-07-11) unified the role vocabulary behind two shared
Zod types and named five deferred follow-ups in the `architecture-refactor-backlog`
spec. `unify-role-label-presentation` closed two of them (role-label
presentation, schema-derived membership guards) but did not update the backlog
spec's text, and three follow-ups stayed open in code:

- The api auth bridge still types dev-login/provisioning internals with
  Prisma's `Role` instead of the shared persistence-axis `DbRole`, and a dead
  `createRoleGuard` helper validates a session-typed value against the DB
  schema — a genuine cross-axis mismatch, safe today only because both enums
  happen to be value-identical.
- The dev-login email map is duplicated three ways (web, api, and two
  independent prisma seed scripts) with no shared source.
- Neither catalog parser (`e2e/sweep/catalog-parser.mjs`,
  `e2e/sweep/catalog-sweep.spec.ts`'s own reader) validates role tokens read
  from `e2e/catalog/*.yaml`, so a typo'd or retired role silently produces an
  empty/wrong access set instead of failing loudly. Independently, three
  landing-redirect descriptions (in `viewer.yaml`, `admin.yaml`, and
  `login-page.client.tsx`'s own doc comment) had drifted out of sync with
  each other and with the actual source of truth, `ROLE_HOME_PATH`.

## What Changes

- Delete `apps/api/src/modules/auth/roles.guard.ts` and its test (dead code:
  the only callers were its own test and one `auth.e2e.spec.ts` assertion;
  it is not one of the 9 canonical tRPC middleware builders). The removed
  allow/deny coverage is a strict subset of what `assertRole`'s own test
  suite (`packages/shared/src/trpc/middleware/role.ts`) already asserts for
  the code path actually used in production.
- Retype `SamlProfile.role` (`user-session.ts`) and the dev-login role
  constants (`dev-login.routes.ts`) from `@prisma/client`'s `Role` to the
  shared `DbRole` — pure static-typing conformance to the `role-type` spec's
  existing axis rule (persistence-sourced values use `DbRole`); no runtime
  behavior changes.
- Add `DEV_LOGIN_EMAIL_BY_ROLE` to `packages/shared/src/schemas/auth.ts`
  (next to `ROLE_HOME_PATH`) as the one shared home for the 4 canonical
  dev-login role emails; `apps/web/src/app/login-page-roles.ts` and
  `apps/api/src/modules/auth/dev-login.routes.ts` both read it instead of
  maintaining their own copy.
- Add 4 named email constants to `prisma/seed-constants.ts` (the prisma
  toolchain's isolated `tsconfig.prisma.json` cannot resolve workspace
  packages, so this stays a literal mirror, per the existing carve-out);
  `prisma/seed-simple.ts` imports these 4 instead of re-declaring them. Both
  seed scripts stay otherwise independent (`seed-simple.ts` seeds a
  different, larger user set with its own reporting-group topology) — only
  the 4 canonical role emails are deduplicated.
- Both catalog parsers now validate every `role:` and `access:` token against
  the canonical four-role set and throw immediately on an unrecognized
  token, instead of passing it through unchecked.
- Three landing-redirect descriptions are synced to `ROLE_HOME_PATH`
  (`e2e/catalog/viewer.yaml`, `e2e/catalog/admin.yaml`, and the doc comment
  in `apps/web/src/app/login-page.client.tsx`) — a documentation/comment-only
  fix, no behavior change. Unrelated `?tab=published` references describing
  the History archive-toggle URL param are untouched.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `architecture-refactor-backlog`: records that all five role-vocabulary
  follow-ups named by `unify-role-type` are now closed (two by
  `unify-role-label-presentation`, three by this change).
- `scenario-catalog`: adds a requirement that catalog role tokens are
  validated against the canonical role set rather than passed through
  unchecked.

## Impact

- `apps/api/src/modules/auth/{roles.guard.ts,roles.guard.test.ts}` (deleted)
- `apps/api/src/modules/auth/{user-session.ts,dev-login.routes.ts,auth.e2e.spec.ts}`
- `packages/shared/src/schemas/auth.ts`
- `apps/web/src/app/{login-page-roles.ts,login-page.client.tsx}`
- `prisma/{seed-constants.ts,seed-simple.ts}`
- `e2e/sweep/{catalog-parser.mjs,catalog-sweep.spec.ts}`
- `e2e/catalog/{viewer.yaml,admin.yaml}`

Non-goals: no change to `seed-simple.ts`'s independent user/group structure
beyond the 4 deduplicated emails; `seed-demo.ts`/`wipe-manual-uat.ts` stay out
of scope (separate, unapproved duplication); no drift-guard test between the
shared email map and the seeded users (a mismatch already fails loudly as a
dev-only 404); the two catalog parsers stay structurally separate (no
dedup); the missing catalog generator and the `AUTH_STUB`/`AUTH_DEV_MODE`
naming in `viewer.yaml`'s note are flagged, not fixed, here.
