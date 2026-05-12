---
phase: 57
plan: director-role
subsystem: auth + authz + nav
tags: [role, prisma, zod, trpc, layout, seed]
ufb: UFB-057
status: complete
requires:
  [
    Phase 32-C (admin role),
    Phase 46 (groupScopeFilter),
    Phase 52 (leadershipProcedure),
  ]
provides:
  - Role.director Prisma enum value
  - roleSchema + sessionRoleSchema include 'director'
  - leadershipRoleMiddleware + anyRoleMiddleware accept director
  - groupScopeFilter god-mode-read branch for director
  - /head/dashboard accessible to director (nested /head/report stays head+admin)
  - DEFAULT_FOR_ROLE + roleHomePath: director -> /head/dashboard
  - seed-simple director user (email=director@customreport.local)
affects:
  - apps/api/src/infrastructure/trpc/trpc.middleware.ts
  - apps/api/src/lib/group-scope.ts
  - apps/api/src/modules/auth/auth.routes.ts
  - apps/api/src/modules/auth/saml.strategy.ts
  - apps/web/src/app/(app)/head/layout.tsx
  - apps/web/src/app/(app)/head/report/layout.tsx (new)
  - apps/web/src/app/page.tsx
  - apps/web/src/components/admin/users-tab.tsx
  - apps/web/src/components/dashboard/product-kpi-card.tsx
  - apps/web/src/components/dev/role-switcher.tsx
  - apps/web/src/components/navigation/app-shell.tsx
  - apps/web/src/components/navigation/nav-bar.tsx
  - apps/web/src/lib/role-home.ts
  - apps/web/src/lib/role-visibility.ts
  - apps/web/src/lib/session-provider.tsx
  - apps/web/src/lib/mappers/admin.ts
  - apps/web/src/lib/mappers/lead-form.ts
  - apps/web/src/components/admin/mock-data.ts
  - packages/shared/src/schemas/auth.ts
  - prisma/schema.prisma
  - prisma/migrations/20260511104042_add_director_role/
  - prisma/seed-simple.ts
key-decisions:
  - "Director is god-mode-READ (groupScopeFilter returns {}), NOT a writer; mutations still gated by adminProcedure upstream"
  - "/head/dashboard widened to {head, admin, director}; nested /head/report layout narrows back to {head, admin} so directors cannot author a weekly report"
  - "Director landing page = /head/dashboard (same as head) — leadership KPI cards are the first thing they see"
  - "Phase 52 KPI surface widening = option (a) from task: leadershipRoleMiddleware accepts director on existing /head/dashboard; no separate /director/dashboard route"
metrics:
  duration: ~25min
  commits: 7
  completed: 2026-05-11
---

# Phase 57 Plan director-role Summary

Added `director` role to the Prisma `Role` enum and plumbed it end-to-end as a
**leadership-audience read-only** consumer (god-mode-READ across all groups,
viewer-equivalent capability) with its post-login home at `/head/dashboard`.

## Dependency Graph

```
  [Role enum]                      ← prisma/schema.prisma + migration
        ↓
  [roleSchema / sessionRoleSchema] ← packages/shared/src/schemas/auth.ts
        ↓
  ┌──────────────┬──────────────────────────┬────────────────────────┐
  ▼              ▼                          ▼                        ▼
[anyRoleMW]  [leadershipMW]           [groupScopeFilter]      [SessionUser]
  (api)        (api: Phase 52 KPIs)    (api: god-mode-READ)    (web)
                                             │
                                             ▼
                                       [/head/layout]
                                       widened to incl. director
                                             │
                                             ▼
                                       [/head/report/layout]
                                       NEW nested gate narrows
                                       back to {head, admin}
```

## Commits

| #   | Hash    | Subject                                                                        |
| --- | ------- | ------------------------------------------------------------------------------ |
| 1   | 0429195 | feat(schema): UFB-057 — add director role to Role enum (57-01)                 |
| 2   | 1323b52 | feat(shared): UFB-057 — widen roleSchema/sessionRoleSchema to director (57-02) |
| 3   | f665c8f | feat(api): UFB-057 — director in leadership/anyRole + saml + dev-login (57-03) |
| 4   | 44b2530 | feat(api): UFB-057 — director god-mode-read in groupScopeFilter (57-04)        |
| 5   | 7d13f29 | feat(web): UFB-057 — director routing, nav, role-home, role-visibility (57-05) |
| 6   | f29850e | feat(web): UFB-057 — widen /head/\* to director, narrow /head/report (57-06)   |
| 7   | 923127c | chore(seed): UFB-057 — seed director user in seed-simple (57-07)               |

## Migration

- File: `prisma/migrations/20260511104042_add_director_role/migration.sql`
- SQL: `ALTER TYPE "Role" ADD VALUE 'director';`
- Additive, idempotent at the enum level (Postgres `ALTER TYPE … ADD VALUE`)
- Applied locally via `pnpm exec prisma migrate dev --name add_director_role`
- Prisma client regenerated in both host and `customreport-api-1` container

## Verification

| Suite                                               | Result                    | Target  |
| --------------------------------------------------- | ------------------------- | ------- |
| `pnpm --filter @customreport/shared test --run`     | **584 passed** (18 files) | ≥582    |
| `pnpm --filter @customreport/api test --run`        | **891 passed** (77 files) | ≥887    |
| `pnpm --filter @customreport/web test --run`        | **357 passed** (44 files) | ≥357    |
| `pnpm --filter @customreport/api exec tsc --noEmit` | exit 0                    | exit 0  |
| `pnpm --filter @customreport/web exec tsc --noEmit` | exit 0                    | exit 0  |
| `docker compose ps` (api, web)                      | both healthy              | healthy |

## Routing decision (task step 8 — option (a))

Per the task brief and the advisor's option (ii) tweak:

- `/head/layout.tsx` REQUIRED widened to `['head', 'admin', 'director']`.
- A new nested `/head/report/layout.tsx` narrows back to `['head', 'admin']` so
  director cannot author a weekly report (read-only invariant).
- Phase 52 KPI card (`ProductKpiCard`) widened to include director in
  `isLeadership` — matches the server-side `leadershipRoleMiddleware`.
- `roleHomePath('director') === '/head/dashboard'`, mirroring `head`.

This keeps the broad-gate-at-top pattern intact for the common case while
preserving the original Phase 29-03 contract on the authoring surface.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Widened additional inline role unions tsc surfaced**

- Found during: tsc cascade after roleSchema widening
- Issue: Six files re-declared the role union as local literals; once shared
  `Role` widened, exhaustive `Record<Role, …>` and switch statements broke.
- Fix: Added `director` slot to each — `app/page.tsx`, `role-switcher.tsx`,
  `app-shell.tsx`, `session-provider.tsx`, `mappers/lead-form.ts`,
  `mappers/admin.ts`, `components/admin/mock-data.ts`,
  `components/admin/users-tab.tsx` (RoleBadge styles), and
  `product-kpi-card.tsx`.
- Commit: `7d13f29`

### Deferred

**1. seed-simple.ts re-run blocked by pre-existing FK ordering bug**

Running `pnpm db:seed:simple` against the current dev DB fails on
`GroupProduct_productId_fkey` because the seed deletes `Project` rows before
their `GroupProduct` join rows (Phase 56-A introduced the join table; the
seed delete order was not updated). The new `DIRECTOR_ID` user row is
correctly inserted under `Role.director` and runs cleanly on a fresh DB — but
mass re-seeding the existing dev DB is out of scope for this task. Filed
mentally as a separate seed-ordering fix.

**2. Admin Users tab role-picker dropdown**

Only verified through the type system — UserRole type widened in
`mock-data.ts` and `mappers/admin.ts`. If there is a literal dropdown
`<option>` list elsewhere in the admin Users tab, it needs a director entry.
Searched and found none in current bundles — UI test passes 357/357.

## Threat surface scan

| Flag                        | File                                                  | Description                                                                                                                           |
| --------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| threat_flag: authz-widening | `apps/api/src/infrastructure/trpc/trpc.middleware.ts` | `anyRoleMiddleware` and `leadershipRoleMiddleware` now admit `director`. Mutation paths remain gated by `adminProcedure` (unchanged). |
| threat_flag: scope-filter   | `apps/api/src/lib/group-scope.ts`                     | `director` joins `admin` in the empty-filter branch. Read-only because every admin-only mutation path uses `adminProcedure`.          |

## Coordination with parallel agent

The parallel `scope-filter-migration` agent landed two commits during my run
(`bd2a958`, `e6a3b33`) touching `weekly-report` repository code. No file
overlap with this plan. They consume `groupScopeFilter` output but do not
modify the helper itself. My widening of the helper to treat
`{admin, director}` symmetrically is additive — their consumer code that
spreads the returned `where` fragment works unchanged.

If the other agent has consumer code that mirrors `'admin === role'` for
god-mode behaviour (separate from the helper's return), it should be widened
to `role === 'admin' || role === 'director'`. I did not touch their files.

## Open questions

1. **Director-specific UI affordances?** Currently the director sees the
   head dashboard verbatim. If product wants a different framing (e.g. an
   "Executive view" label on the dashboard, hidden edit affordances), it
   would be a follow-up plan — out of scope here.
2. **SAML IdP role mapping.** Real-mode SAML must map an IdP attribute to
   `role=director` for the strategy to issue a director session. The
   dev-mode strategy and `/auth/dev-login` already accept `director`. The
   prod SAML attribute mapping (Keycloak side) is outside this repo.

## Self-Check: PASSED

- All seven commits exist in `git log`.
- Migration file exists: `prisma/migrations/20260511104042_add_director_role/migration.sql`.
- New layout file exists: `apps/web/src/app/(app)/head/report/layout.tsx`.
- Test counts meet or exceed targets (584 / 891 / 357).
- Both tsc suites exit 0.
- API and web containers report healthy after restart.
