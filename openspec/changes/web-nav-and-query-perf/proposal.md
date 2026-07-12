## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review
(docs/reviews/repo-excellence-review-2026-07-12.md).

Three avoidable-work items in the web layer, none correctness bugs but all
scaling badly:

- The desktop admin tab strip (`apps/web/src/app/(app)/admin/page.tsx`)
  renders each tab as a raw `<a href="/admin?tab=...">`. Clicking a tab does
  a full page reload — losing all client-side query cache and any other
  route state — while the mobile picker in the same file already does a
  client-side `router.push`. The two navigation paths for the same tab
  strip behave differently for no reason.
- `apps/web/src/app/(app)/head/report/layout.tsx` wraps its children in a
  second `RoleGate` with the exact same `["head", "admin"]` role set as its
  parent `apps/web/src/app/(app)/head/layout.tsx`. The nested gate adds a
  second, serial, uncached `auth.me` round-trip on every render of any
  `/head/report/*` route without narrowing access at all — the parent gate
  already deny-walls everyone the child gate would deny.
- `apps/web/src/features/admin/ui/group-products-editor.tsx` fires one
  `admin.listProductGroups` query per active product via `useQueries` every
  time the "products attached" dialog opens. This is an N+1 fan-out that
  grows linearly with the product catalog — a 50-product catalog opens 50
  concurrent requests to answer one question (which group, if any, owns
  each product).

## What Changes

- `apps/web/src/app/(app)/admin/page.tsx`: replace the desktop tab `<a
href>` with `next/link`'s `Link` (or the same `router.push` the mobile
  picker already uses), so tab switches stay client-side and preserve
  React Query cache and scroll position, matching the mobile picker's
  existing behavior.
- Delete `apps/web/src/app/(app)/head/report/layout.tsx`'s `RoleGate`
  wrapper — the file is removed (or reduced to a plain passthrough if
  Next.js requires the segment to exist), since the parent `head/layout.tsx`
  already gates `/head/*` (including `/head/report/*`) with the identical
  `["head", "admin"]` role set.
- Add a batched `admin.listProductGroupOwnership` tRPC procedure
  (`apps/api/src/modules/admin/admin-group-product.queries.ts`,
  `admin.service.ts`, `project-admin.service.ts`, `admin-shared.ts`,
  `trpc.router.ts`) that takes `productId[]` and returns the owning group
  (or `null`) per product in a single query. Update
  `apps/web/src/features/admin/ui/group-products-editor.tsx` to call it once
  with all active product IDs instead of fanning out one
  `admin.listProductGroups` per product via `useQueries`.

## Impact

- `apps/web/src/app/(app)/admin/page.tsx`
- `apps/web/src/app/(app)/head/report/layout.tsx` (deleted or reduced to
  passthrough)
- `apps/web/src/features/admin/ui/group-products-editor.tsx`
- `apps/api/src/modules/admin/admin-group-product.queries.ts`
- `apps/api/src/modules/admin/admin-shared.ts`
- `apps/api/src/modules/admin/admin.service.ts`
- `apps/api/src/modules/admin/project-admin.service.ts`
- `apps/api/src/modules/admin/admin.prisma-repository.ts`
- `apps/api/src/trpc/trpc.router.ts`

Non-goals: no change to the existing per-product `admin.listProductGroups`
procedure (kept for any other single-product caller); no change to the
`listGroupProducts` (group → products) direction; no redesign of the
group-products dialog's UI beyond swapping its data source.
