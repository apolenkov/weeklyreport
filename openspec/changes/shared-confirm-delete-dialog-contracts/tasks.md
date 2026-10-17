# Tasks

## 1. Contract and RED (source-only)

- [x] 1.1 Add the TASK-503.43 contract tests to `confirm-delete-dialog.test.tsx` (RED for C5240, C5241 focused-to-pending, C5243, C5246 disconnected; controls for the rest). Not executed: the pre-commit hook installed dependencies, but no test, typecheck or build was run in this stage

## 2. GREEN (after Root GO and install)

- [x] 2.1 One-shot confirm lock in `confirm-delete-dialog.tsx` (only when `isPending` is passed; reset on close and when pending ends) — `9ba95643a`
- [x] 2.2 Move focus to the panel when pending disables the focused action (mirror `ConfirmationDialog`) — `58e6bd25b`
- [x] 2.3 Reference subtitle, consequence and reversibility note from `aria-describedby` with unique ids — `04628ebd3` (one description container, one resolvable id per dialog)
- [x] 2.4 Ignore a disconnected explicit `triggerRef` on restore — `429b77bf8` in the shared `useDialogFocus` seam

## 3. Native proof (separate windows, not claimed here)

- [ ] 3.1 C5240 request count under a tight double click and Enter; C5241 activeElement/Tab/Shift+Tab/Escape; C5243 assistive-technology reading; C5246 public removed-opener sequence

## 4. Verification

- [ ] 4.1 `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm spec:check` on the final reviewed tree
