# Tasks — unify the record dialogs

## 1. No stage pre-selection on create

- [x] 1.1 `item-edit-dialog.tsx`: create-mode `stageIds` → `[]`. Auto-apply +
      required kept in `handleSave`.
- [x] 1.2 `decision-edit-dialog.tsx`: same — create-mode `stageIds` → `[]`.
- [x] 1.3 Risk dialog unchanged (already `[]`).

## 2. Decision stages product-scoped

- [x] 2.1 Threaded `stagesForProduct` through lead-form → DecisionsSection →
      DecisionEditDialog, replacing the department-union `availableStages`.
- [x] 2.2 Added `setProductAndStages` to the Decision product `<select>` — changing
      product re-scopes options and clears the selection.
- [x] 2.3 Dropped the now-unused `availableStages` union in `lead-form.tsx`; updated
      tests (dialog A13 ref test now passes a `stagesForProduct` fn ref).

## 3. Two-column layout for all three

- [ ] 3.1 Extract or replicate the risk dialog's two-column shell (left text column + right CLASSIFICATION panel). Put Product → SDLC Stages → Status/Severity in
      the panel, same order in all three.
- [ ] 3.2 Item dialog: always render the Product picker (drop the `products.length > 1`
      guard); move it into the panel with Status.
- [ ] 3.3 Decision dialog: move Product into the panel; keep owner/deadline + text on
      the left.
- [ ] 3.4 Preserve the D12 mount/unmount shell and the A13 deps-array invariant.

## 4. Tests & gates

- [ ] 4.1 Update item/decision dialog tests: create mode shows NO stage checked.
- [ ] 4.2 Add a decision test: changing product re-scopes stage options + clears
      selection.
- [ ] 4.3 Keep required-stage + single-auto-apply tests green for all three.
- [ ] 4.4 `lead-dialog-lifecycle` + `lead-report-controls-integrity` suites green.
- [ ] 4.5 `pnpm typecheck && pnpm lint && pnpm test` green; live-verify all three
      dialogs: empty stages on open, product change re-scopes, two-column layout.
