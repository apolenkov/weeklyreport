# Phase 21: tRPC Provider & Client Wiring - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning
**Mode:** Auto-generated for autonomous flow (research already done at project level)

<domain>
## Phase Boundary

Frontend fetches all data from the real API through tRPC hooks. Every page renders server data with loading and error states. This phase is the bridge between the UI prototype (mock data) and the working API.

**Key deliverables:**

1. TRPCProvider client component with QueryClientProvider (useState pattern, no SSR leak)
2. Wire providers into apps/web/src/app/(app)/layout.tsx
3. Migrate from `@trpc/react-query` to `@trpc/tanstack-react-query` (React Compiler compat)
4. superjson transformer on client (server already has it)
5. 7 container components migrated from mock-data to useQuery/useMutation
6. Loading skeletons on every page during data fetch
7. Error boundaries + toast notifications for API errors
8. Cache invalidation strategy for mutations

**Constraint:** Existing 339 E2E tests must continue passing — they use mock UI mode. Real-API tests come in Phase 26.

</domain>

<decisions>
## Implementation Decisions

### Provider Setup

- **TRPCProvider location**: `apps/web/src/lib/trpc-provider.tsx` — new client component
- **Wiring**: Add to `apps/web/src/app/layout.tsx` (root, not (app)/layout) so it covers login + app routes
- **QueryClient**: Use `useState(() => new QueryClient(...))` to prevent SSR leak (research pitfall #5)
- **DevTools**: ReactQueryDevtools enabled in development only

### Migration Order (incremental, simplest first)

1. Lead History (smallest, read-only)
2. Admin Panel (CRUD, but isolated)
3. Lead Form (largest, has autosave — but only queries here, mutations in Phase 22)
4. Dashboard (KPI aggregation)
5. Weekly Report (composed view)

### Type Bridging

- Mappers from Phase 20 used in containers ONLY
- Presentation children stay unchanged (props remain in mock-shape)
- New pattern: container reads `useQuery(...)` → applies `mapXxxToPresentation(...)` → passes mock-shaped props down

### Loading & Error UX

- Skeleton component already exists at `apps/web/src/components/ui/skeleton.tsx`
- Toast: use `sonner` (already installed via shadcn/ui)
- Error boundary: one wrapper at (app)/layout level, catches all unhandled

### Cache Strategy

- No mutations wired in this phase (Phase 22)
- staleTime: 30s for queries
- refetchOnWindowFocus: true

### Claude's Discretion

- Component-by-component migration order if dependencies emerge
- Loading skeleton shapes (match existing UI dimensions)
- Toast variants (success/error/info)

</decisions>

<code_context>

## Existing Code Insights

### Reusable Assets

- `apps/web/src/lib/trpc.ts` — tRPC client already configured with superjson + httpBatchLink
- `apps/web/src/components/ui/skeleton.tsx` — Skeleton component
- `packages/ui/src/components/sonner.tsx` — Toast (sonner) provider
- `apps/web/src/lib/mappers/` — Type mappers from Phase 20

### Established Patterns

- All container components currently import from local `mock-data.ts` files
- Pages use Next.js 16 App Router with 'use client' directive
- React Compiler enabled — automatic memoization

### Integration Points

- `apps/web/src/app/layout.tsx` — root layout (wrap providers here)
- 7 container files (per architecture research):
  - apps/web/src/components/lead/lead-form.tsx
  - apps/web/src/components/lead/lead-history-list.tsx
  - apps/web/src/components/dashboard/dashboard-page.tsx
  - apps/web/src/components/weekly-report/weekly-report-page.tsx
  - apps/web/src/components/admin/admin-panel.tsx
  - apps/web/src/components/admin/users-tab.tsx (and other tabs)
  - apps/web/src/components/admin/products-tab.tsx (etc.)

</code_context>

<specifics>
## Specific Ideas

- Use TanStack Query v5 hooks (useQuery, useMutation) directly via `trpc.xxx.xxx.queryOptions()` pattern
- Loading state: render skeleton matching final UI dimensions to prevent layout shift
- Error display: toast.error for transient failures, full-page error boundary for unrecoverable

</specifics>

<deferred>
## Deferred Ideas

- Mutations and onClick wiring → Phase 22
- PDF export trigger → Phase 23
- Auth guards → Phase 24
- Logging on tRPC requests → Phase 25
- Real API E2E tests → Phase 26

</deferred>
