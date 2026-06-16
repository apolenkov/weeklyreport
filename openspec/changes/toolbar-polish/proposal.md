# Proposal: toolbar-polish

## Why

The head and lead report toolbars should read as one intuitive control language —
"the same for lead and head" (presenter direction, 2026-06-16). Today they
diverge: a recent change made the head segmented toggles neutral-grey (the
presenter prefers the brand green), the head Export-PDF is a labeled text button
while the lead utility actions are compact grey icon buttons, the lead toolbar
button row has uneven spacing, and selecting a header toggle reportedly opens an
item dialog.

## What Changes

- **Toggles return to the brand green family** — `ScopeToggle` and `ViewModeToggle`
  render as one identical green segmented family (reverting the neutral styling).
- **Export PDF becomes a compact grey icon button** — the shared 32px toolbar
  icon primitive (icon + `aria-label`/tooltip), matching the lead utility row, so
  head and lead share one icon-action vocabulary. This is a deliberate reversal
  of the earlier "Export PDF keeps a visible label" decision (user sign-off).
- **Lead toolbar button row is evenly spaced** — one consistent gap across the
  icon-button row (Fill-from, Choose-past, Version, PDF, Save).
- **Selecting a header toggle opens no dialog** — fix the reported bug where
  choosing a toggle opens an item dialog (root cause to be reproduced live).

## Capabilities

- `toolbar-polish` (new) — lead↔head control-vocabulary parity, Export-PDF icon
  button, even lead-row spacing, toggle-opens-no-dialog.
- `head-toolbar-semantics` (modified) — toggles green again; Export-PDF is an icon
  button, not a labeled control.
- `report-toolbar-parity` (modified) — Export-PDF is exempt from the
  keep-labeled rule.

## Impact

- `apps/web/src/components/report-shell/scope-toggle.tsx`,
  `view-mode-toggle.tsx` — revert to the green accent family (keep the
  leading-edge agent placeholder + position test from the prior commit).
- `apps/web/src/components/weekly-report/export-pdf-button.tsx` — render via the
  shared `ToolbarIconButton`.
- `apps/web/src/components/lead/lead-form.tsx` — even toolbar-row spacing.
- The toggle→dialog bug — root-caused and fixed (live repro).
- Modified durable specs: `head-toolbar-semantics`, `report-toolbar-parity`.
- Note: the prior unpushed commit `6a362c2c` made the toggles neutral; this change
  reverts that styling while keeping its agent-placeholder reposition and test.
