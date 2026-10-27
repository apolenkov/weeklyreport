# Tasks

## 1. Contract

- [x] 1.1 Delta `record-status-derivation`: Move to next week changes placement or acknowledges a saved next-week plan, without asserting continuation.
- [x] 1.2 Delta `lead-status-overview`: the Move action follows that contract.
- [ ] 1.3 Validate the change with `pnpm exec openspec validate lead-move-keeps-next-step --strict`.

## 2. Web behaviour

- [x] 2.1 RED then GREEN in `apps/web/src/features/report-sections/model/lead-actions/lead-item-actions.saved-next-step.test.ts`: a placement Move refuses a saved next step, while the acknowledgement keeps the Current occurrence, its result and its commitment and only clears `carriedOver`.
- [x] 2.2 RED then GREEN in `apps/web/src/features/report-pages/ui/lead/shell/lead-status-overview.test.tsx`: Move confirms in place without the editor or the continuation-promotion command, and an editor week change to Next is refused.
- [x] 2.3 RED then GREEN in `apps/web/src/features/report-sections/model/lead-form/use-lead-form-draft.test.tsx`: the week-card arrow applies the same acknowledgement and announces it only when it applies.
- [x] 2.4 `buildNextWeekPlanAcknowledgementPatch` owns the acknowledgement, `buildMoveItemPatch` stays placement-only, and MOVE-NEXT-CURRENT promotion is unchanged.

## 3. Verification

- [ ] 3.1 Focused Vitest for the lead item actions, the Overview suite and the Slides draft actions; changed-file prettier and eslint; `pnpm --filter @weeklyreport/web typecheck`.
- [ ] 3.2 `openspec validate --all --strict`.
- [ ] 3.3 Browser acceptance of the Move acknowledgement on the Overview row and the Slides week card; owned by the parent integration.
