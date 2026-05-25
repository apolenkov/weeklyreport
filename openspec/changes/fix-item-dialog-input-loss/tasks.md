# Tasks

- [x] **ITEM-T1** — Reproduce the bug locally in the item edit dialog.
      (Root cause was React Hook Form reset in useEffect — already fixed by D12
      mount/unmount pattern; no React Hook Form in current code.)

- [x] **ITEM-T2** — Inspect `item-edit-dialog.tsx` and form state; identify
      the stale-state closure. (`useState` initializer now runs once at mount;
      no useEffect reset; A13 test guards against stagesForProduct ref churn.)

- [x] **ITEM-T3** — Form initialization already correct (plain `useState`).
      Typing immediately after open works — no remount possible during input.

- [x] **ITEM-T4** — Two tests added to `item-edit-dialog.test.tsx` under
      "ITEM-T4 type immediately on open" — create mode + edit mode.
      571 tests pass.
