---
phase: 06-auth-frontend-integration
plan: 02
subsystem: api
tags: [trpc, react-query, tanstack-query, typescript-paths]

requires:
  - phase: 05-backend-foundation
    provides: tRPC router (AppRouter type) and middleware (protectedProcedure, headProcedure)
provides:
  - tRPC React hooks client (createTRPCReact<AppRouter>)
  - TRPCProvider component wrapping root layout
  - Cookie credential forwarding on all tRPC requests
  - TypeScript path alias @customreport/api/* for cross-app type imports
affects: [06-03, 06-04, 06-05]

tech-stack:
  added:
    [
      "@trpc/client@11.16.0",
      "@trpc/react-query@11.16.0",
      "@tanstack/react-query@5.97.0",
    ]
  patterns:
    [
      "tRPC React hooks via createTRPCReact",
      "singleton QueryClient for browser",
      "cookie credentials forwarding via fetch override",
    ]

key-files:
  created:
    - apps/web/src/lib/trpc.ts
    - apps/web/src/components/providers/trpc-provider.tsx
    - apps/web/.env.example
  modified:
    - apps/web/package.json
    - apps/web/tsconfig.json
    - apps/web/src/app/layout.tsx

key-decisions:
  - "TypeScript paths in child tsconfig must duplicate base paths (TS does not merge paths from extends)"
  - "Paths are relative to baseUrl (monorepo root), not the tsconfig file location"
  - "NEXT_PUBLIC_API_URL env var with fallback to localhost:3001 for dev"

patterns-established:
  - "tRPC client pattern: createTRPCReact<AppRouter>() in lib/trpc.ts, import type only for AppRouter"
  - "Provider pattern: TRPCProvider wraps QueryClientProvider, both in client component"
  - "Singleton QueryClient: browser reuses instance, SSR creates fresh per request"
  - "Cross-app type import: @customreport/api/* paths alias for import type from api app"

requirements-completed: [FE-01, AUTHZ-04]

duration: 5min
completed: 2026-04-10
---

# Phase 06 Plan 02: tRPC Client Setup Summary

**tRPC React hooks client with httpBatchLink, cookie credential forwarding, and TRPCProvider wired into Next.js root layout**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-10T21:16:28Z
- **Completed:** 2026-04-10T21:21:40Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Installed @trpc/client, @trpc/react-query, @tanstack/react-query in apps/web
- Created tRPC React hooks client with httpBatchLink pointing to configurable API URL
- Built TRPCProvider component with singleton QueryClient (staleTime: 30s, retry: 1)
- Wired TRPCProvider into root layout.tsx as client component boundary
- Configured TypeScript paths alias for cross-app AppRouter type import

## Task Commits

Each task was committed atomically:

1. **Task 1: Install tRPC client packages and configure AppRouter type path** - `8e7c8f2` (feat)
2. **Task 2: Create tRPC client, TRPCProvider, and wire into root layout** - `550112c` (feat)

## Files Created/Modified

- `apps/web/src/lib/trpc.ts` - tRPC React hooks client with httpBatchLink and cookie credentials
- `apps/web/src/components/providers/trpc-provider.tsx` - Client-side provider wrapping tRPC + TanStack Query
- `apps/web/src/app/layout.tsx` - Root layout updated to wrap children with TRPCProvider
- `apps/web/.env.example` - NEXT_PUBLIC_API_URL environment variable template
- `apps/web/package.json` - Added tRPC and TanStack Query dependencies
- `apps/web/tsconfig.json` - Added paths alias for @customreport/api/\* and duplicated base paths

## Decisions Made

- TypeScript paths in child tsconfig must include all base paths because TS does not merge paths from extends -- discovered during path resolution debugging
- Paths values are relative to baseUrl (monorepo root), not the tsconfig file that declares them -- ../../apps would resolve outside monorepo
- Used NEXT_PUBLIC_API_URL env var with fallback to localhost:3001 for zero-config local development

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript paths resolution failure**

- **Found during:** Task 2 (tRPC client creation)
- **Issue:** Child tsconfig paths override base paths entirely (TS does not merge). Adding only @customreport/api/_caused @customreport/shared and @customreport/ui paths to be lost. Also, paths were incorrectly set as ../../apps/api/src/_ (relative to config file) instead of apps/api/src/\* (relative to baseUrl at monorepo root)
- **Fix:** Duplicated all base tsconfig paths into child tsconfig with correct relative paths from monorepo root baseUrl
- **Files modified:** apps/web/tsconfig.json
- **Verification:** pnpm -F @customreport/web exec tsc --noEmit exits 0
- **Committed in:** 550112c (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Path resolution fix was essential for TypeScript compilation. No scope creep.

## Issues Encountered

None beyond the path resolution issue documented above.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all code is fully wired with real implementations.

## Next Phase Readiness

- tRPC client foundation is complete -- any page can now call `trpc.reports.getActive.useQuery()` etc.
- TRPCProvider is in the root layout, so all pages have access to tRPC hooks
- Ready for Plan 03 (frontend page migrations from localStorage to tRPC)

---

_Phase: 06-auth-frontend-integration_
_Completed: 2026-04-10_
