# Domain Pitfalls -- v5.0 Production Integration

**Domain:** Mock-to-real API migration in existing Next.js 16 + NestJS 11 + tRPC 11 monorepo
**Researched:** 2026-04-25
**Confidence:** HIGH (all findings verified against actual codebase files)

---

## Critical Pitfalls

Mistakes that cause white-screens, broken test suites, or require architectural rework.

---

### Pitfall 1: Type System Divergence Is Semantic, Not Cosmetic

**What goes wrong:** The mock types and Zod API types represent fundamentally different data models. A search-and-replace will not work -- a mapping/adapter layer is required.

**Specific mismatches found in this codebase:**

| Mock Type (UI) | Zod/Prisma Type (API) | Problem |
|---|---|---|
| `StageStatus: 'on-track' \| 'at-risk' \| 'blocked' \| 'empty'` | `TrafficLightStatus: 'green' \| 'yellow' \| 'red'` | Entirely different semantic models. "empty" has no API equivalent. "on-track" is not "green" -- the UI concept includes stage ownership context. |
| `ItemStatus: 'in-progress' \| 'completed' \| 'blocked' \| 'planned'` | `ItemWorkflowStatus: 'done' \| 'in_progress' \| 'blocked'` | 4 values vs 3. `'planned'` does not exist in DB. `'completed'` vs `'done'` naming. Hyphen vs underscore (`in-progress` vs `in_progress`). |
| `Product.stages: StageAssignment[]` with `ownership: 'mine' \| 'locked' \| 'unassigned'` | `stageAssignmentSchema` is a flat admin entity (`userId, stageId, projectId`) | Ownership is computed from current user's session vs stage assignment records -- not stored as an enum value. |
| Dates: `"2 min ago"`, `"Apr 13, 17:42"`, `"2026-04-18"` (display strings) | `z.coerce.date()` returns `Date` objects via superjson | Every component touching dates needs formatting logic added. |
| `MockReminder: { name, description, active: boolean }` | `adminReminderRuleSchema: { kind: 'deadline' \| 'follow_up', status: 'active' \| 'paused', fireAt: Date, ... }` | Completely different shape. Mock is a display label; API is a rule engine config with 7 fields. |
| `MockPeriod: { weekLabel, startDate: string, status: 'open' \| 'published' \| 'reopened' }` | `periodReadModelSchema: { periodStart: Date, periodEnd: Date, deadline: Date, status: ReportStatus, periodStatus: PeriodStatus }` | Period has TWO status fields in API (`status` for report, `periodStatus` for period lifecycle). Dates are `Date` objects, not strings. `weekLabel` is computed server-side and nullable. |

**Why it happens:** The UI was designed from mockups (product-centric view with stage ownership and traffic metaphors), while the API was designed from domain models (report-section-centric with traffic light enums). These are intentionally different abstractions.

**Consequences:** If you try to directly replace mock imports with tRPC query results, TypeScript will reject nearly every component. If you `as any` your way through, runtime crashes will follow because components access properties that do not exist on API types.

**Prevention -- build a mapping layer:**

```typescript
// apps/web/src/lib/api-mappers.ts

// Map API traffic light to UI stage status
export function trafficToStageStatus(
  trafficLight: 'green' | 'yellow' | 'red' | null
): StageStatus {
  switch (trafficLight) {
    case 'green': return 'on-track';
    case 'yellow': return 'at-risk';
    case 'red': return 'blocked';
    case null: return 'empty';
  }
}

// Map API workflow status to UI item status
export function workflowToItemStatus(
  ws: 'done' | 'in_progress' | 'blocked'
): 'completed' | 'in-progress' | 'blocked' {
  switch (ws) {
    case 'done': return 'completed';
    case 'in_progress': return 'in-progress';
    case 'blocked': return 'blocked';
  }
}
// Note: 'planned' items are Next Week items with no workflowStatus yet --
// derive from item.type === 'next' rather than a DB enum value.
```

**Detection:** If you see `as any` or `@ts-ignore` near tRPC query results, the mapping layer is missing.

---

### Pitfall 2: No TRPCProvider Exists -- Big-Bang Rendering Risk

**What goes wrong:** The root layout (`apps/web/src/app/layout.tsx`) contains no `QueryClientProvider` and no `trpc.Provider`. Adding these is a prerequisite for ANY tRPC wiring, but it changes the rendering context for every page simultaneously.

**Current state:** Root layout is bare:
```tsx
<html><body>{children}</body></html>
```

The `(app)/layout.tsx` adds only `<NavBar />`. No providers anywhere in the tree.

**Why it happens:** The tRPC client was created (`apps/web/src/lib/trpc.ts` -- exists with superjson, httpBatchLink, credentials: include) but never wrapped into the component tree. This was intentionally deferred to v5.0. Dependencies are already installed (`@tanstack/react-query` ^5.97.0, `@trpc/react-query` ^11.16.0).

**Consequences:** The moment you add `<TRPCProvider>` + `<QueryClientProvider>`, every `'use client'` component now lives inside a React Query context. If ANY child component has an unconditional `useQuery` that calls a nonexistent endpoint or fails auth, the entire app white-screens with an unhandled promise rejection. No page loads until all initial queries succeed or are error-handled.

**Prevention:**
1. Add React Error Boundaries BEFORE wiring the provider. Each major page section should be wrapped in a `QueryErrorBoundary` so one failing query does not cascade.
2. Wire TRPCProvider in a dedicated `'use client'` component that wraps the `(app)/layout.tsx`, NOT the root layout -- this way the login page (`/auth/error`) remains unaffected.
3. Use `<Suspense>` boundaries around each tRPC-dependent section so loading states are contained.
4. Test the provider with a single harmless query (e.g., `reports.getActive`) on one page before wiring all pages.

**Detection:** White screen on any page after adding provider = missing error boundary or failing auth context.

---

### Pitfall 3: DEV_SESSION UUID Mismatch Will Return Empty Data

**What goes wrong:** The tRPC context factory (`trpc.context.ts`) hardcodes a dev session with specific UUIDs:
```typescript
const DEV_SESSION: UserSession = {
  userId: 'a0000000-0000-4000-8000-000000000099',
  activeReportId: 'a0000000-0000-4000-8000-000000000001',
  activeReportSectionId: null,
};
```

Two separate failures hide here:
1. If the seed script generates different UUIDs (which it will by default using `randomUUID()`), every tRPC query that filters by `ctx.session.userId` or `ctx.session.activeReportId` returns null or empty arrays.
2. `activeReportSectionId` is hardcoded to `null`. The `reports.getActive` endpoint checks this field and returns `null` when it is not set. Even with correct user and report UUIDs, the lead form's "get my active section" call returns nothing. The seed or the context factory must look up the section ID from the DB by `userId + reportId`.

The app looks "connected" but shows no data.

**Why it happens:** The seed is built in isolation from the auth context. Nobody checks that the two UUID sets match because in production they come from the same database -- but in dev mode, the session is faked.

**Consequences:** You wire up tRPC, see empty pages, and spend hours debugging the API layer when the real problem is a UUID mismatch in the seed.

**Prevention:**
1. The seed script MUST create a user with `id = 'a0000000-0000-4000-8000-000000000099'` (the head user) and a report with `id = 'a0000000-0000-4000-8000-000000000001'`.
2. The context factory should dynamically resolve `activeReportSectionId` from the database when it is null:
```typescript
if (!session.activeReportSectionId && session.activeReportId && session.userId) {
  const section = await prisma.reportSection.findFirst({
    where: { reportId: session.activeReportId, authorId: session.userId },
    select: { id: true },
  });
  if (section) session.activeReportSectionId = section.id;
}
```
3. OR make DEV_SESSION configurable via env vars so the seed can set them.
4. Add a startup health check: on app boot in dev mode, verify `DEV_SESSION.userId` exists in the database. Log a loud warning if it does not.
5. Document the required UUIDs in a `prisma/seed-constants.ts` file so seed and context stay in sync.

**Detection:** All pages render but show "No data" or empty states after seed + tRPC wiring.

---

### Pitfall 4: 339 E2E Tests Break Three Different Ways Simultaneously

**What goes wrong:** Current Playwright tests assert on specific strings from mock data:
```typescript
// lead-journey.spec.ts line 45
await expect(leadPage.getByText('CRM Platform').first()).toBeVisible();
// line 73
await expect(periodSelect).toHaveValue('2026-W16');
```

When switching from mock to real API, tests break in three separate failure modes simultaneously, making individual failures impossible to diagnose.

**Three failure modes:**
1. **Data mismatch:** Seed produces different names/values than mocks. Admin mock says "CRM Portal", lead mock says "CRM Platform" -- which does the seed use?
2. **Format mismatch:** API returns `Date` objects that must be formatted. If formatting produces "Apr 14, 2026" instead of "Apr 14-20", string assertions break.
3. **Loading state mismatch:** Mock data is synchronous and immediate. Real API calls go through React Query -- components render a loading/skeleton state first. Tests that do not wait for data loading will assert against empty elements.

**Why it happens:** Tests were written against deterministic mock data. Real API adds network latency, database state, and async rendering into the assertion chain.

**Consequences:** 100+ test failures on the first run. Without a clear migration strategy, debugging each failure individually takes 5-10 minutes each.

**Prevention -- phased migration (this ordering is load-bearing):**

**Phase A: Seed matches mock data exactly**
- Product names MUST match the canonical set from lead/dashboard mocks: "CRM Platform", "Data Analytics Suite", "Mobile Applications", "Cloud Infrastructure", "AI/ML Platform", "Integration Gateway", "Payment Gateway", "Auth Service", "Notification Hub", "Admin Portal", "Logging Platform", "CDN Service".
- User names MUST match: "Platanov A.", "Maria K.", "Igor V.", "Dmitry S.", "Olga N.", "Sergey T."
- Period dates MUST include Week 16 (Apr 14-20) as the current period.

**Phase B: Wire tRPC, verify same rendering**
- Replace mock imports with tRPC queries one page at a time.
- Run that page's E2E test file after each replacement.
- If a test breaks, the issue is in the wiring or mapping layer, not the data.

**Phase C: Update assertions for legitimate format changes**
- Only NOW update test assertions for real format differences (date formatting, etc.).
- Each change is isolated and traceable.

**Detection:** If more than 10 tests fail when switching one page from mock to real, the seed data does not match the mock data. Stop and fix the seed first.

---

### Pitfall 5: Status-to-Risk Bidirectional Sync Creates Infinite Loops

**What goes wrong:** The requirement says: "When stage status changes to At Risk/Blocked, auto-add a risk row. When a risk is added, auto-update stage status." This is a textbook infinite loop trigger: change A triggers B, B triggers A, A triggers B...

**Why it happens:** Both directions use the same `onChange`/`useMutation` handlers. Without a guard, the auto-sync triggers itself recursively.

**Consequences:** Browser tab freezes (React re-renders infinitely), or the mutation fires in a tight loop until rate-limited or the request queue overflows.

**Prevention -- use a sync source flag (not debounce):**

```typescript
// apps/web/src/hooks/use-status-risk-sync.ts

type SyncSource = 'user' | 'auto-sync';

function useStatusRiskSync() {
  const syncSourceRef = useRef<SyncSource>('user');

  const handleStageStatusChange = useCallback((
    productId: string, stageName: string,
    newStatus: StageStatus, source: SyncSource = 'user'
  ) => {
    updateStageStatus(productId, stageName, newStatus);

    // Only auto-create risk if this was a USER action, not an auto-sync
    if (source === 'user' && (newStatus === 'at-risk' || newStatus === 'blocked')) {
      syncSourceRef.current = 'auto-sync';
      addRiskRow(productId, stageName, newStatus === 'blocked' ? 'blocked' : 'at-risk');
      syncSourceRef.current = 'user';
    }
  }, []);

  const handleRiskAdded = useCallback((
    productId: string, stageName: string,
    severity: 'at-risk' | 'blocked', source: SyncSource = 'user'
  ) => {
    addRisk(productId, stageName, severity);

    // Only auto-update status if this was a USER action
    if (source === 'user') {
      syncSourceRef.current = 'auto-sync';
      handleStageStatusChange(productId, stageName,
        severity === 'blocked' ? 'blocked' : 'at-risk', 'auto-sync');
      syncSourceRef.current = 'user';
    }
  }, []);

  return { handleStageStatusChange, handleRiskAdded };
}
```

**Why not debounce:** Debounce is time-based -- it delays but does not prevent the loop. With async mutations, timing is unpredictable. A 200ms debounce might work locally but fail under network latency. The source flag is deterministic.

**Why not one-direction-only:** The requirement explicitly says bidirectional. Restricting to one direction violates the spec.

**Detection:** Browser DevTools shows rapidly increasing React renders on the lead form page, or the Network tab shows repeated mutation calls to the same endpoint in quick succession.

---

### Pitfall 6: Admin Mock Data Uses Different Names Than Lead/Dashboard Mock Data

**What goes wrong:** The three mock-data files use inconsistent product and user names:

| Entity | Lead Mock | Dashboard Mock | Admin Mock |
|---|---|---|---|
| CRM product | "CRM Platform" | "CRM Platform" | "CRM Portal" |
| Analytics | "Data Analytics Suite" | "Data Analytics Suite" | "Analytics Dashboard" |
| Mobile | "Mobile Applications" | "Mobile Applications" | "Mobile App" |
| Lead 1 | "Platanov A." | "Platanov A." | "Alexey Petrov" |
| Lead 2 | "Maria K." | "Maria K." | "Maria Ivanova" |
| Stage name | "Dev" | "Dev" | "Development" |

**Why it happens:** Mock files were written independently for different UI sections, not as a shared data contract.

**Consequences:** The seed script must commit to ONE canonical set of names. Whichever you pick, some existing E2E assertions will break. If you do not notice the divergence, admin panel tests break while lead tests pass (or vice versa).

**Prevention:**
1. Create a single `prisma/seed-constants.ts` file that defines ALL canonical names, used by both the seed script and referenced by E2E test expectations.
2. Use lead/dashboard mock names as canonical (they have more test coverage) -- update admin panel tests to expect these names.
3. Stage names: use full name ("Development") in DB `Stage` table, abbreviate to "Dev" in the UI mapping layer.

**Detection:** Admin panel E2E tests break while lead/dashboard tests pass, or vice versa.

---

## Moderate Pitfalls

### Pitfall 7: Next.js 16 API Proxying Requires Configuration -- tRPC Requests Will 404

**What goes wrong:** The tRPC client is configured to call `/trpc` on the same origin (`url: '/trpc'` in `apps/web/src/lib/trpc.ts`). The Next.js dev server runs on port 3000, the NestJS API on port 3001. Without proxy configuration, all `/trpc` requests hit Next.js's own server, return 404, and every query fails silently.

**Current state:** No `proxy.ts` file exists. No API rewrites in `next.config.ts`.

**Prevention:** Add rewrites to `next.config.ts`:
```typescript
// next.config.ts
export default {
  async rewrites() {
    return [
      { source: '/trpc/:path*', destination: 'http://localhost:3001/trpc/:path*' },
    ];
  },
};
```

This approach is more reliable than `proxy.ts` for API forwarding and works in both dev and production (with proper URL configuration).

**Detection:** Network tab shows 404 on all `/trpc/*` requests. Console shows `TRPCClientError: Not Found`.

---

### Pitfall 8: superjson Date Serialization Breaks Without Transformer on BOTH Sides

**What goes wrong:** tRPC with superjson serializes `Date` objects to `{ __type: "Date", value: "..." }`. If the transformer is missing on either the client or server, dates arrive as plain strings and `Date` methods fail at runtime.

**Current state:** Server has superjson transformer (`trpc.middleware.ts` line 7: `initTRPC...create({ transformer: superjson })`). Client has it too (`trpc.ts` line 13: `transformer: superjson` in httpBatchLink). Both are correctly configured. But since no TRPCProvider exists yet, when adding it, the transformer must be passed correctly.

**Known history:** This exact bug already caused 17 TypeScript errors in this project (documented in `feedback_trpc_superjson.md`).

**Prevention:** After wiring the TRPCProvider, write a smoke test:
```typescript
test('superjson roundtrips Date objects', async () => {
  const result = await trpc.reports.myHistory.query();
  expect(result[0]?.periodStart).toBeInstanceOf(Date);
});
```

**Detection:** `TypeError: periodStart.toLocaleDateString is not a function` -- date was deserialized as string, not Date.

---

### Pitfall 9: Auth Guards + DEV_MODE Split-Brain State

**What goes wrong:** Adding session middleware/guards to `(app)/` routes will redirect unauthenticated users to `/auth/login`. But in development with `AUTH_DEV_MODE=true`, the tRPC context provides a fake session on the backend while the frontend has no session cookie. Split-brain: API calls succeed, but frontend route guards redirect to login.

**Current state:** `(app)/layout.tsx` has a TODO comment about session extraction ("Phase 10+"). No auth guard exists on frontend routes.

**Prevention:**
1. Frontend auth guard must also respect `AUTH_DEV_MODE`:
```typescript
// In (app)/layout.tsx server component
export default async function AppGroupLayout({ children }) {
  if (process.env.AUTH_DEV_MODE !== 'true') {
    const session = await getServerSession();
    if (!session) redirect('/auth/login');
  }
  return <><NavBar />{children}</>;
}
```
2. In E2E tests, either set `AUTH_DEV_MODE=true` or use the auth.setup.ts fixture (which already creates storage state files for lead/head roles).

**Detection:** Redirect loop between `/auth/login` and `/(app)/` pages in dev mode.

---

### Pitfall 10: Custom Logger Is NOT Pino -- Milestone Description Is Incorrect

**What goes wrong:** The milestone context states "pino already exists, adding file rotation + correlation IDs." Reality from the actual codebase:

`apps/api/src/lib/logger.ts` is a **custom hand-rolled JSON logger** with these capabilities:

| Feature | Status |
|---|---|
| JSON structured output to stdout/stderr | Has |
| Daily file rotation with configurable retention (14 days) | Has |
| Child loggers with base context | Has |
| Log level filtering (debug/info/warn/error) | Has |
| Correlation IDs / request tracing | Missing |
| Async-safe writes | Missing (uses `appendFileSync`) |

**Decision needed:** Either (a) add correlation IDs to the existing custom logger, or (b) replace with pino + pino-http for production-grade async logging with built-in correlation ID support.

**Prevention if keeping custom logger:**
```typescript
// Add correlationId to TrpcContext creation
import { randomUUID } from 'node:crypto';

return async ({ req }) => {
  const correlationId =
    req.headers['x-correlation-id'] as string ?? randomUUID();
  // ...
  return { session, correlationId };
};
```

**Prevention if replacing with pino:**
- Replace `appendFileSync` with `pino.destination({ sync: false })`.
- Use `pino-http` for automatic request logging with correlation IDs.
- Keep the `AppLogger` interface so all 8 service files that import logger do not need signature changes.
- Use `pino.transport` for file rotation instead of the hand-rolled `pruneOldFiles`.

**Detection:** Reviewing production logs and finding no way to correlate a frontend error to the backend request that caused it.

---

### Pitfall 11: Loading States Do Not Exist in Current Components

**What goes wrong:** All current components render synchronously from mock constants. When switched to tRPC queries, there is a loading period where data is `undefined`. Components will crash with `Cannot read property 'name' of undefined` because they assume data is always present.

**Example of the pattern that breaks:**
```typescript
// Current: data is always defined (from mock-data.ts)
const products = MOCK_PRODUCTS; // always a populated array

// After tRPC wiring:
const { data: products, isLoading } = trpc.leadForm.byPeriod.useQuery({
  reportId: activeReportId
});
// products is undefined during loading!
// products.map(...) throws TypeError
```

This affects ALL 38 mock-data import sites across 25+ component files.

**Prevention:**
1. Add loading skeletons to each major section BEFORE wiring tRPC -- not as an afterthought.
2. Use either `useSuspenseQuery` (pushes loading state up to nearest `<Suspense>` boundary) or explicit `if (isLoading)` guards at each query site.
3. For server components: use RSC data fetching with `initialData` to avoid client-side loading entirely for the first render.
4. Type-safety approach: use a pattern that makes `undefined` data a compile error:
```typescript
const { data } = trpc.leadForm.byPeriod.useSuspenseQuery({ reportId });
// data is guaranteed non-null after Suspense resolves
```

**Detection:** White flash or "Cannot read property" errors immediately after adding `useQuery` to any component.

---

## Minor Pitfalls

### Pitfall 12: tRPC Batching Can Mask Individual Query Failures

**What goes wrong:** The tRPC client uses `httpBatchLink`, which batches multiple queries into a single HTTP request. If one query in the batch fails auth (401), the entire batch fails -- including queries that would have succeeded independently. On pages with 3-4 queries (dashboard, lead form), a single failing query takes down all data on the page.

**Prevention:** Add a `splitLink` to separate critical queries, or handle 401 globally with a redirect to login rather than per-query error handling.

---

### Pitfall 13: Playwright Storage State Files Need Updating for Real Auth

**What goes wrong:** E2E fixtures expect `.auth/lead.json` and `.auth/head.json` storage state files. When switching to real API, these must contain valid session cookies from actual auth flow (or a seed-based bypass). If `auth.setup.ts` is not updated for the new auth context, every test fails before any assertion runs.

**Prevention:** Update `auth.setup.ts` to either (a) perform real SAML login and save cookies, or (b) call a dev-only `/api/dev/login` endpoint that issues a `customreport_session` cookie (matching the cookie name in `trpc.context.ts`) for a seed user.

---

### Pitfall 14: React Query Cache Serves Stale Data During Incremental Migration

**What goes wrong:** During incremental migration (some pages on mock data, some on real API), React Query caches real API responses. If a user navigates from a real-API page to a mock-data page and back, cached data from different shapes can cause runtime errors.

**Prevention:** Either migrate all pages in a single PR (cleaner), or use separate query keys that clearly distinguish mock vs real data paths. The single-PR approach is strongly recommended for this project given the small number of pages (7).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Seed Data | UUID mismatch with DEV_SESSION (P3), name inconsistency across mocks (P6) | Seed must use hardcoded DEV_SESSION UUIDs, canonical names from a single constants file |
| TRPCProvider Setup | White-screen on all pages (P2), 404 on /trpc (P7) | Error boundaries first, provider in (app) layout only, add next.config.ts rewrites |
| Mapping Layer | Type errors from semantic mismatch (P1), undefined data crashes (P11) | Build api-mappers.ts + loading skeletons before any query wiring |
| Per-Page Wiring | 339 tests break three different ways (P4), superjson Date issues (P8) | Phased: seed matches mocks, wire one page at a time, run tests after each |
| Status-Risk Sync | Infinite render loop (P5) | Source flag pattern (`'user' \| 'auto-sync'`), not debounce |
| Auth Guards | DEV_MODE split-brain (P9), Playwright auth setup stale (P13) | Frontend guard respects AUTH_DEV_MODE, update auth.setup.ts |
| Production Logging | Logger is NOT pino (P10), missing correlation IDs | Decide: enhance custom logger or replace with pino |
| E2E Migration | Batch test failures from query failures (P12), stale cache (P14) | Migrate all pages in single PR, add splitLink for critical queries |

## Recommended Phase Ordering Based on Pitfalls

1. **Seed Data** (unblocks everything) -- addresses Pitfalls 3, 6
2. **TRPCProvider + API Proxy Setup** (unblocks all wiring) -- addresses Pitfalls 2, 7, 8
3. **Mapping Layer + Loading States** (unblocks per-page wiring) -- addresses Pitfalls 1, 11
4. **Per-Page tRPC Wiring** (one page at a time, run tests after each) -- addresses Pitfall 4
5. **Status-Risk Sync** (isolated UI feature, no test dependencies) -- addresses Pitfall 5
6. **Auth Guards** (after wiring is stable) -- addresses Pitfalls 9, 13
7. **Production Logging** (independent, can run in parallel with 4-6) -- addresses Pitfall 10
8. **E2E Test Cleanup** (final pass for legitimate format changes) -- addresses Pitfall 4 Phase C

## Time Estimates -- What Takes Longer Than Expected

| Task | Naive estimate | Realistic estimate | Why longer |
|---|---|---|---|
| Build mapping layer (P1) | "Just rename some types" -- 2h | 8-12h | 6 different semantic mismatches, each needs careful bidirectional mapping + date formatting |
| Seed matching mock data (P3, P6) | "Quick prisma seed" -- 1h | 4-6h | UUID coordination with DEV_SESSION, name reconciliation across 3 mock files, relationship wiring (stages, assignments, reports, sections) |
| Add TRPCProvider (P2) | "Wrap layout in provider" -- 30min | 2-4h | Error boundaries, Suspense boundaries, verify no white-screens across all 7 pages |
| E2E migration (P4) | "Update imports" -- 4h | 16-24h | Each of 25+ components needs loading states, type mapping, and test verification. Three failure modes require sequential debugging. |
| Status-Risk sync (P5) | "Two event handlers" -- 1h | 4-6h | Bidirectional sync with source flags, testing all combinations (status->risk, risk->status, delete risk->status reset), edge cases (multiple risks per product) |

## Sources

All findings verified against actual codebase files:
- `apps/web/src/components/lead/mock-data.ts` -- mock types and data (248 lines)
- `apps/web/src/components/dashboard/mock-data.ts` -- dashboard mock types (494 lines)
- `apps/web/src/components/admin/mock-data.ts` -- admin mock types with divergent names (310 lines)
- `packages/shared/src/schemas/report.ts` -- Zod schemas, canonical API types (493 lines)
- `prisma/schema.prisma` -- Prisma enums: `TrafficLightStatus(green,yellow,red)`, `ItemWorkflowStatus(done,in_progress,blocked)`, `PeriodStatus(open,published,reopened)`
- `apps/api/src/infrastructure/trpc/trpc.context.ts` -- DEV_SESSION hardcoded UUIDs, `activeReportSectionId: null`
- `apps/api/src/infrastructure/trpc/trpc.middleware.ts` -- superjson transformer, auth guards
- `apps/api/src/infrastructure/trpc/trpc.router.ts` -- 36 endpoints in 9 namespaces, `reports.getActive` checks `activeReportSectionId`
- `apps/api/src/lib/logger.ts` -- custom logger, NOT pino (157 lines, appendFileSync)
- `apps/web/src/lib/trpc.ts` -- tRPC client exists with superjson but is unused
- `apps/web/package.json` -- `@tanstack/react-query` ^5.97.0 and `@trpc/react-query` ^11.16.0 already installed
- `apps/web/src/app/layout.tsx` -- root layout, no providers (31 lines)
- `apps/web/src/app/(app)/layout.tsx` -- app group layout, no auth guard (26 lines)
- `apps/web/e2e/fixtures.ts` -- Playwright fixtures with storage state
- `apps/web/e2e/lead-journey.spec.ts` -- E2E tests asserting mock data strings
- Grep: 38 `from.*mock-data` import sites across 25+ component files
