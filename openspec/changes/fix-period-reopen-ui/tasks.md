# Tasks

## Backend audit + frontend action

- [ ] PERIOD-T1: Grep API for `openPeriod` / `reopenPeriod` / `reopen`
      procedures; verify signature and `@IsHead` guard.
- [ ] PERIOD-T2: Add tRPC hook `usePeriodReopen()` in
      `apps/web/src/hooks/use-period-reopen.ts`.
- [ ] PERIOD-T3: Add "Reopen" button to period card (head/admin surfaces
      only); button disabled if period is open.
- [ ] PERIOD-T4: Add confirmation dialog with message: "Reopening this
      period will allow leads to edit reports again."
- [ ] PERIOD-T5: Handle success/error: toast "Period reopened", refetch
      period list, close dialog.
- [ ] PERIOD-T6: Unit test: verify button visible on closed period, hidden
      on open period, mutation triggered on confirm.
- [ ] PERIOD-T7: Commit — `feat(period): add reopen action for head/admin`.

## Verification

```bash
pnpm --filter @customreport/web test -- \
  src/components/period-view/__tests__/period-reopen.test.tsx
pnpm --filter @customreport/web typecheck
```
