# Tasks

## 1. Web reminder regressions

- [x] 1.1 Extend the existing RemindersTab suite with overlapping real-mutation
      lifecycles and per-render next-send coverage; prove the regressions fail with
      the affected production files from b70ed2a5b's parent.
- [x] 1.2 Apply the owner-authorized minimal mutation-level settlement repair;
      verify both completion orders and both success and failure release only the
      correct row, and the complete reminder suite passes.

## 2. Web period regressions

- [x] 2.1 Extend the existing PeriodNavigator suite with shrinking-option
      selection, right-gutter/width bounds and swipe discrimination; prove the
      relevant cases fail with the three production files from 385265c71's parent
      and pass on the current implementation.

## 3. Planning and integration checks

- [x] 3.1 Add the admin-reminders-ui, dialog-listbox-a11y and
      head-report-visibility deltas; verify `openspec validate --all --strict` and
      the existing head-envelope unit suite.
- [x] 3.2 Run `pnpm --filter @customreport/web test`, `pnpm typecheck`,
      `pnpm lint`, `pnpm format:check` and `pnpm spec:check`; record every exit code
      and any baseline limitation. Run no database or E2E phase.

## Workflow follow-up

- Commit through the repository hooks, push the assigned branch and open a
  separate MR targeting main without merging; deliver the MR URL, commits,
  check results and old-code failures in `~/work/handoffs/task-287-02-codex.md`.
- Coordinator reviews the MR and the pending MR !72 pipeline before deciding
  when to merge; this executor does not merge either MR.
