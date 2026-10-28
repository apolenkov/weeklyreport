# Tasks

## 1. Automated RED Tests

- [x] 1.1 Add RED test for `useDiscardGuard` verifying that `isPending` is forwarded to `ConfirmationDialog` so that buttons are disabled while `isPending` is true. Verify with `pnpm --filter @weeklyreport/web test use-discard-guard.test.tsx`.
- [x] 1.2 Add RED tests for `ItemEditDialog`, `DecisionEditDialog`, and `RiskEditDialog` verifying that when `isPending={true}` is passed, the footer Save button has `disabled` and `aria-busy` set. Verify with `pnpm --filter @weeklyreport/web test`.

## 2. Implementation

- [x] 2.1 Pass `isPending` to `ConfirmationDialog` in `apps/web/src/shared/ui/dialogs/use-discard-guard.tsx` and verify test 1.1 turns GREEN.
- [x] 2.2 Pass `savePending={props.isPending}` to `RecordDialogFooter` in `apps/web/src/features/report-sections/ui/item-edit-dialog.tsx`, `apps/web/src/features/period/ui/decision-edit-dialog.tsx`, and `apps/web/src/features/review/ui/risk-edit-dialog.tsx` and verify test 1.2 turns GREEN.

## 3. Verification

- [x] 3.1 Validate OpenSpec change with `pnpm exec openspec validate w503-85-fix --strict`.
- [ ] 3.2 Run the six required repository gates using `run-checks`.
