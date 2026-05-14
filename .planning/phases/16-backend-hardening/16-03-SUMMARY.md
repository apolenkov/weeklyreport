---
phase: 16-backend-hardening
plan: 03
subsystem: ui
tags: [next-themes, theme-toggle, dark-mode, msw, vitest]

# Dependency graph
requires:
  - phase: 09-design-system-foundation
    provides: "Tailwind CSS tokens, globals.css dark mode variables"
  - phase: 15-ui-ux-polish-visual-verification
    provides: "shadcn/ui components, nav-user dropdown"
provides:
  - "ThemeProvider wired in root layout with system detection"
  - "Theme toggle (dark/light) in user dropdown menu"
  - "MSW handlers verified as matching tRPC router contracts"
affects: [17-ui-redesign, 18-e2e-tests]

# Tech tracking
tech-stack:
  added: [next-themes (direct dep in apps/web)]
  patterns:
    [ThemeProvider wrapping at layout root, useTheme hook in client components]

key-files:
  created: []
  modified:
    - apps/web/src/app/layout.tsx
    - apps/web/src/components/navigation/nav-user.tsx
    - apps/web/package.json

key-decisions:
  - "Added next-themes as direct dependency of @customreport/web for pnpm strict mode resolution"
  - "Pre-existing test failures (10/29) confirmed as not caused by ThemeProvider changes"

patterns-established:
  - "ThemeProvider: attribute=class, defaultTheme=system, enableSystem, disableTransitionOnChange"
  - "Theme toggle via useTheme hook in client components"

requirements-completed: [BE-06, BE-04, BE-05]

# Metrics
duration: 9min
completed: 2026-04-21
---

# Phase 16 Plan 03: Theme Provider & Frontend Test Verification Summary

**next-themes ThemeProvider wired in layout.tsx with OS preference detection; Moon/Sun theme toggle added to user dropdown; MSW handlers verified against tRPC router**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-21T16:48:18Z
- **Completed:** 2026-04-21T16:57:49Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- ThemeProvider wraps all layout children with `attribute="class"`, `defaultTheme="system"`, `enableSystem`, and `disableTransitionOnChange`
- Theme toggle (Moon/Sun icons) added to nav-user dropdown menu between role badge and logout
- Sonner Toaster now receives theme context from ThemeProvider (was already wired via useTheme)
- MSW handlers verified: all 11 procedure names match tRPC router, superjson serialization correct
- Web tests confirmed stable (19/29 pass) with no regressions from ThemeProvider addition

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire ThemeProvider in layout.tsx and add theme toggle to nav-user** - `9127d40` (feat)
2. **Task 2: Verify MSW handlers and web test stability** - verification only, no code changes needed

## Files Created/Modified

- `apps/web/src/app/layout.tsx` - Added ThemeProvider import and wrapper around all body children
- `apps/web/src/components/navigation/nav-user.tsx` - Added useTheme hook, Moon/Sun imports, theme toggle DropdownMenuItem
- `apps/web/package.json` - Added next-themes as direct dependency (pnpm strict mode requires this)

## Decisions Made

- **next-themes as direct dependency:** pnpm strict mode does not hoist transitive dependencies. Even though next-themes was already installed via @customreport/ui, apps/web could not import it without a direct dependency declaration.
- **Pre-existing test failures accepted:** 10/29 web tests fail both before and after changes. These failures exist on main branch and are unrelated to ThemeProvider wiring. No regression introduced.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added next-themes as direct dependency of @customreport/web**

- **Found during:** Task 1 (ThemeProvider wiring)
- **Issue:** pnpm strict mode prevents importing transitive dependencies; next-themes only listed in packages/ui, not apps/web
- **Fix:** Added `"next-themes": "^0.4.6"` to apps/web/package.json dependencies
- **Files modified:** apps/web/package.json
- **Verification:** `pnpm --filter @customreport/web run typecheck` passes clean
- **Committed in:** 9127d40 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for pnpm strict dependency resolution. No scope creep.

## Issues Encountered

- Plan stated "29/29 tests pass" but current reality shows 19/29. The 10 failures are pre-existing on main branch (confirmed by running tests before and after changes). ThemeProvider addition causes zero test regressions.
- Typecheck in packages/shared has 3 pre-existing errors in test files (unused variables, missing property). These are unrelated to this plan and do not affect web or api typechecking.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Dark theme infrastructure is complete; CSS tokens in globals.css already define dark mode values
- Theme toggle is functional in nav-user dropdown
- Future UI redesign (Phase 17) can build on theme infrastructure

---

_Phase: 16-backend-hardening_
_Completed: 2026-04-21_
