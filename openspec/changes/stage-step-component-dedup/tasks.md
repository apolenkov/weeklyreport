## 1. Build the shared `StageStep` primitive

- [ ] 1.1 `apps/web/src/features/report-sections/ui/stage-step.tsx` (new):
      wrap `StageMultiSelect` plus a `role="status"` dead-end notice,
      parameterized by `id`, `stageIds`, `availableStages`, `isDeadEnd`,
      `error`, `onChange`, optional `previewSeverity`, and
      `deadEndNotice: ReactNode`
- [ ] 1.2 Preserve the existing error-suppression behavior: `error` is
      passed to `StageMultiSelect` as `undefined` when `isDeadEnd`, so the
      stale required-stage error never co-renders with `deadEndNotice`
- [ ] 1.3 `apps/web/src/features/report-sections/ui/stage-step.test.tsx`
      (new): cover rendering `StageMultiSelect` with the given props,
      showing `deadEndNotice` exactly when `isDeadEnd`, suppressing `error`
      in the dead-end branch, and forwarding `previewSeverity` when passed
- [ ] 1.4 `apps/web/src/features/report-sections/index.ts`: export
      `StageStep`

## 2. Migrate the `period` slice call site

- [ ] 2.1 `apps/web/src/features/period/ui/decision-edit-dialog-fields.tsx`:
      replace the `RecordStageStep` import (currently `from "./record-stage-step"`,
      a same-slice relative import) with `StageStep` from
      `../../report-sections`, passing
      ``deadEndNotice={`No stages assigned on ${parentName} — contact admin.`}``
- [ ] 2.2 `apps/web/src/features/period/ui/decision-edit-dialog.test.tsx`:
      re-run and confirm the dead-end notice text is unchanged through the
      new call site (no test edits expected if the rendered text matches)

## 3. Migrate the `report-sections` call site

- [ ] 3.1 `apps/web/src/features/report-sections/ui/item-edit-dialog-fields.tsx`:
      replace the `RecordStageStep` import (currently from `../../period`)
      with `StageStep` from the local `report-sections` module (same-slice
      import, no barrel hop needed), passing the same `deadEndNotice`
      pattern as 2.1
- [ ] 3.2 `apps/web/src/features/report-sections/ui/item-edit-dialog.test.tsx`:
      re-run, same expectation as 2.2

## 4. Migrate the `review` slice call site

- [ ] 4.1 `apps/web/src/features/review/ui/risk-edit-dialog-fields.tsx`:
      replace `RiskStageStep` with `StageStep` from `../../report-sections`,
      passing `id="risk-stage"`, `previewSeverity={severity}`, and
      `deadEndNotice="No stages assigned — contact admin."`
- [ ] 4.2 `apps/web/src/features/review/ui/risk-edit-dialog.test.tsx`:
      re-run, same expectation as 2.2

## 5. Remove the duplicated components

- [ ] 5.1 Delete `apps/web/src/features/period/ui/record-stage-step.tsx`
- [ ] 5.2 Remove the `RecordStageStep` export line from
      `apps/web/src/features/period/index.ts`
- [ ] 5.3 Delete `apps/web/src/features/review/ui/risk-stage-step.tsx`
      (never exported from `review/index.ts` — no barrel edit here)
- [ ] 5.4 Grep the repo for any remaining `RecordStageStep`/`RiskStageStep`
      reference (import or string) and confirm zero hits

## 6. Spec delta

- [ ] 6.1 `stage-step-shared-component` (new spec): ADD a requirement that
      the stage-selection + dead-end-notice UI for a product-scoped parent
      (item, decision, risk) is a single shared component, not per-record-type
      duplicates

## 7. Gates and verification

- [ ] 7.1 `pnpm --filter @customreport/api db:generate`
- [ ] 7.2 `cd apps/web && pnpm exec vitest run src/features/report-sections/ui/stage-step.test.tsx src/features/period/ui/decision-edit-dialog.test.tsx src/features/report-sections/ui/item-edit-dialog.test.tsx src/features/review/ui/risk-edit-dialog.test.tsx`
- [ ] 7.3 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 7.4 `pnpm build`
- [ ] 7.5 Manual: open Item, Decision, and Risk edit dialogs on a product
      with all stages unassigned from a dev-from-source app; confirm each
      dialog's contact-admin notice text is unchanged
- [ ] 7.6 `openspec validate stage-step-component-dedup --strict`
