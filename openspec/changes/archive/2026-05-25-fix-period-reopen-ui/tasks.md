# Tasks

## Backend audit + frontend action

- [x] PERIOD-T1: Grep API for `openPeriod` / `reopenPeriod` / `reopen`
      procedures; verify signature and `@IsHead` guard.
      — `period.reopen` at `trpc.router.ts:1832`, guarded by `headProcedure`.
- [x] PERIOD-T2: Add tRPC hook `usePeriodReopen()` in
      `apps/web/src/hooks/use-period-reopen.ts`.
      — Inline `useMutation(trpc.period.reopen.mutationOptions(...))` at
      `weekly-report-page.tsx:118-132`. Separate hook file not needed; pattern
      is consistent with other mutations in this codebase.
- [x] PERIOD-T3: Add "Reopen" button to period card (head/admin surfaces
      only); button disabled if period is open.
      — `publish-lock-button.tsx:57-76` renders "Reopen Period" when
      `periodStatus === "published"`.
- [x] PERIOD-T4: Add confirmation dialog with message: "Reopening this
      period will allow leads to edit reports again."
      — `ConfirmDeleteDialog` with `showReopenDialog` state at
      `publish-lock-button.tsx:78-88`.
- [x] PERIOD-T5: Handle success/error: toast "Period reopened", refetch
      period list, close dialog.
      — `toast.success("Period reopened")` + `trpcUtils.period.getByReportId.invalidate()`
      at `weekly-report-page.tsx:123-130`.
- [x] PERIOD-T6: Unit test: verify button visible on closed period, hidden
      on open period, mutation triggered on confirm.
      — `publish-lock-button.test.tsx:121` + `weekly-report-page.test.tsx:541`.
- [x] PERIOD-T7: Commit — `feat(period): add reopen action for head/admin`.
      — Already shipped in prior phases (Phase 22 plan 22-05).

## Verification

```bash
pnpm --filter @customreport/web test -- \
  src/components/period-view/__tests__/period-reopen.test.tsx
pnpm --filter @customreport/web typecheck
```
