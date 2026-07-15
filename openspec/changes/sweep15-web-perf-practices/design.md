## Context

Admin's parent starts snapshot and settings queries regardless of tab. Dashboard chrome and all panels wait until both `review.dashboard` and `weeklyReport.get` resolve. Trends imports chart exports through `features/analytics`, root layout loads three Google families through an external stylesheet, and data-heavy pages wrap non-suspending client queries in page-level Suspense.

## Goals / Non-Goals

**Goals:** avoid inactive work, allow independently useful dashboard content to appear, improve package/chunk/font loading, and make loading boundaries truthful.

**Non-Goals:** redesign dashboard information architecture, change query payloads/cache keys, migrate to server-prefetch/hydration, or introduce `useSuspenseQuery`.

## Decisions

### 1. Gate admin queries by an explicit tab dependency table

Define predicates from `activeTab`: snapshot is enabled only for users/groups/products/reminders (and any verified consumer); settings is enabled only for settings and reminders' timezone seed. Periods, reopen, jobs, and actions remain self-contained and start neither parent query. Error effects fire only for enabled queries.

No silent timezone fallback is added: a reminders tab that requires settings waits for settings or shows its error state.

### 2. Dashboard uses per-panel readiness, not one page gate

The page header and static shell render immediately. Query-specific model selectors feed panels only when their required source exists:

- weekly-report-backed queue/review/publish context waits on `weeklyReport.get`;
- review-backed KPI/escalation content waits on `review.dashboard`;
- self-contained activity and reopen panels own their existing queries;
- panels render local skeleton/error/retry states without hiding ready siblings.

The page-level stall/retry telemetry becomes query-specific so one stalled request does not erase the successful half. A no-period result remains a page-level terminal state once the weekly query resolves.

### 3. Choose explicit query states and remove misleading Suspense

Data-heavy route pages using `useQuery` keep explicit loading/error/empty rendering and drop page-level Suspense fallbacks that never catch those queries. Suspense remains around `next/dynamic`, lazy chunks, `useSearchParams`, or components that truly throw promises. This is chosen over `useSuspenseQuery` because the current surfaces already have mature query-specific error and retry policies; migrating all of them would broaden the change.

### 4. Optimize imports and fonts at their ownership points

`next.config.ts` sets `experimental.optimizePackageImports: ["lucide-react", "recharts"]`. Trends dynamic imports target the concrete chart files, preserving `ssr: false` and local skeletons. Root layout uses `next/font/google` for Fraunces, Lexend, and Source Sans 3, exports CSS variables matching existing `--font-*` tokens, and removes preconnect/stylesheet tags plus the TODO.

### 5. Preserve invariants

Role routing, tRPC middleware, period state, and API contracts are unchanged. Font migration requires visual comparison; dashboard/admin changes require query-call and partial-readiness tests.

## Risks / Trade-offs

- [A tab loses required data] → Encode dependencies in one table and test every tab's enabled query set.
- [Partial dashboard states confuse users] → Keep panel-sized skeleton/error copy and stable layout slots.
- [Direct chart imports bypass intended public API] → This is a route-local code-split exception documented in design; normal static feature imports still use barrels.
- [Font metrics shift layout] → Match weights/subsets, apply variables at `<html>`/`<body>`, and perform visual regression checks.

## Migration Plan

Land query gating and dashboard readiness first, then package/chart imports, fonts, and Suspense cleanup. No feature flag or data migration is required.

## Open Questions

None; the Suspense posture is explicitly resolved in favor of non-suspending client queries with local states.
