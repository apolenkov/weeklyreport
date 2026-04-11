---
phase: 08-tooling-upgrades
plan: 01
subsystem: infra
tags: [pnpm, next.js, react-compiler, turbopack, proxy.ts, docker]

requires:
  - phase: 07-production-infrastructure
    provides: Working monorepo with pnpm 9 + Next.js 15, Docker Compose stack
provides:
  - pnpm 10 with onlyBuiltDependencies allowlist for lifecycle scripts
  - Next.js 16 with Turbopack default bundler and proxy.ts auth middleware
  - React Compiler enabled via babel-plugin-react-compiler
  - Dockerfiles updated to pnpm 10.11.0
affects: [08-02-PLAN (Vitest/ESLint upgrades), 09-design-system-foundation]

tech-stack:
  added: [babel-plugin-react-compiler@1.0.0]
  patterns: [proxy.ts file convention for Next.js 16 middleware, turbopack.root for monorepo workspace resolution]

key-files:
  created: [apps/web/src/proxy.ts]
  modified: [package.json, pnpm-workspace.yaml, apps/web/package.json, apps/web/next.config.ts, Dockerfile.web, Dockerfile.api, apps/web/src/server/auth/session.test.ts, apps/web/src/app/(app)/admin/page.tsx, apps/web/src/app/(app)/head/report/page.tsx]

key-decisions:
  - "onlyBuiltDependencies in both package.json (pnpm config) and pnpm-workspace.yaml for complete lifecycle script allowlist"
  - "turbopack.root set to monorepo root to suppress workspace detection warning in worktree environments"
  - "Keep node:20-alpine in Dockerfiles (Node 20 LTS satisfies all requirements)"

patterns-established:
  - "proxy.ts convention: Next.js 16 renamed middleware.ts to proxy.ts with export function proxy()"
  - "pnpm 10 lifecycle allowlist: all packages needing postinstall scripts listed in onlyBuiltDependencies"

requirements-completed: [TOOL-01, TOOL-02]

duration: 26min
completed: 2026-04-11
---

# Phase 8 Plan 01: pnpm 10 + Next.js 16 Migration Summary

**pnpm 10 with lifecycle script allowlist and Next.js 16 with proxy.ts auth middleware, React Compiler, and Turbopack**

## Performance

- **Duration:** 26 min
- **Started:** 2026-04-11T16:23:40Z
- **Completed:** 2026-04-11T16:49:51Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- pnpm 10.11.0 active with onlyBuiltDependencies allowlist covering 9 packages (prisma, playwright, esbuild, msw, sharp, @nestjs/core, @prisma/client, @prisma/engines, msgpackr-extract)
- Next.js 16.2.3 building with Turbopack, proxy.ts auth middleware recognized by Next.js runtime
- React Compiler enabled, compiling successfully with babel-plugin-react-compiler
- All 77 tests passing (39 API + 27 web + 11 shared)
- Full Turborepo build completing in under 8 seconds

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate pnpm 9 to 10 with onlyBuiltDependencies allowlist** - `ab2c9b7` (chore)
2. **Task 2: Migrate Next.js 15 to 16 with proxy.ts rename and config updates** - `699552c` (feat)

## Files Created/Modified
- `package.json` - packageManager to pnpm@10.11.0, engines.node to >=20.19.0, pnpm.onlyBuiltDependencies
- `pnpm-workspace.yaml` - onlyBuiltDependencies allowlist for lifecycle scripts
- `apps/web/package.json` - next@16.2.3, react@19.2.5, react-dom@19.2.5, babel-plugin-react-compiler
- `apps/web/next.config.ts` - reactCompiler: true, turbopack.root for monorepo
- `apps/web/src/proxy.ts` - Renamed from middleware.ts, export function proxy()
- `apps/web/src/server/auth/session.test.ts` - Import path updated from middleware to proxy
- `apps/web/src/app/(app)/admin/page.tsx` - Fix closure narrowing for snapshot
- `apps/web/src/app/(app)/head/report/page.tsx` - Fix closure narrowing for report
- `Dockerfile.web` - pnpm@9.15.0 to pnpm@10.11.0
- `Dockerfile.api` - pnpm@9.15.0 to pnpm@10.11.0

## Decisions Made
- **onlyBuiltDependencies in package.json pnpm config**: pnpm 10 uses `package.json > pnpm > onlyBuiltDependencies` as the canonical location for build script allowlists. Also kept in pnpm-workspace.yaml for compatibility.
- **turbopack.root for monorepo**: Next.js 16 auto-detects workspace root by searching for lockfiles upward. In worktree environments with multiple lockfiles, explicit root setting prevents misconfiguration.
- **Non-null assertion for report in closure**: TypeScript closure narrowing does not persist into nested async function bodies after parent-scope null checks. Used `report!` with safety comment since the check is on line 21 and the function is only called after that check.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Additional packages needed in onlyBuiltDependencies**
- **Found during:** Task 1 (pnpm install)
- **Issue:** Plan listed 4 packages for allowlist; pnpm 10 blocked 5 additional packages (@nestjs/core, @prisma/engines, msgpackr-extract, msw, sharp)
- **Fix:** Added all 9 packages to onlyBuiltDependencies; also added to package.json > pnpm config (the canonical pnpm 10 location)
- **Files modified:** package.json, pnpm-workspace.yaml
- **Verification:** pnpm install exits 0 with no blocked-scripts warnings
- **Committed in:** ab2c9b7

**2. [Rule 3 - Blocking] React Compiler requires babel-plugin-react-compiler**
- **Found during:** Task 2 (Next.js build)
- **Issue:** `reactCompiler: true` in next.config.ts fails build without the babel plugin installed
- **Fix:** Installed babel-plugin-react-compiler as devDependency in apps/web
- **Files modified:** apps/web/package.json
- **Verification:** Build compiles successfully with React Compiler
- **Committed in:** 699552c

**3. [Rule 3 - Blocking] Turbopack root detection fails in worktree**
- **Found during:** Task 2 (Next.js build)
- **Issue:** Next.js 16 scans upward for lockfiles to find workspace root; found multiple lockfiles across worktree/parent paths
- **Fix:** Added `turbopack: { root: resolve(__dirname, '../..') }` to next.config.ts
- **Files modified:** apps/web/next.config.ts
- **Verification:** Build completes without workspace root warning
- **Committed in:** 699552c

**4. [Rule 1 - Bug] TypeScript closure narrowing errors exposed by Next.js 16**
- **Found during:** Task 2 (Next.js build)
- **Issue:** Two pages (admin, head/report) had variables narrowed in parent scope but not in nested async closures; Next.js 16 type checker caught this
- **Fix:** Added guard `if (!snapshot) return false` and non-null assertion `report!` with safety comment
- **Files modified:** apps/web/src/app/(app)/admin/page.tsx, apps/web/src/app/(app)/head/report/page.tsx
- **Verification:** Build and all 27 web tests pass
- **Committed in:** 699552c

---

**Total deviations:** 4 auto-fixed (3 blocking, 1 bug)
**Impact on plan:** All fixes were necessary for build and install to work. No scope creep.

## Issues Encountered
- Prisma Client needed regeneration after clean install (pnpm 10 wipes node_modules structure); resolved by running `prisma generate` with DATABASE_URL env var before build
- pnpm install with background execution produced empty output files; switched to synchronous execution

## Known Stubs
None - no stubs introduced in this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- pnpm 10 and Next.js 16 are stable; all builds and tests pass
- Ready for 08-02 (Vitest 4 + ESLint 10 upgrades)
- React Compiler is enabled and will auto-optimize component re-renders

---
*Phase: 08-tooling-upgrades*
*Completed: 2026-04-11*
