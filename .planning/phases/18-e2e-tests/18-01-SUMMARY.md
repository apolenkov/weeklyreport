---
phase: 18-e2e-tests
plan: 01
subsystem: testing
tags: [playwright, e2e, next.js, react, hydration]

# Dependency graph
requires:
  - phase: 17-ui-redesign
    provides: Lead report form and history pages with mock data
provides:
  - Playwright E2E test infrastructure (auth setup, fixtures, helpers)
  - 15 Lead journey E2E tests covering form rendering, navigation, submit flow
  - 4 Lead history E2E tests covering cards, dates, traffic lights
affects: [18-02, 18-03, 18-04, 18-05, 18-06, 18-07]

# Tech tracking
tech-stack:
  added: []
  patterns: [e2e-tsconfig-cjs, retry-click-hydration, role-scoped-fixtures]

key-files:
  created:
    - apps/web/e2e/auth.setup.ts
    - apps/web/e2e/fixtures.ts
    - apps/web/e2e/helpers/test-utils.ts
    - apps/web/e2e/lead-journey.spec.ts
    - apps/web/e2e/lead-history.spec.ts
    - apps/web/e2e/tsconfig.json
  modified:
    - apps/web/playwright.config.ts
    - apps/web/next.config.ts
    - apps/web/.gitignore

key-decisions:
  - "CJS tsconfig for Playwright: Next.js 16 uses module:ESNext with verbatimModuleSyntax, but Playwright needs CJS; separate e2e/tsconfig.json with module:CommonJS"
  - "allowedDevOrigins for 127.0.0.1: Next.js 16 blocks cross-origin HMR by default, preventing React hydration when tests access via 127.0.0.1"
  - "Retry-click pattern for hydration: React event handlers attach asynchronously in Next.js 16 dev mode; submit dialog tests use click-retry loop"
  - "No-op auth setup: pages render mock data; auth.setup writes empty storage state files for future real auth wiring"
  - "Removed API webServer from Playwright config: pages use mock data, no database/Redis needed"

patterns-established:
  - "e2e/tsconfig.json: Separate CJS TypeScript config for Playwright test files (overrides monorepo ESNext)"
  - "retry-click: For interactive elements requiring React hydration, retry click until state change appears"
  - "role-scoped fixtures: leadPage/headPage fixtures with storage state injection for future auth"

requirements-completed: [E2E-01]

# Metrics
duration: 16min
completed: 2026-04-24
---

# Phase 18 Plan 01: Auth Fixtures + Lead Journey E2E Summary

**Playwright E2E test infrastructure with 19 Lead journey/history tests -- all passing in 9s with Next.js 16 hydration workarounds**

## Performance

- **Duration:** 16 min
- **Started:** 2026-04-24T18:52:57Z
- **Completed:** 2026-04-24T19:09:04Z
- **Tasks:** 4 (3 planned + 1 auto-fix)
- **Files modified:** 9

## Accomplishments
- Playwright E2E infrastructure: auth setup, role fixtures, test helpers, CJS-compatible tsconfig
- 15 Lead journey tests: page header, SDLC pipeline, period navigator, Fill From, version history, accordion sections, submit dialog flow
- 4 Lead history tests: heading, cards, dates/status, traffic light dots
- All 25 tests (4 setup + 21 journey/history) pass in ~9 seconds

## Task Commits

Each task was committed atomically:

1. **Task 1: Test infrastructure** - `a8a39c2` (feat) -- config + auth + fixtures + helpers
2. **Task 2: Lead journey tests** - `cab11f2` (test) -- 15 scenarios
3. **Task 3: Lead history tests** - `f8f94d0` (test) -- 4 scenarios
4. **Task 4: Fix ESM/hydration issues** - `6711052` (fix) -- CJS tsconfig, allowedDevOrigins, retry-click

## Files Created/Modified
- `apps/web/playwright.config.ts` - Simplified config: removed API server, switched to next dev
- `apps/web/e2e/auth.setup.ts` - Writes empty storage state files per role (lead, head, admin, viewer)
- `apps/web/e2e/fixtures.ts` - Role-scoped page fixtures (leadPage, headPage) + helper functions
- `apps/web/e2e/helpers/test-utils.ts` - loginAs, waitForPageLoad, expectHeading, expectVisible utilities
- `apps/web/e2e/lead-journey.spec.ts` - 15 Lead report form E2E tests
- `apps/web/e2e/lead-history.spec.ts` - 4 Lead history page E2E tests
- `apps/web/e2e/tsconfig.json` - CJS TypeScript config for Playwright (fixes ESM/CJS interop)
- `apps/web/next.config.ts` - Added allowedDevOrigins for 127.0.0.1 (fixes React hydration in E2E)
- `apps/web/.gitignore` - Added e2e/.results/ and e2e/.auth/

## Decisions Made
- **CJS tsconfig for E2E:** The monorepo uses `module: ESNext` + `verbatimModuleSyntax: true` which causes Playwright's transformer to emit ESM that Node.js tries to run as CJS. A separate `e2e/tsconfig.json` with `module: CommonJS` fixes this.
- **allowedDevOrigins:** Next.js 16 blocks cross-origin HMR WebSocket from `127.0.0.1` by default, which prevents client JS from hydrating React components. Adding `127.0.0.1` to `allowedDevOrigins` fixes hydration.
- **No-op auth:** Pages render mock data without auth cookies. Auth setup writes empty files so test infrastructure is ready for future real auth.
- **next dev over next start:** Using `next dev` avoids needing a prior `next build` step and is simpler for E2E test development.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed ESM/CJS module interop for Playwright**
- **Found during:** Task 1 verification (test listing)
- **Issue:** Playwright couldn't load test files -- `require is not defined in ES module scope` and `exports is not defined`
- **Fix:** Created `e2e/tsconfig.json` with `module: CommonJS`, replaced `import.meta.dirname` with `__dirname`
- **Files modified:** `e2e/tsconfig.json`, `e2e/auth.setup.ts`, `e2e/fixtures.ts`
- **Verification:** `npx playwright test --list` shows all 25 tests
- **Committed in:** `6711052`

**2. [Rule 1 - Bug] Fixed React hydration failure in E2E tests**
- **Found during:** Task 2 verification (submit dialog tests failing)
- **Issue:** All button clicks had no effect -- React event handlers never attached because Next.js 16 blocked HMR WebSocket from `127.0.0.1`, preventing client JS bundle loading
- **Fix:** Added `allowedDevOrigins: ['127.0.0.1', 'localhost']` to next.config.ts; added retry-click pattern for submit dialog tests
- **Files modified:** `apps/web/next.config.ts`, `apps/web/e2e/lead-journey.spec.ts`
- **Verification:** All 25 tests pass in ~9s
- **Committed in:** `6711052`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes essential for tests to run. No scope creep.

## Issues Encountered
- Next.js 16 cross-origin dev resource blocking is a new behavior not present in earlier versions. The `allowedDevOrigins` config option resolves it.
- React Compiler (enabled via `reactCompiler: true`) does not expose `__reactFiber` or `__reactProps` on DOM elements, making traditional React fiber detection impossible for hydration checks.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- E2E infrastructure (fixtures, helpers, auth setup) ready for all future E2E plans (18-02 through 18-07)
- `headPage` fixture already created for 18-02 (Head journey)
- The `allowedDevOrigins` fix benefits all future E2E test plans

---
*Phase: 18-e2e-tests*
*Completed: 2026-04-24*
