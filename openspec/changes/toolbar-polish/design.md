# Design: toolbar-polish

## Guiding principle

One intuitive control vocabulary, identical for lead and head: green segmented
toggles for navigation (scope, view-mode), grey 32px icon buttons for utility
actions (fill-from, choose-past, version, pdf-export, save). The two surfaces
should be indistinguishable in their control language.

## Changes

1. **Toggles → green.** Revert `scope-toggle.tsx` and `view-mode-toggle.tsx` to
   the brand accent family (`--color-starbucks-accent` active fill, white active
   text; surface inactive). Restore the prior green snapshots. Keep the
   leading-edge agent placeholder reposition and its position test from commit
   `6a362c2c` — only the toggle colors revert.
2. **Export PDF → icon button.** Render `export-pdf-button.tsx` through the shared
   `ToolbarIconButton` (32px, `aria-label` "Export PDF", tooltip). Keep the
   disabled-when-unpublished behavior; the precondition moves entirely to the
   tooltip.
3. **Lead toolbar spacing.** Normalize the lead toolbar icon-button row to one
   consistent gap (the uneven gap before Save was the reported issue).
4. **Toggle→dialog bug.** Reproduce live first. On the head report the toggles are
   `setScope` (state) and a `<Link>` (view-mode) — no dialog is wired, so the
   dialog likely comes from a downstream effect (e.g. an accordion auto-expand /
   add-signal reacting to the re-render). Root-cause in the browser, then fix so
   no item/risk/decision dialog opens on a toggle. If it cannot be reproduced, the
   requirement still stands as a guard and the finding is recorded.

## Spec reversals (deliberate, recorded)

- `report-toolbar-parity` previously protected the `Export PDF` visible label (a
  reaction to the 2026-06-10 "icon-only nobody could decode" critique). This
  change exempts `Export PDF` from that rule, accepting reduced label visibility
  in exchange for one consistent icon-action vocabulary across lead and head.
- `head-toolbar-semantics` Req0 returns to the green family (the neutral styling
  in `6a362c2c` is reverted); Req2 drops the Export-PDF visible-label assertion.

## Commit hygiene

`6a362c2c` (unpushed) is partly reverted, not dropped: keep its agent-placeholder
reposition + position test; revert its toggle-color edits. The spec-hygiene commit
`c8e019a8` is unrelated and stays.

## Out of scope

- Card content and chip semantics (→ `report-card-clarity`).
- Seed data (→ `demo-seed-datasets`).
