# Tasks

- **ITEM-T1** — Reproduce the bug locally in the item edit dialog.

- **ITEM-T2** — Inspect `item-edit-dialog.tsx` and `useFormContext` /
  `useWatch` usage; identify the stale-state closure. Add a trace log to see
  when form state changes vs. user input events.

- **ITEM-T3** — Refactor form initialization to guarantee state is ready
  before the first input event. Test: open dialog, type immediately, verify
  text persists.

- **ITEM-T4** — Extend test suite with "type immediately on open" scenario.
