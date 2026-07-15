## 1. Repoint the three admin model files at `admin-types.ts`

- [x] 1.1 `apps/web/src/features/admin/model/group-form.ts`: change the
      `MockGroup` import from `../../../shared/lib/admin-mock-data` to
      `./admin-types`
- [x] 1.2 `apps/web/src/features/admin/model/product-form.ts`: change the
      `MockProduct` import from `../../../shared/lib/admin-mock-data` to
      `./admin-types`
- [x] 1.3 `apps/web/src/features/admin/model/user-form.ts`: change the
      `MockGroup, MockUser` import from `../../../shared/lib/admin-mock-data`
      to `./admin-types`
- [x] 1.4 Re-grep `apps/web/src/features/admin` for any other
      `admin-mock-data` import of `MockUser`/`MockGroup`/`MockProduct` this
      proposal's file list missed; repoint any found

## 2. Spec delta

- [x] 2.1 `web-model-type-boundary`: MODIFY the "Presentation modules type
      against the real model, not a mock/legacy module" requirement, adding
      a scenario covering the admin group/product/user-form case
      specifically

## 3. Gates and verification

- [ ] 3.1 `pnpm --filter @customreport/api db:generate`
- [ ] 3.2 `pnpm typecheck` — confirm no shape divergence surfaces between
      the two `Mock*` families now that the import target changed
- [ ] 3.3 `pnpm lint && pnpm test`
- [ ] 3.4 `pnpm build`
- [ ] 3.5 Manual: open admin Groups/Products/Users tabs from source,
      confirm edit forms render and submit unchanged
- [ ] 3.6 `openspec validate admin-presentation-type-ssot --strict`
