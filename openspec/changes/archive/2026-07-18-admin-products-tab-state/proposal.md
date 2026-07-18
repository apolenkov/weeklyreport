## Why

BL-20 (P1), `docs/reviews/repo-excellence-review-2026-07-14.md`, products-tab
sub-finding only. BL-20 bundles two unrelated web-state bugs (admin
products-tab re-expand, dashboard skeleton column widths) in one product
area but they touch disjoint files with no shared seam — this change covers
the products-tab half only; the dashboard-skeleton half is
`dashboard-skeleton-columns`.

`ProductsTab`'s deep-link auto-expand effect
(`apps/web/src/features/admin/ui/products-tab.tsx`) depends on
`[productFilter, products]`. Any product mutation performed in the same tab
(edit, archive, attach) invalidates `admin.snapshot`, which produces a new
`products` array reference. While `?product=<id>` is still present in the
URL, the effect re-runs on that new array reference and re-opens a panel the
user just deliberately collapsed — because the effect has no way to
distinguish "products data changed" from "the user wants this panel open
again."

## What Changes

- `products-tab.tsx`: introduce an explicit interaction marker (a ref or
  boolean state, e.g. `hasUserToggledRef`) set the first time the user
  manually expands or collapses the deep-linked panel. Once set, the
  auto-expand effect skips re-running on `products` array changes — it
  should re-run only when `productFilter` (the actual deep-link intent)
  changes, not on every snapshot refetch.

## Claim disposition

| Sub-claim                                                                   | Disposition | Notes                                                                                                                                                              |
| --------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Deep-link auto-expand re-opens a collapsed panel after any product mutation | Confirmed   | Effect dependency array `[productFilter, products]` re-runs on every new `products` reference, including ones produced by the user's own mutation in the same tab. |

No refuted sub-claims — no preservation-test task required beyond normal
regression coverage.

## Non-goals

- No change to the deep-link URL contract (`?product=<id>` stays a query
  param) — only to when the auto-expand effect is allowed to act on it.
- No change to `admin.snapshot`'s invalidation behavior or query-caching
  strategy — the fix is scoped to the UI effect's dependency handling, not
  the data layer.
- Dashboard skeleton column widths (the other BL-20 sub-finding) — tracked
  separately as `dashboard-skeleton-columns`; no shared file, no shared
  seam.

## File manifest

- `apps/web/src/features/admin/ui/products-tab.tsx` (source, verified present, 279 lines)
- `apps/web/src/features/admin/ui/products-tab.test.tsx` (test, verified present)

## Verification

- Full gate: `pnpm --filter @customreport/api db:generate && pnpm typecheck && pnpm lint && pnpm test`
- Unit tests (jsdom):
  1. Render with `?product=<id>` present, panel auto-expands (existing
     behavior, unchanged).
  2. User manually collapses the panel. Trigger a `products` array
     reference change (simulate a refetch/mutation) while `?product=<id>`
     is still present. Assert the panel STAYS collapsed.
  3. Change `productFilter` itself (new deep-link target) — assert the
     effect still re-runs and auto-expands the newly-targeted panel.
- This is stateful effect/ref logic tied to a real mutation-triggered
  refetch cycle, not a route/popup/scroll/focus concern by itself, but the
  regression is specifically about same-tab UX after a live mutation.
  Manual/Playwright drive step required in addition to unit tests:
  1. Open `/admin?tab=products&product=<id>` as admin, confirm the panel
     auto-expands.
  2. Collapse the panel. Edit or archive a DIFFERENT product in the same
     tab (any mutation that invalidates `admin.snapshot`).
  3. Confirm the deep-linked panel stays collapsed after the mutation
     completes and the products list refetches.

## Sequencing

Independent — touches only `products-tab.tsx`; no dependency on
`dashboard-skeleton-columns` or any other change in this batch.
