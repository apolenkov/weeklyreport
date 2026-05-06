---
phase: 35-ux-polish
plan: 08
status: shipped
shipped: 2026-05-06
requirements: [UX-16, UX-17, UX-18, FIX-01, FIX-02, FIX-03]
files_modified:
  - prisma/seed-simple.ts
  - prisma/seed.ts
  - prisma/seed-constants.ts
  - apps/api/src/modules/activity/activity.service.ts (new)
  - apps/api/src/modules/activity/activity.module.ts (new)
  - apps/api/src/modules/activity/activity.prisma-repository.ts (new)
  - apps/api/src/modules/reminders/reminders.prisma-repository.ts
  - apps/api/src/main.ts
  - apps/api/src/app.module.ts
  - apps/api/src/infrastructure/throttler/rate-limit.middleware.ts
  - apps/api/src/infrastructure/trpc/trpc.router.ts
  - apps/web/src/app/page.tsx
  - apps/web/src/app/(app)/lead/history/page.tsx
  - apps/web/src/app/(app)/reports/history/page.tsx
  - apps/web/src/app/(app)/reports/page.tsx (new)
  - apps/web/src/components/dashboard/activity-live-panel.tsx (new)
  - apps/web/src/components/dashboard/dashboard-page.tsx
  - apps/web/src/components/navigation/nav-bar.tsx
  - packages/shared/src/schemas/report.ts
  - .planning/milestones/v8.0-REQUIREMENTS.md
  - .planning/milestones/v8.0-ROADMAP.md
  - .planning/ROADMAP.md
---

# Phase 35-08 — UX rebuild + seed RU + log-bug fixes

## Summary

Closes the visible regressions and side-effects surfaced by the
2026-05-06 visual review session. Three UX changes (UX-16..18) and
three log-driven bug fixes (FIX-01..03) shipped in one atomic plan.

## What shipped

### Group A — Backend

- **A1. Seed in Russian (`prisma/seed-simple.ts`, `prisma/seed.ts`,
  `prisma/seed-constants.ts`).** Every `Item.text`,
  `Risk.{risk,impact,mitigation}`, `Decision.{text,owner,impact}`,
  `Priority.text`, `Project.name`, and `User.name` is RU Cyrillic.
  Realistic Development-team status content. Seed-simple now wipes
  `ReopenRequest` before `ReportSection` (FK-safe) and re-runs
  cleanly even after `prisma migrate reset --force` (verified twice
  back-to-back without exit-1). The simple seed also creates the
  active period anchored to the **current** ISO week
  (Monday..Sunday in UTC) — closes FIX-01.
- **A2. Rate-limiter IPv6 fix (`rate-limit.middleware.ts`).** Imports
  `ipKeyGenerator` from `express-rate-limit` and wraps the IP key
  through it, normalising IPv6 addresses by /64 prefix per the
  upstream advisory. Closes FIX-02 — kills the
  `ERR_ERL_KEY_GEN_IPV6` warning that fired on every request.
- **A3. ReminderExecution LIMIT (`reminders.prisma-repository.ts`).**
  `listExecutions` now applies `take: 100` so the OFFSET-without-LIMIT
  query stops appearing in the slow-query log. UI never paginates
  past 100 anyway — service-level cursor pagination still operates
  on the capped slice. Closes FIX-03.
- **A4. Activity service (`apps/api/src/modules/activity/`).** New
  `ActivityService` + Prisma repository + `ActivityModule`. Exposed
  via tRPC as `activity.live` (`headProcedure`). Returns one row per
  lead's section in the open period with item / risk / decision /
  priority counts and a computed `lastEditAt` (max updatedAt across
  the section + its children). Empty `rows` when no open period
  exists. Closes UX-18.

### Group B — Frontend

- **B1. Root redirect role-aware (`apps/web/src/app/page.tsx`).**
  Authenticated users redirect by role (lead → `/lead/report`,
  head/admin → `/head/dashboard`, viewer → `/reports?tab=published`).
  Unauthenticated + `NEXT_PUBLIC_AUTH_STUB=true` renders a dev-login
  picker grid (one card per seeded user, grouped by role) so the
  user can swap identity from the landing page. SSO path unchanged
  for production. Closes UX-16.
- **B2. Reports tabbed merge (`apps/web/src/app/(app)/reports/page.tsx`).**
  Two tabs: "Мои черновики" (lead-only) and "Опубликованные"
  (everyone). Default by role (lead → drafts; head/admin/viewer →
  published); URL override via `?tab=`. Legacy `/lead/history` and
  `/reports/history` 307-redirect to the merged route. Nav-bar links
  updated; the global search input now lives at the top of the
  merged page. Closes UX-17.
- **B3. Dashboard activity panel
  (`apps/web/src/components/dashboard/activity-live-panel.tsx`).**
  Renders rows per lead with avatar (initials), display name, status
  pill (Черновик / Отправлено), counts, and relative-time of last
  edit. Polls `activity.live` every 15s. Click a row →
  `/lead/report?period=<reportId>&authorId=<userId>` so head/admin
  drops into the lead's section. Empty state when the period is
  closed/published. Closes UX-18.

### Group C — Migration & docs

- Requirements file: UX-16, UX-17, UX-18, FIX-01, FIX-02, FIX-03
  added to `v8.0-REQUIREMENTS.md` (already marked `[x]`).
- Roadmap: 35-08 plan added to the Phase 35 list (`[x]`); plan/req
  totals re-counted in `.planning/ROADMAP.md` (25/31 → 26/32).

## Verification

| Check                                    | Result                                            |
| ---------------------------------------- | ------------------------------------------------- |
| `pnpm exec prisma generate`              | OK                                                |
| `pnpm turbo typecheck`                   | 5/5 pass (cache + fresh)                          |
| `pnpm turbo lint --continue`             | 0 errors / 0 warnings                             |
| `pnpm exec prisma migrate reset --force` | OK (re-applies all 11 migrations + runs seed.ts)  |
| `pnpm db:seed:simple`                    | exit 0; idempotent across two consecutive runs    |
| Active period covers today (psql)        | 1 row (`SELECT count(*)` … `periodStatus='open'`) |
| RU content in `Item.text`                | confirmed via psql LIMIT 5                        |
| RU content in `Project.name`             | confirmed via psql                                |
| RU lead names                            | confirmed via psql                                |
| `apps/api` unit tests                    | 635 / 635 pass (55 files)                         |
| `apps/web` unit tests                    | 246 / 246 pass (29 files)                         |

### Log-bug fixes — confirmed at source

- `apps/api/src/infrastructure/throttler/rate-limit.middleware.ts`
  imports `ipKeyGenerator` and routes every IP through it. Restart
  the API + verify `grep -c 'keyGenerator IPv6' apps/api/.logs/api.log`
  reports 0 new occurrences.
- `apps/api/src/modules/reminders/reminders.prisma-repository.ts`
  `listExecutions` ends with `take: 100` so future Prisma logs no
  longer show the unbounded OFFSET pattern for that path.
- `prisma/seed-simple.ts` computes the active period dynamically so
  `weeklyReport.get` always finds an open report covering today —
  closes the `WeeklyReportDomainError 'No active report period
found'` storm against `userId=...0098` (viewer) and any seeded
  account that lands on the form before publishing.

## Out of scope (consciously)

- Did not touch the schema (no Prisma migration in this plan — all
  changes are seed-only data + TypeScript code).
- Did not loosen ESLint or TypeScript rules. Lint floor stays
  0 errors / 0 warnings.
- Did not split `User.displayName` from `User.name` — RU goes in
  `name` directly.
- Did not push to remote. Maintainer holds the final push for a
  visual smoke pass through the running stack.
