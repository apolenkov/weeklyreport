---
phase: 08-tooling-upgrades
plan: 02
subsystem: testing, linting, tooling
tags:
  [vitest, eslint, typescript-eslint, react-hooks, react-compiler, flat-config]

requires:
  - phase: 08-01
    provides: pnpm 10 + Next.js 16 migration, monorepo on modern toolchain

provides:
  - Vitest 4 test runner for all workspace test suites
  - ESLint 10 flat config with TypeScript strict rules and React plugins
  - CLAUDE.md version references matching actual installed packages

affects: [09-design-system-foundation, 10-e2e-testing, 11-ci-cd]

tech-stack:
  added:
    [
      eslint@10.2.0,
      typescript-eslint@8.58.1,
      eslint-plugin-react-hooks@5.2.0,
      eslint-plugin-react-compiler@19.1.0-rc.2,
    ]
  patterns:
    [
      ESLint flat config at monorepo root,
      tsc + eslint in workspace lint scripts,
      projectService with allowDefaultProject for config files,
    ]

key-files:
  created: [eslint.config.ts]
  modified:
    [
      package.json,
      apps/web/package.json,
      apps/api/package.json,
      packages/shared/package.json,
      packages/ui/package.json,
      apps/web/src/components/common/query-error.tsx,
      apps/api/src/infrastructure/health/prisma.health.ts,
      apps/api/src/infrastructure/health/redis.health.ts,
      CLAUDE.md,
      .gitignore,
    ]

key-decisions:
  - "typescript-eslint unified package over separate parser/plugin (supports ESLint 10 peer dep)"
  - "no-extraneous-class disabled (NestJS modules are empty decorated classes by convention)"
  - "no-non-null-assertion downgraded to warn (76 existing usages, gradual cleanup path)"
  - "e2e/ excluded from ESLint (Playwright tests use separate tsconfig, not in project service)"
  - "caughtErrorsIgnorePattern added to no-unused-vars for _error catch bindings"

patterns-established:
  - "Lint script pattern: tsc --noEmit && eslint . in each workspace"
  - "ESLint flat config at monorepo root shared by all workspaces via Turborepo"
  - "Config files handled via projectService.allowDefaultProject glob patterns"

requirements-completed: [TOOL-03, TOOL-04, TOOL-05]

duration: 75min
completed: 2026-04-11
---

# Phase 08 Plan 02: Vitest 4, ESLint 10 flat config, CLAUDE.md version sync

**Vitest 4 upgrade with zero test changes, ESLint 10 flat config with typescript-eslint strict + react-hooks + react-compiler, CLAUDE.md versions updated to match actual installed packages**

## Performance

- **Duration:** 75 min
- **Started:** 2026-04-11T16:55:05Z
- **Completed:** 2026-04-11T18:09:48Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Vitest 3 -> 4 upgrade with all 51+ unit tests passing without any test or config changes
- ESLint 10 flat config at monorepo root with 6 TypeScript strict rules, react-hooks, and react-compiler
- All 4 workspace lint scripts updated to run tsc + eslint, pnpm turbo lint exits 0
- CLAUDE.md version table fully synchronized with actual installed packages (Next.js 16, Vitest 4, ESLint 10, pnpm 10)
- Combined with Plan 01: the complete modern toolchain (pnpm 10, Next.js 16, Vitest 4, ESLint 10) is operational

## Task Commits

Each task was committed atomically:

1. **Task 1: Upgrade Vitest 3 to 4** - `1189368` (chore)
2. **Task 2: Set up ESLint 10 flat config** - `7b5feb0` (feat)
3. **Task 3: Update CLAUDE.md versions** - `556122b` (docs)

## Files Created/Modified

- `eslint.config.ts` - ESLint 10 flat config with defineConfig, typescript-eslint strict, react-hooks, react-compiler
- `package.json` - Vitest 4, ESLint 10, typescript-eslint, react plugins added to devDependencies
- `apps/web/package.json` - lint script: tsc --noEmit && eslint .
- `apps/api/package.json` - lint script: tsc --noEmit && eslint .
- `packages/shared/package.json` - lint script: tsc --noEmit && eslint .
- `packages/ui/package.json` - lint script: tsc --noEmit && eslint .
- `apps/web/src/components/common/query-error.tsx` - Fix: moved window.location side effect into useEffect for react-compiler compliance
- `apps/api/src/infrastructure/health/prisma.health.ts` - Fix: catch(error) -> catch(\_error) for no-unused-vars
- `apps/api/src/infrastructure/health/redis.health.ts` - Fix: catch(error) -> catch(\_error) for no-unused-vars
- `CLAUDE.md` - All version references updated to match installed packages
- `.gitignore` - Added \*.tsbuildinfo

## Decisions Made

- **typescript-eslint unified package**: Used `typescript-eslint` (unified) instead of separate `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin` because the unified package declares ESLint 10 in its peer dependencies, while the separate packages max out at ESLint 9.
- **no-extraneous-class disabled**: NestJS modules are empty classes decorated with `@Module({...})`. The `no-extraneous-class` rule from strict config flags them all. Disabling is the standard NestJS ESLint approach.
- **no-non-null-assertion at warn level**: 76 existing usages across API and web workspaces. Setting to error would require significant refactoring beyond this plan's scope. Warnings track the tech debt for gradual cleanup.
- **e2e/ excluded from ESLint**: Playwright E2E tests have their own tsconfig and are not part of the workspace project service. Including them causes parsing errors without adding value (Playwright has its own linting).
- **TypeScript 5.9.3 instead of 6.0+**: CLAUDE.md previously claimed TypeScript 6.0+, but the project actually uses 5.9.3. TypeScript 6 has not been released. Updated to reflect reality.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed react-compiler violation in query-error.tsx**

- **Found during:** Task 2 (ESLint setup)
- **Issue:** `window.location.href = ...` inside component body is a side effect writing to an external variable, violating react-compiler rules
- **Fix:** Moved the redirect logic into a `useEffect` hook with `isUnauthorized` dependency
- **Files modified:** apps/web/src/components/common/query-error.tsx
- **Verification:** ESLint passes, all web tests pass
- **Committed in:** 7b5feb0 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed unused catch parameters in health indicators**

- **Found during:** Task 2 (ESLint setup)
- **Issue:** `catch (error)` in prisma.health.ts and redis.health.ts -- the `error` variable is caught but never used
- **Fix:** Renamed to `_error` to match the `caughtErrorsIgnorePattern: '^_'` config
- **Files modified:** apps/api/src/infrastructure/health/prisma.health.ts, apps/api/src/infrastructure/health/redis.health.ts
- **Verification:** ESLint passes with 0 errors
- **Committed in:** 7b5feb0 (Task 2 commit)

**3. [Rule 3 - Blocking] eslint-plugin-react-compiler version mismatch**

- **Found during:** Task 2 (ESLint setup)
- **Issue:** Plan specified `eslint-plugin-react-compiler@^0.20.0` but that version doesn't exist; the package moved to React version numbering (19.1.0-rc.2)
- **Fix:** Installed `eslint-plugin-react-compiler@rc` which resolves to 19.1.0-rc.2
- **Files modified:** package.json
- **Verification:** ESLint loads the plugin successfully
- **Committed in:** 7b5feb0 (Task 2 commit)

**4. [Rule 3 - Blocking] projectService.allowDefaultProject glob patterns**

- **Found during:** Task 2 (ESLint setup)
- **Issue:** ESLint project service couldn't find config files (next.config.ts, vitest.config.ts, vitest.setup.ts) because they're outside tsconfig include paths
- **Fix:** Added `allowDefaultProject` with glob patterns matching monorepo config file locations
- **Files modified:** eslint.config.ts
- **Verification:** No more parsing errors for config files
- **Committed in:** 7b5feb0 (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (2 bugs, 2 blocking)
**Impact on plan:** All auto-fixes necessary for ESLint to run clean. No scope creep.

## Issues Encountered

- Worktree needed `git merge` from main to get Plan 01 changes (pnpm 10, Next.js 16)
- Prisma client needed regeneration (`prisma generate`) for API tsc to pass in lint
- `eslint-plugin-react-hooks@5.2.0` still declares `eslint@^3-9` peer dependency (no ESLint 10 support); works fine at runtime with a peer dependency warning

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Full toolchain operational: pnpm 10 + Next.js 16 + Vitest 4 + ESLint 10
- Phase 09 (Design System Foundation) can proceed with shadcn/ui + Tailwind CSS styling
- ESLint will catch React hooks violations and compiler issues during styling work
- All CLAUDE.md references are accurate for future phases

## Self-Check: PASSED

All created files exist and all commits verified.

---

_Phase: 08-tooling-upgrades_
_Completed: 2026-04-11_
