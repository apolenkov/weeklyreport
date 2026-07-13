## 1. Admin tab strip: client-side navigation

- [ ] 1.1 `apps/web/src/app/(app)/admin/page.tsx`: replace the desktop `<a
href={`/admin?tab=${t}`}>` with `next/link`'s `Link` (same href, same
      classes, same `aria-current`), so the pill click no longer triggers a
      full page reload
- [ ] 1.2 Confirm the mobile `AdminTabsMobileSelect` picker and the desktop
      strip now both navigate client-side to the same URL shape

## 2. Drop the redundant nested RoleGate on /head/report

- [ ] 2.1 Confirm `apps/web/src/app/(app)/head/layout.tsx` (parent) and
      `apps/web/src/app/(app)/head/report/layout.tsx` (child) gate the exact
      same role set, `["head", "admin"]`
- [ ] 2.2 Remove the `RoleGate` wrapper from
      `apps/web/src/app/(app)/head/report/layout.tsx`; delete the file if
      Next.js allows the segment to fall through to the parent layout with no
      local layout file, otherwise reduce it to a plain
      `{children}` passthrough
- [ ] 2.3 Verify `/head/report/*` routes still deny non-head/admin roles (via
      the parent gate) and still render for head/admin

## 3. Batched product-group ownership endpoint

- [ ] 3.1 `apps/api/src/modules/admin/admin-group-product.queries.ts`: add
      `listProductGroupOwnership(prisma, productIds: string[])` that runs one
      `groupProduct.findMany({ where: { productId: { in: productIds } },
include: { group: true } })` and returns a `Map`/array keyed by
      `productId` to its owning `{ id, name }` (absent when unowned)
- [ ] 3.2 `apps/api/src/modules/admin/admin-shared.ts`: add the optional
      `listProductGroupOwnership?(productIds: string[])` method to the
      `AdminRepository` port, mirroring the existing `listProductGroups`
      entry
- [ ] 3.3 `apps/api/src/modules/admin/admin.prisma-repository.ts`: implement
      the port method by delegating to the new query function
- [ ] 3.4 `apps/api/src/modules/admin/project-admin.service.ts` and
      `admin.service.ts`: add the `listProductGroupOwnership` passthrough
      (empty result when the repository does not implement it, mirroring the
      existing `listProductGroups` fallback)
- [ ] 3.5 `apps/api/src/trpc/trpc.router.ts`: expose
      `admin.listProductGroupOwnership` as an `adminProcedure` taking
      `productId: string[]`
- [ ] 3.6 `apps/web/src/features/admin/ui/group-products-editor.tsx`: replace
      the per-product `useQueries` fan-out with a single
      `admin.listProductGroupOwnership` query keyed on the full
      `activeProducts` id list; keep the existing lock/disable UI behavior
      (`lockedByOtherGroup`, the "Already attached to X" hint) driven off the
      batched result
- [ ] 3.7 Update the two mutation `onSuccess` handlers (attach/detach) to
      invalidate the batched query's cache key instead of the removed
      per-product `listProductGroups` key

## 4. Spec delta

- [ ] 4.1 `admin-settings-ui`: ADD a requirement that the admin tab strip
      navigates client-side
- [ ] 4.2 `ui-role-route-access`: ADD a requirement that a nested role gate
      must not duplicate an ancestor's exact allowed-role set
- [ ] 4.3 `hot-path-query-performance`: ADD a requirement that product-group
      ownership loads in one batched query, not one query per product

## 5. Gates and verification

- [ ] 5.1 `pnpm --filter @customreport/api db:generate`
- [ ] 5.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 5.3 Live-check: open `/admin?tab=products`, click through the desktop
      tab pills, confirm no full page reload (React Query devtools cache
      persists across tab switches) and the URL still updates
- [ ] 5.4 Live-check: log in as head, open `/head/report/:id`, confirm the
      network panel shows exactly one `auth.me` call for the navigation, not
      two
- [ ] 5.5 Live-check: open the Groups tab's "Products attached" dialog for a
      group with several products, confirm the network panel shows one
      `admin.listProductGroupOwnership` call instead of N `listProductGroups`
      calls, and that attach/detach still update the lock state correctly
- [ ] 5.6 `openspec validate web-nav-and-query-perf --strict`
