## Why

Several web routes do avoidable work before showing useful UI: admin fetches unrelated data on every tab, the head dashboard waits for two queries as one barrier, charts load through a broad barrel, and external fonts block rendering. Page-level Suspense fallbacks also imply streaming that client `useQuery` calls do not provide.

## What Changes

- Enable admin snapshot/settings queries only for tabs that consume them.
- Render the dashboard shell immediately and give each panel independent loading/error/readiness behavior instead of a dual-query page barrier.
- Configure `experimental.optimizePackageImports` for `lucide-react` and `recharts`; point trends `dynamic()` imports directly at chart modules.
- Replace Google Fonts stylesheet links with `next/font` while preserving the three existing CSS font tokens.
- Remove misleading page-level data Suspense fallbacks from client-query routes; retain Suspense only for genuinely suspending code/chunk boundaries.

## Capabilities

### New Capabilities

- `web-loading-performance`: Demand-driven queries, progressive panel readiness, package/font loading, and truthful Suspense boundaries.

### Modified Capabilities

- None.

## Impact

Touches `AdminPanel`, dashboard query/panel composition, trends imports, `apps/web/next.config.ts`, root layout/font tokens, data-heavy App Router pages, and focused tests. Query contracts and visible data semantics do not change.

## Non-goals

- No switch to `useSuspenseQuery`; the design deliberately chooses explicit client-query states.
- No dashboard information-architecture redesign (owned by `sweep15-ux-head-dashboard-queue`).
- No memoization sweep; React Compiler remains enabled.
