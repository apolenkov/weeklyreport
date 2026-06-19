# Design — unify the record dialogs

## Current state (verified)

| Dialog                                | Pre-select on create  | Stage scope          | Product position | Columns |
| ------------------------------------- | --------------------- | -------------------- | ---------------- | ------- |
| Risk (`risk-edit-dialog.tsx`)         | none (W11 3.10)       | selected product     | right panel      | two     |
| Item (`item-edit-dialog.tsx`)         | all owned (`UFB-073`) | selected product     | bottom           | one     |
| Decision (`decision-edit-dialog.tsx`) | all owned (`UFB-073`) | **department union** | top              | one     |

- Risk's empty default: `computeInitialStageIds` returns `[]` on create.
- Item/Decision pre-select: `useState(... isCreate ? [...owned] : [])`.
- Decision union: `availableStages = ownedStagesForProject(section, undefined)`
  (undefined projectId → union); the product `<select>` only calls `setProductId`,
  never re-scopes stages. Item/Risk use `stagesForProduct(productId)` and a
  `setProductAndStages` helper that resets the selection.

## Decisions

1. **Pre-select removal.** In `item-edit-dialog.tsx` and `decision-edit-dialog.tsx`
   change the create-mode `stageIds` initial state to `[]` (mirror the risk dialog).
   Keep the `handleSave` single-owned-stage auto-apply and the required check — they
   already exist in both.

2. **Decision product-scoping.** Pass `stagesForProduct` (product-scoped) into the
   Decision dialog instead of `availableStages` (union). Add a `setProductAndStages`
   that resets `stageIds` on product change, matching the item dialog. Update the
   `StageMultiSelect` `stages=` prop to the selected product's owned stages.

3. **Two-column layout.** Extract the risk dialog's shell (left text column + right
   `CLASSIFICATION` panel) into a shared dialog layout the three dialogs render
   through, OR replicate the structure in item/decision. The CLASSIFICATION panel
   holds Product → SDLC Stages → Status/Severity in that order. Item's priority rank
   and Decision's owner/deadline stay in the left column with the text fields.
   - The Item dialog currently hides Product when `products.length <= 1`; the panel
     must always render it.
   - Decisions are department-record but now product-scoped for stages; the Product
     picker stays.

## Risk / regression watch

- `lead-dialog-lifecycle` D12 mount/unmount + the A13 invariant
  (`stagesForProduct`/`availableStages` never in a deps array) MUST be preserved —
  the initial `useState` reads the snapshot once at mount.
- `lead-report-controls-integrity` "view-state transitions never open dialogs" and
  busy-state requirements must stay green.
- Decision tests asserting union-scoped stages move to product-scoped.
- Tests asserting Item/Decision pre-checked stages on create move to "none checked".

## Out of scope

Required-stage/auto-apply rule, single-vs-multi select, deep visual token polish.
