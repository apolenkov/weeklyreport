## 1. Users action hierarchy

- [x] 1.1 Add Users-table tests locking Edit and Activate/Deactivate inline behavior, Delete discovery/confirmation, focus restoration, and current authorization/mutations.
- [x] 1.2 Move Delete to an accessible row overflow menu or one clearly separated edit-dialog danger zone; remove the inline Delete pill.
- [x] 1.3 Raise Edit, Activate/Deactivate, overflow, and menu targets to at least 40px hit areas with visible focus and narrow-row layout coverage.

## 2. Presentation density model

- [x] 2.1 Confirm `sweep15-slide-status-accessible-label` is landed or composed without overlap before editing shared slide product-card/model files.
- [x] 2.2 Characterize document-density slide output and assign stable identities to every product record and priority card.
- [x] 2.3 Implement pure product-first pagination with a named per-view record cap and labeled continuation pages.
- [x] 2.4 Add flattening invariants proving every source record appears exactly once in order with stable author/status/Mine-Everyone semantics.
- [x] 2.5 Add an explicit Document/Presentation density control to lead, head, and viewer deck shells with visible state, keyboard access, and reversible switching without refetch.
- [x] 2.6 Preserve Document as the auto-height all-content mode and verify Presentation in fullscreen/projection at dense fixture sizes.

## 3. Verification and catalog

- [x] 3.1 Run focused Users table/dialog/menu, pagination, deck-control, and accessibility tests.
- [x] 3.2 Update admin and slide catalog scenarios for overflow Delete, 40px targets, density switching, and multi-page product continuation.
- [x] 3.3 Drive admin Users and dense lead/head/viewer slides from source; verify no destructive misclick affordance, clipped action, or lost/duplicate record.
- [x] 3.4 Check changed `.tsx` files with `grep -nE '[а-яА-Я]' <file>` and confirm every hit is permitted data/comment/test content.

## 4. Repository gates

- [x] 4.1 `pnpm --filter @customreport/api db:generate`
- [x] 4.2 `pnpm typecheck`
- [x] 4.3 `pnpm lint`
- [x] 4.4 `pnpm test`
