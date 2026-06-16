# Tasks: toolbar-polish

## 1. Toggles → green

- [x] 1.1 Revert `scope-toggle.tsx` + `view-mode-toggle.tsx` to the green accent
      family (active `--color-starbucks-accent`/white; surface inactive).
- [x] 1.2 Keep the leading-edge agent placeholder + position test from `6a362c2c`.
- [x] 1.3 Restore/refresh the green scope-toggle + lead-form-viewmode snapshots.

## 2. Export PDF → icon button

- [x] 2.1 Render `export-pdf-button.tsx` via `ToolbarIconButton` (32px, icon,
      `aria-label` "Export PDF", tooltip); keep disabled-when-unpublished.
- [x] 2.2 Update head-report-shell tests asserting the old visible label.
- [x] 2.3 Preserve the `ExportPdfButton` async contract (request → poll →
      busy/disabled → completion download → failure toast); add a non-regression
      test that only the presentation primitive changed.

## 3. Lead toolbar spacing

- [x] 3.1 Normalize the lead toolbar icon-button row to one consistent gap.

## 4. Toggle→dialog bug

- [x] 4.1 Reproduce live (head report; pick scope/view toggle → observe dialog).
- [x] 4.2 Root-cause and fix so no item/risk/decision dialog opens on a toggle.
- [x] 4.3 Test: selecting a toggle opens no dialog. If not reproducible, record
      the finding and keep the guard test.

## 5. Verify

- [x] 5.1 Lead and head toolbars read identically (green toggles + grey icon row).
- [x] 5.2 Full gate green (`prisma generate && typecheck && lint && test && build`).
