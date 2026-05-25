# Tasks

> All tasks completed 2026-05-25 on branch `fix/PRJ-2/save-disc`.

## SaveNowButton — icon-only

- [x] **SAVE-T1** Rewrite `save-now-button.test.tsx` to assert icon-only
      behavior (aria-label assertions, data-testid checks, no text-content
      assertions)
- [x] **SAVE-T2** Rewrite `save-now-button.tsx` — icon-only render, 4-state
      machine (disc / spinner / check / alert-triangle), `data-testid` markers,
      `aria-label` / `title` accessible name
- [x] **SAVE-T3** Move `SaveNowButton` from `leadingExtras` to tail of
      `trailingExtras` in `lead-form.tsx`; add vertical separator; remove
      `leadingExtras` usage
- [x] **SAVE-T4** Manual UI verification in browser (disc / spinner / check
      states, tap target, tooltip, read-only guard)
- [x] **SAVE-T5** Commit: `feat(report-shell): icon-only save button,
anchored far-right in toolbar`

## StageMultiSelect — warning banner

- [x] **STAGE-T1** Extend `stage-multi-select.test.tsx` with 7 banner
      behaviour tests (position above checkboxes, role/aria-live, 0/1/≥2
      selected copy, singleStage and empty-state guard)
- [x] **STAGE-T2** Reshape `stage-multi-select.tsx` — hoist banner above
      checkbox row, collapse enumeration, amber styling,
      `role="status" aria-live="polite"`, `data-testid="stage-scope-banner"`
- [x] **STAGE-T3** Sibling-pattern audit (`grep amber-* / role=alert` in
      lead + ui components) + browser verification across Risk/Item/Decision
      dialogs
- [x] **STAGE-T4** Commit: `feat(stage-multi-select): hoist scope warning to
a banner above the chips`

## Verification

Gates run after each commit:

```bash
pnpm --filter @customreport/web typecheck
pnpm --filter @customreport/web vitest run \
  src/components/report-shell/save-now-button.test.tsx \
  src/components/lead/stage-multi-select.test.tsx \
  src/components/lead/risk-edit-dialog.test.tsx \
  src/components/lead/lead-form-sync-bridge.test.tsx
```

All green. Branch `fix/PRJ-2/save-disc` — 3 commits, not yet pushed.
