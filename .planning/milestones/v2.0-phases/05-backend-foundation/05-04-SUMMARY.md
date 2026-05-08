---
phase: 05-backend-foundation
plan: 04
subsystem: api
tags:
  [
    trpc,
    nestjs,
    express,
    helmet,
    cors,
    cookie-parser,
    auth-middleware,
    error-mapping,
  ]

requires:
  - phase: 05-02
    provides: "NestJS AppModule with all 8 domain modules, Zod env validation"
  - phase: 05-03
    provides: "All 8 Prisma repository implementations wired to services via DI"

provides:
  - "tRPC Express middleware mounted at /trpc on NestJS HTTP server"
  - "Unified AppRouter with 7 namespaces exposing all 8 domain services"
  - "Dev bypass auth context (AUTH_DEV_MODE=true returns head session)"
  - "Domain error to TRPCError mapping for all 8 error classes"
  - "protectedProcedure and headProcedure tRPC middleware for role-based access"
  - "NestJS bootstrap with helmet, cookie-parser, CORS, and Zod env validation"

affects: [05-05, 06-auth-frontend]

tech-stack:
  added:
    [
      "@nestjs/platform-express",
      "helmet",
      "cookie-parser",
      "@types/cookie-parser",
      "@types/express",
    ]
  patterns:
    - "tRPC Express middleware on NestJS: app.getHttpAdapter().getInstance().use('/trpc', createExpressMiddleware(...))"
    - "Service resolution via app.get(ServiceClass) for tRPC router dependency injection"
    - "mapDomainError pattern: catch domain errors in each procedure handler, rethrow as TRPCError"
    - "initTRPC.context<TrpcContext>().create() for typed tRPC context with UserSession"

key-files:
  created:
    - "apps/api/src/infrastructure/trpc/trpc.context.ts"
    - "apps/api/src/infrastructure/trpc/trpc.error-mapper.ts"
    - "apps/api/src/infrastructure/trpc/trpc.middleware.ts"
    - "apps/api/src/infrastructure/trpc/trpc.router.ts"
  modified:
    - "apps/api/src/main.ts"
    - "apps/api/src/modules/admin/admin.service.ts"
    - "apps/api/package.json"

key-decisions:
  - "tRPC mounted as Express middleware on NestJS HTTP adapter (not NestJS standalone adapter) -- uses createExpressMiddleware from @trpc/server/adapters/express"
  - "Service resolution via app.get() outside NestJS DI -- services resolved at bootstrap time and passed as RouterDeps object to createAppRouter"
  - "Auth enforcement via tRPC middleware (protectedProcedure/headProcedure) not NestJS guards -- guards are bypassed on tRPC routes (critical pitfall #3)"
  - "Added removeProject and removeReminderRule to AdminService -- plan referenced delete methods that did not exist"

patterns-established:
  - "Pattern: try/catch + mapDomainError in every tRPC procedure handler"
  - "Pattern: Namespaced tRPC routers (reports, review, pdfExport, admin, archive, reminders, carryOver)"
  - "Pattern: DEV_SESSION hardcoded head user for development without auth infrastructure"
  - "Pattern: headProcedure for admin-only endpoints, protectedProcedure for any-authenticated-user endpoints"

requirements-completed: [API-02, API-03, API-06, API-07]

duration: 8min
completed: 2026-04-10
---

# Phase 5 Plan 04: tRPC AppRouter + NestJS Bootstrap Summary

**NestJS HTTP server with tRPC Express middleware at /trpc, unified AppRouter exposing all 8 domain services across 7 namespaces, dev bypass auth, and domain error mapping to tRPC error codes**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-10T16:59:23Z
- **Completed:** 2026-04-10T17:07:23Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- tRPC Express middleware mounted at /trpc on NestJS HTTP server with helmet, cookie-parser, and CORS
- Unified AppRouter with 7 namespaces (reports, review, pdfExport, admin, archive, reminders, carryOver) covering all 8 domain services
- Dev bypass auth context returns hardcoded head session when AUTH_DEV_MODE=true, enabling tRPC endpoint testing before SAML is wired
- Domain error mapper handles all 8 error classes (ReportSectionDomainError, ReviewAccessError, PublicationAccessError, AdminAccessError, PdfExportDomainError, ReminderDomainError, CarryOverDomainError, ArchiveDomainError) with correct tRPC codes
- tRPC middleware exports protectedProcedure (any authenticated user) and headProcedure (head role only) for role-based access control

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tRPC context, error mapper, and middleware** - `055d5e6` (feat)
2. **Task 2: Create unified tRPC AppRouter and rewrite main.ts bootstrap** - `ea88dcb` (feat)

## Files Created/Modified

- `apps/api/src/infrastructure/trpc/trpc.context.ts` - Context factory with DEV_SESSION when AUTH_DEV_MODE=true, Phase 6 placeholder for JWT extraction
- `apps/api/src/infrastructure/trpc/trpc.error-mapper.ts` - Maps all 8 domain error classes to correct TRPCError codes (BAD_REQUEST, FORBIDDEN, CONFLICT, NOT_FOUND)
- `apps/api/src/infrastructure/trpc/trpc.middleware.ts` - initTRPC with typed context, exports publicProcedure, protectedProcedure, headProcedure, router, mergeRouters
- `apps/api/src/infrastructure/trpc/trpc.router.ts` - Unified AppRouter factory receiving RouterDeps, 7 namespaced sub-routers with try/catch + mapDomainError
- `apps/api/src/main.ts` - Rewritten bootstrap: NestJS create, helmet, cookieParser, CORS, 8 services resolved via app.get(), tRPC middleware mounted at /trpc
- `apps/api/src/modules/admin/admin.service.ts` - Added removeProject (archive via snapshot) and removeReminderRule (filter from snapshot)
- `apps/api/package.json` - Added helmet, cookie-parser, @nestjs/platform-express, @types/cookie-parser, @types/express

## Decisions Made

1. **tRPC Express middleware on NestJS HTTP adapter**: Used `app.getHttpAdapter().getInstance()` to get the underlying Express app and mount tRPC middleware. This is the standard pattern for integrating tRPC with NestJS when both need to coexist.

2. **Service resolution via app.get()**: All 8 services are resolved from the NestJS DI container at bootstrap time using `app.get(ServiceClass)` and passed as a RouterDeps object. This avoids coupling tRPC procedures to NestJS decorator-based injection.

3. **Auth as tRPC middleware not NestJS guards**: per STATE.md critical pitfall #3, NestJS guards are silently bypassed on tRPC routes. Auth enforcement is implemented as tRPC middleware (`isAuthed`, `isHead`) that inspects `ctx.session`.

4. **Added removeProject and removeReminderRule to AdminService**: Plan referenced `deleteProject` and `deleteReminderRule` tRPC procedures but AdminService only had `removeUser`. Added two new methods following the same snapshot-based pattern (removeProject archives, removeReminderRule filters from snapshot).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added removeProject and removeReminderRule to AdminService**

- **Found during:** Task 2 (AppRouter implementation)
- **Issue:** Plan specified deleteProject and deleteReminderRule tRPC procedures but AdminService lacked corresponding methods. Only removeUser existed.
- **Fix:** Added `removeProject(projectId)` (archives project via snapshot) and `removeReminderRule(ruleId)` (filters rule from snapshot) following the same pattern as existing `removeUser`.
- **Files modified:** apps/api/src/modules/admin/admin.service.ts
- **Verification:** TypeScript compiles clean
- **Committed in:** ea88dcb (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for correctness -- tRPC procedures need service methods to call. No scope creep.

## Issues Encountered

- Integration test files from Plan 05-05 (another parallel agent) reference `prisma-test-helper` module that doesn't exist yet, causing 8 TS2307 errors. These are out of scope -- all errors are in `*.integration.test.ts` files, not in plan 05-04 source files.

## Known Stubs

- `trpc.context.ts` line 26: `// Phase 6: extract JWT from cookie, verify, return session` -- placeholder for real auth, returns `{ session: null }` when AUTH_DEV_MODE is not true. Will be resolved in Phase 6 (Auth & Frontend Integration).

## User Setup Required

None - no external service configuration required. Set `AUTH_DEV_MODE=true` in .env to enable dev bypass auth.

## Next Phase Readiness

- All 8 domain services are now exposed via tRPC endpoints at /trpc
- Ready for Plan 05-05 (integration tests) to verify repository implementations against real PostgreSQL
- Ready for Phase 6 to replace DEV_SESSION with real JWT auth (trpc.context.ts Phase 6 placeholder)
- `curl localhost:3001/trpc/reports.getActive` will return data when AUTH_DEV_MODE=true and PostgreSQL is running with seed data

## Self-Check: PASSED

- All 4 created files exist on disk
- Both modified files verified present
- Task commit 055d5e6 found in git log
- Task commit ea88dcb found in git log
- SUMMARY.md created at expected path

---

_Phase: 05-backend-foundation_
_Completed: 2026-04-10_
