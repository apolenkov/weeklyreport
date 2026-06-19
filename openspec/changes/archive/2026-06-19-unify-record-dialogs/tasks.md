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

- [x] 3.1 Replicated the risk dialog's two-column shell (left prose column + right
      CLASSIFICATION panel) in the item and decision dialogs (widened to max-w-3xl).
- [x] 3.2 Item dialog: Product picker always renders in the panel (disabled when
      a single product), grouped with SDLC Stages + Status.
- [x] 3.3 Decision dialog: Product moved into the panel with SDLC Stages; owner/
      deadline + text stay in the left column.
- [x] 3.4 D12 mount/unmount shell + A13 deps-array invariant preserved (only JSX
      reorganized; state/handlers unchanged).

## 4. Tests & gates

- [x] 4.1 Item/decision dialog tests updated: create mode shows NO stage checked.
- [x] 4.2 Decision test: changing product re-scopes stage options + clears selection.
- [x] 4.3 Required-stage + single-auto-apply tests green for all three.
- [x] 4.4 Lead suite green (308); typecheck + lint clean.
- [~] 4.5 Live-verify all three dialogs (empty stages on open, product change
  re-scopes, two-column reads as one family) — DEFERRED to the live visual pass.
