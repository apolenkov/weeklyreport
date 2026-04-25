# Project Research Summary

**Project:** CustomReport v5.0 Production Integration
**Domain:** Mock-to-real API migration in Next.js 16 + NestJS 11 + tRPC 11 monorepo
**Researched:** 2026-04-25
**Confidence:** HIGH

## Executive Summary

CustomReport v5.0 is a mock-to-real migration: the entire UI exists as a prototype with 36 tested tRPC endpoints, 339 E2E tests, and 7 pages -- but the frontend renders hardcoded mock data and every button manipulates local state only. The migration connects the existing frontend to the existing backend. The tRPC plumbing (client, server, Next.js rewrite, superjson transformer) is 100% ready and needs only a TRPCProvider wrapper in the layout. The real challenge is the type divergence between mock-data presentation types and Zod/Prisma data types: these are fundamentally different semantic models (e.g., 'on-track' vs 'green', 'planned' has no DB equivalent, 'pending' is computed state). This requires a dedicated mapper/adapter layer -- NOT find-and-replace.

The recommended approach follows a strict dependency chain: Seed + Types first (parallel), then tRPC provider wiring, then page-by-page migration with mappers, then mutations/interactivity, with auth/logging as independent parallel tracks and E2E integration tests last. Only 7 container files need mock-to-real conversion (not all 38 import sites) because the codebase already has clean container/presentation separation. The seed must be designed "test-backward" to produce data matching exact E2E assertions. DEV_SESSION hardcodes specific UUIDs that the seed must match exactly, or every query returns empty data.

Key risks: (1) Type divergence breaks compilation if handled via find-and-replace instead of mappers; (2) DEV_SESSION UUID mismatch silently returns empty arrays; (3) React Compiler IS enabled (reactCompiler: true in next.config.ts), which means @trpc/react-query (classic) will break at runtime -- migration to @trpc/tanstack-react-query is mandatory, not deferrable; (4) Status-to-Risk bidirectional sync creates infinite loops without a source-flag guard. Mitigations for all of these are well-understood and documented in the research files.

## Key Findings

### Recommended Stack Additions

No new framework decisions -- v5.0 builds on the existing stack. Only targeted additions:

**New packages (apps/web):**
- `@trpc/tanstack-react-query` ^11.16.0: React Compiler-safe tRPC client -- MANDATORY because reactCompiler: true is enabled and classic @trpc/react-query proxy hooks break under React Compiler
- `client-only` + `server-only`: Required by tRPC RSC setup for boundary markers

**New packages (apps/api):**
- `nestjs-cls` ^6.2.0: Request-scoped correlation ID propagation via AsyncLocalStorage -- integrates with NestJS DI, referenced in official NestJS docs, 500K+ weekly downloads

**Package to remove:**
- `@trpc/react-query`: Breaks under React Compiler (hooks-as-props pattern violates rules of hooks)

**Logger decision (RESOLVED):** The existing custom AppLoggerImpl is NOT pino (STACK.md's recommendation to add pino is overruled). The custom logger already handles structured JSON, daily rotation, pruning, and child loggers. Enhance it with nestjs-cls for correlation ID propagation via AsyncLocalStorage. Do NOT replace with pino or winston -- that is over-engineering for 6 users and risks breaking the existing tested interface.

### Expected Features

**Must have (table stakes) -- without these, v5.0 is still a prototype:**
- **TS-1: Type alignment** -- Mapper layer translating API types to component prop types (6 semantic mismatches identified)
- **TS-2: Database seed** -- Mockup-aligned seed with exact names, UUIDs, and data counts matching current UI
- **TS-3: tRPC client wiring** -- Replace 38 mock imports across 7 containers with useQuery/useMutation calls
- **TS-4: Button interactivity** -- Wire 72 onClick handlers to real tRPC mutations
- **TS-5: Auth session guard** -- proxy.ts cookie check (session-existence only, no role enforcement in v5.0)

**Should have (differentiators):**
- **DF-1: Stage-to-Risk auto-sync** -- User-requested. Auto-create risk when stage set to At Risk/Blocked. Safe/additive.
- **DF-3: Logging enhancement** -- Add nestjs-cls correlation IDs + request/response logging to existing custom logger
- **DF-4: Integration tests** -- 20-30 Playwright tests against real API (separate directory, not replacing mock tests)

**Defer to v6.0:**
- DF-2 (Risk-to-Stage suggestion) -- Requires user confirmation UX, lower priority
- tRPC client RSC prefetching optimization (already forced to migrate client, but RSC prefetch is optional)
- Role-based route guards (PROJECT.md: "admin with full access for regression")
- Component refactor to accept Zod types directly (mapper layer is the v5.0 bridge)

### Architecture Approach

The v4.0 codebase has clean container/presentation separation: 7 container components import mock constants and pass data as props to 25+ pure presentation children. Migration changes only the data source in containers; children stay untouched. The tRPC provider mounts as a 'use client' component in the (app)/layout.tsx (not root layout) to limit blast radius -- the login page does not need tRPC. QueryClient MUST be created inside the provider via useState, not as a module-level variable, because module-level state leaks across SSR requests in Next.js App Router.

**Major components of the migration:**

1. **Mapper layer** (apps/web/src/lib/mappers/) -- Pure functions translating API response shapes to existing component prop shapes. 8 mapper files covering traffic-light status, lead status, item status, dashboard aggregation, weekly report, lead form, and admin panel.
2. **TRPCProvider** (apps/web/src/components/providers/trpc-provider.tsx) -- 'use client' wrapper with QueryClientProvider + tRPC provider. Mounts in (app)/layout.tsx.
3. **Seed rewrite** (prisma/seed.ts + prisma/seed-constants.ts) -- Test-backward seed with hardcoded DEV_SESSION UUIDs, canonical names from lead/dashboard mocks, data counts matching E2E assertions.

### Critical Pitfalls

1. **Type divergence is semantic, not cosmetic** -- Mock types and Zod types represent different data models ('on-track' vs 'green', computed states like 'pending'/'planned' with no DB enum). Build a mapper layer with unit tests. Detection: as any or @ts-ignore near tRPC query results.

2. **DEV_SESSION UUID mismatch returns empty data** -- trpc.context.ts hardcodes userId: 'a0000000-...-99' and activeReportId: 'a0000000-...-01'. Seed MUST create users/reports with these exact IDs. Also: activeReportSectionId is null -- context factory should dynamically resolve it from DB.

3. **React Compiler breaks classic tRPC hooks** -- reactCompiler: true is enabled in next.config.ts. The @trpc/react-query proxy hooks violate rules of hooks. Migration to @trpc/tanstack-react-query queryOptions pattern is mandatory.

4. **339 E2E tests break three ways simultaneously** -- Data mismatch (seed vs mock names), format mismatch (Date objects vs display strings), loading state mismatch (async queries vs synchronous mock). Prevention: test-backward seed design, one-page-at-a-time wiring, run tests after each page.

5. **Status-to-Risk sync creates infinite loops** -- Stage change triggers risk creation, risk creation triggers stage change. Use a SyncSource ref flag ('user' | 'auto-sync'), NOT debounce. Auto-sync only fires on user-initiated actions.

**Dismissed:** PITFALLS.md Pitfall 7 claims no /trpc rewrite exists in next.config.ts. This is factually wrong -- verified: rewrites with /trpc/:path* destination already configured. Ignore this pitfall.

## Implications for Roadmap

### Phase 1: Seed + Type Foundation
**Rationale:** Everything depends on matching data and correct types. These two are independent of each other and can run in parallel.
**Delivers:** (a) Test-backward seed in prisma/seed.ts with DEV_SESSION UUIDs, canonical names, mockup-aligned data counts; (b) Mapper layer in apps/web/src/lib/mappers/ with unit tests for all 6 semantic mismatches; (c) seed-constants.ts as single source of truth for names/IDs.
**Addresses:** TS-1, TS-2
**Avoids:** Pitfalls 1 (type divergence), 3 (UUID mismatch), 6 (name inconsistency across mocks)

### Phase 2: tRPC Provider + Client Migration
**Rationale:** Unblocks all page wiring. Must happen before any useQuery call. Includes mandatory migration from @trpc/react-query to @trpc/tanstack-react-query because React Compiler is enabled.
**Delivers:** (a) TRPCProvider in (app)/layout.tsx; (b) New tRPC client using createTRPCOptionsProxy with queryOptions pattern; (c) Error boundaries around major page sections; (d) Smoke test proving superjson Date roundtrip works.
**Addresses:** TS-3 (prerequisite)
**Avoids:** Pitfalls 2 (white-screen on provider add), 8 (superjson Date serialization)
**Research flag:** Verify exact @trpc/tanstack-react-query API surface -- STACK.md notes "verify exact import names against package exports during implementation."

### Phase 3: Page-by-Page tRPC Wiring
**Rationale:** Incremental migration limits blast radius. One page at a time, run E2E after each.
**Delivers:** All 7 container components using real tRPC queries instead of mock data. Loading skeletons for async states.
**Order within phase (simplest to most complex):**
1. Lead History (single endpoint, flat data)
2. Admin Panel (single snapshot endpoint, 6 tabs)
3. Weekly Report + Archive pages (single endpoint, shape mapping)
4. Dashboard (3 endpoints, computed KPI)
5. Lead Form (4+ endpoints, complex state)
**Addresses:** TS-3
**Avoids:** Pitfall 4 (E2E three-way breakage -- caught incrementally), Pitfall 11 (loading states)

### Phase 4: Button Interactivity + Status-Risk Sync
**Rationale:** Mutations depend on queries being stable. Status-Risk sync is user-requested and builds on mutation infrastructure.
**Delivers:** (a) 72 onClick handlers wired to real mutations; (b) Stage-to-Risk auto-create (safe/additive direction); (c) Optimistic updates for perceived instant feedback.
**Addresses:** TS-4, DF-1
**Avoids:** Pitfall 5 (infinite loop -- source flag pattern)
**Note on DF-2:** Risk-to-Stage suggestion (reverse direction) requires user confirmation and should defer to v6.0. Stage-to-Risk is safe because adding a risk row is additive. Risk-to-Stage changes dashboard state and needs consent.

### Phase 5: Auth Session Guard (parallel with Phase 3-4)
**Rationale:** Independent of mock-to-real migration. Can start as soon as provider exists.
**Delivers:** (a) proxy.ts cookie-existence check redirecting unauthenticated users; (b) Session context in (app)/layout.tsx for NavBar user display; (c) AUTH_DEV_MODE respected on both frontend and backend.
**Addresses:** TS-5
**Avoids:** Pitfall 9 (split-brain between frontend guard and backend DEV_MODE)

### Phase 6: Logging Enhancement (parallel with Phase 3-4)
**Rationale:** Fully independent. No UI impact. Can run in parallel with any other phase.
**Delivers:** (a) nestjs-cls integration for request-scoped correlation IDs; (b) CorrelationIdMiddleware stores ID via ClsService; (c) tRPC request/response logging middleware (procedure, userId, durationMs); (d) Error serialization improvement.
**Addresses:** DF-3
**Avoids:** Pitfall 10 (logger is NOT pino -- enhance, do not replace)

### Phase 7: E2E Integration Tests
**Rationale:** Must come last -- requires all wiring stable, seed correct, auth working.
**Delivers:** (a) New e2e/integration/ directory (separate from existing mock tests); (b) Playwright dual-server config (API + Web); (c) Auth setup via dev-login endpoint; (d) 20-30 core integration tests proving full stack; (e) Existing 339 mock-based tests preserved as regression safety net.
**Addresses:** DF-4
**Avoids:** Pitfall 4 Phase C (assertion updates for legitimate format changes), Pitfall 13 (storage state update)

### Phase Ordering Rationale

The ordering is load-bearing:
- **Seed + Types first** because every subsequent phase depends on data existing in PostgreSQL and mappers transforming it correctly. Doing these in parallel saves time (they are independent).
- **Provider + client migration second** because no useQuery call works without it, and the React Compiler forces the classic-to-new migration to happen at this stage, not later.
- **Page wiring third** because queries must work before mutations make sense.
- **Mutations fourth** because button interactivity requires stable read paths.
- **Auth and logging are parallel** because they have zero dependency on the mock-to-real migration.
- **E2E last** because integration tests need all other layers working.

### Research Flags

**Needs deeper research during planning:**
- **Phase 2 (tRPC client migration):** Verify exact @trpc/tanstack-react-query exports and queryOptions API against installed version. STACK.md notes to check import names at implementation time.
- **Phase 4 (Status-Risk sync):** Custom UX with no off-the-shelf pattern. Edge cases (multiple risks per product+stage, locked stages, revert to On Track) need design review during planning.

**Standard patterns (skip research-phase):**
- **Phase 1 (Seed + Mappers):** Well-understood Prisma seed + pure function mappers. No research needed.
- **Phase 3 (Page wiring):** tRPC useQuery/useMutation is thoroughly documented. Pattern is mechanical.
- **Phase 5 (Auth guard):** Next.js 16 proxy.ts pattern is documented. Existing code covers 90% of the work.
- **Phase 6 (Logging):** nestjs-cls setup is documented in official NestJS recipes.
- **Phase 7 (E2E):** Playwright dual-server config is documented feature. auth.setup.ts pattern already exists.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | All packages verified against installed versions. React Compiler status confirmed by inspecting next.config.ts. Only gap: pino-roll 4.0 + pino 10 exact compat (irrelevant since we keep custom logger). |
| Features | **HIGH** | Full codebase inspection: 38 mock imports counted, 72 interactive elements inventoried, dependency graph derived from import analysis. |
| Architecture | **HIGH** | Container/presentation split verified file-by-file. tRPC plumbing (client, server, rewrite) all confirmed in source. Data flow traced end-to-end. |
| Pitfalls | **HIGH** | 13 of 14 pitfalls verified against actual codebase. Pitfall 7 (no /trpc rewrite) dismissed as factually incorrect. |

**Overall confidence:** HIGH

### Gaps to Address

- **Seed assertion coverage:** E2E assertion extraction was sampled, not exhaustive. During Phase 1, a full grep of all E2E expect() calls asserting data-dependent strings is needed to ensure the seed produces matching values.
- **@trpc/tanstack-react-query exact API surface:** Import names and factory function signatures should be verified against the installed package version before writing the provider. STACK.md flagged this.
- **activeReportSectionId resolution:** DEV_SESSION sets this to null. The context factory or seed must resolve it. Two options exist (dynamic DB lookup vs hardcoded in seed) -- decision deferred to Phase 1 implementation.
- **Admin mock name reconciliation:** Admin mock uses different names than lead/dashboard mocks ("CRM Portal" vs "CRM Platform"). Canonical names must be chosen (recommend lead/dashboard names) and admin E2E tests updated.

## Sources

### Primary (HIGH confidence -- direct codebase inspection)
- apps/web/next.config.ts -- Confirmed: reactCompiler: true, /trpc/:path* rewrite exists
- apps/web/src/lib/trpc.ts -- tRPC client configured with superjson, unused
- apps/api/src/infrastructure/trpc/trpc.context.ts -- DEV_SESSION UUIDs hardcoded
- apps/api/src/lib/logger.ts -- Custom AppLoggerImpl, NOT pino
- apps/web/src/components/*/mock-data.ts -- 3 files, 15+ types, divergent from Zod schemas
- packages/shared/src/schemas/report.ts -- Canonical Zod schemas
- prisma/schema.prisma -- 19 models, traffic light + workflow status enums

### Secondary (HIGH confidence -- official documentation)
- [tRPC TanStack React Query Setup](https://trpc.io/docs/client/tanstack-react-query/setup)
- [tRPC React Compiler Migration Blog](https://trpc.io/blog/introducing-tanstack-react-query-client)
- [nestjs-cls Official Docs](https://papooch.github.io/nestjs-cls/introduction/quick-start)
- [NestJS AsyncLocalStorage Recipe](https://docs.nestjs.com/recipes/async-local-storage)
- [Playwright Multi-Server Config](https://playwright.dev/docs/test-global-setup-teardown)
- [Next.js 16 proxy.ts Convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)

### Tertiary (MEDIUM confidence -- needs validation during implementation)
- pino-roll 4.0 + pino 10 compatibility (same author, same protocol, no explicit statement) -- irrelevant for v5.0 since we keep custom logger
- @trpc/tanstack-react-query exact export names -- verify against installed package

---
*Research completed: 2026-04-25*
*Ready for roadmap: yes*
