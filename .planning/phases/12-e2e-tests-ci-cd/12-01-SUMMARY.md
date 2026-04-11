---
phase: 12-e2e-tests-ci-cd
plan: 01
subsystem: testing
tags: [playwright, e2e, auth-fixtures, dual-webserver, jwt, dev-login]

# Dependency graph
requires:
  - phase: 06-auth-frontend-integration
    provides: "SAML auth routes, JWT session cookies, dev-login endpoint"
  - phase: 07-production-infrastructure
    provides: "Health check endpoints for webServer readiness detection"
provides:
  - "Playwright dual webServer config (API + Next.js) with test-specific ports"
  - "Per-role auth fixtures (lead, head, viewer) via parameterized dev-login"
  - "tRPC context that reads JWT cookie in dev mode for per-role E2E access"
  - "Reusable test fixture module with leadPage, headPage, viewerPage"
affects: [12-02, 12-03]

# Tech tracking
tech-stack:
  added: []
  patterns: ["storageState per-role auth pattern", "dual webServer E2E config", "dev-login parameterized by role"]

key-files:
  created:
    - apps/web/e2e/auth.setup.ts
    - apps/web/e2e/fixtures.ts
    - .env.test
  modified:
    - apps/web/playwright.config.ts
    - playwright.config.ts
    - apps/api/src/modules/auth/auth.routes.ts
    - apps/api/src/infrastructure/trpc/trpc.context.ts
    - .gitignore
    - apps/web/src/app/(app)/admin/page.tsx
    - apps/web/src/app/(app)/head/report/page.tsx
    - apps/web/src/components/common/query-error.tsx

key-decisions:
  - "API test port 3101, Web test port 3100 to avoid dev server conflicts"
  - "tRPC context reads JWT cookie first, falls back to DEV_SESSION only without cookie"
  - "Root playwright.config re-exports web config for monorepo convenience"

patterns-established:
  - "Per-role storageState: auth.setup.ts loops roles, hits dev-login, saves storageState per role"
  - "Custom Playwright fixtures: extend base test with leadPage/headPage/viewerPage"
  - "Dual webServer: API via @swc-node/register, Web via next dev, both with env overrides"

requirements-completed: [E2E-01, E2E-02]

# Metrics
duration: 15min
completed: 2026-04-11
---

# Phase 12 Plan 01: E2E Infrastructure Summary

**Playwright dual webServer config with parameterized dev-login auth and per-role storageState fixtures**

## Performance

- **Duration:** 15 min
- **Started:** 2026-04-11T21:48:48Z
- **Completed:** 2026-04-11T22:03:52Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Parameterized `/auth/dev-login` endpoint to accept `?role=lead|head|viewer` with per-role defaults
- Fixed tRPC context to read JWT cookie first in dev mode, enabling per-role API access during E2E
- Created Playwright config with dual webServer (NestJS on 3101, Next.js on 3100) and setup project dependency
- Built auth.setup.ts that creates storageState files for all 3 roles via dev-login
- Created reusable fixtures.ts exporting leadPage, headPage, viewerPage for per-role testing

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend dev-login endpoint and fix tRPC context** - `27eab35` (feat)
2. **Task 2: Create Playwright config with dual webServer and auth fixtures** - `1418a19` (feat)

## Files Created/Modified
- `apps/api/src/modules/auth/auth.routes.ts` - Parameterized dev-login with role/email query params
- `apps/api/src/infrastructure/trpc/trpc.context.ts` - JWT cookie priority over DEV_SESSION fallback
- `.env.test` - Test environment config (separate DB, ports, JWT secret)
- `apps/web/playwright.config.ts` - Dual webServer, auth setup project, chromium project
- `playwright.config.ts` - Re-exports web config for root-level execution
- `apps/web/e2e/auth.setup.ts` - Global auth setup creating per-role storageState
- `apps/web/e2e/fixtures.ts` - Custom test fixtures with leadPage, headPage, viewerPage
- `.gitignore` - Added `**/e2e/.auth/` glob pattern
- `apps/web/src/app/(app)/admin/page.tsx` - Fixed snapshot?.periods null safety
- `apps/web/src/app/(app)/head/report/page.tsx` - Fixed closure non-null assertion
- `apps/web/src/components/common/query-error.tsx` - Fixed react-compiler redirect via useEffect

## Decisions Made
- API test port 3101, Web test port 3100 -- avoids conflicts with dev servers on 3001/3000
- tRPC context reads JWT cookie first, falls back to DEV_SESSION only in dev mode without cookie -- enables per-role E2E while preserving manual dev convenience
- Root playwright.config.ts re-exports web config rather than duplicating -- single source of truth

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed snapshot?.periods null safety in admin page**
- **Found during:** Task 2 (build verification)
- **Issue:** `snapshot.periods` access failed TypeScript strict mode because `snapshot` was a closure variable not narrowed inside async function
- **Fix:** Added optional chaining `snapshot?.periods` with early return guard
- **Files modified:** apps/web/src/app/(app)/admin/page.tsx
- **Verification:** `pnpm turbo build --filter=@customreport/web` passes
- **Committed in:** 1418a19 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed react-compiler error in QueryError redirect**
- **Found during:** Task 2 (build verification)
- **Issue:** `window.location.href = ...` inside component render violated react-compiler rule (writing to variable outside component scope)
- **Fix:** Moved redirect to `useEffect` with `isUnauthorized` dependency
- **Files modified:** apps/web/src/components/common/query-error.tsx
- **Verification:** `pnpm turbo build --filter=@customreport/web` passes
- **Committed in:** 1418a19 (Task 2 commit)

**3. [Rule 1 - Bug] Fixed closure non-null assertion in head report page**
- **Found during:** Task 2 (build verification)
- **Issue:** `report` closure variable lost TypeScript narrowing inside async function, causing `undefined` type error on `refreshed.data ?? report`
- **Fix:** Added non-null assertion with eslint-disable comment explaining the narrowing context
- **Files modified:** apps/web/src/app/(app)/head/report/page.tsx
- **Verification:** `pnpm turbo build --filter=@customreport/web` passes
- **Committed in:** 1418a19 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All pre-existing build errors blocking verification. No scope creep.

## Issues Encountered
None -- pre-existing type errors were discovered during build verification and fixed as deviations.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None -- all files are complete implementations, no placeholder data.

## Next Phase Readiness
- E2E infrastructure complete, ready for journey test specs (plan 12-02)
- Auth fixtures will generate storageState files for all 3 roles on first run
- Existing e2e spec files (7 specs) need migration to use new fixtures

## Self-Check: PASSED

All key files verified on disk. Both commit hashes found in git log.

---
*Phase: 12-e2e-tests-ci-cd*
*Completed: 2026-04-11*
