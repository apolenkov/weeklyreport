# Tasks

## 1. Web shared dialog

- [x] 1.1 In `apps/web/src/shared/ui/dialogs/confirmation-dialog.tsx`, move focus to the dialog panel when `isPending` turns true and focus is outside the panel or on a disabled control
- [x] 1.2 Add a DOM test in `confirmation-dialog.test.tsx`: pending moves focus from the disabled confirm button to the alertdialog panel; an enabled focused child keeps focus (test-audit gate)

## 2. Native proof (separate 008 window)

- [ ] 2.1 Re-run the unchanged strengthened Fill E2E (`e2e/lead-form/completion.test.ts`, A3) as GREEN proof; keep the RED receipt `rt/a-112123-79853`

## 3. Verification

- [ ] 3.1 On the final reviewed tree run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm spec:check` and record the results
