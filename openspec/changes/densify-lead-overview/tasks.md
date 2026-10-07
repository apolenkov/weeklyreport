# Tasks

## 1. Unit add affordance

- [ ] 1.1 Move the unit `Add item` control from the idle unit footer strip into
      the unit summary header; keep the accessible name `Add item to <unit name>`.
- [ ] 1.2 Keep the create composer mounting in the existing `report-unit-footer`
      host below the lineage; render no footer chrome while idle.

## 2. Control deduplication

- [ ] 2.1 Remove the standalone `Quick move to next/this week` button; the week
      move remains in the `More actions` disclosure.
- [ ] 2.2 Render the `Report health` attention list only while its disclosure is
      open; the closed strip renders the summary line only.

## 3. Vertical density

- [ ] 3.1 Lower the desktop lineage-row floor (`md:min-h-36` → `md:min-h-24`).
- [ ] 3.2 Tighten the empty-unit `No items yet` row padding.
- [ ] 3.3 Tighten the `Before you submit` card spacing.
- [ ] 3.4 Reduce the lead form stack to `space-y-5` and the support-section
      stack to `space-y-2`.

## 4. Coverage and acceptance

- [ ] 4.1 Update component tests for the header add control, the composer host,
      and the disclosure-bound health list; update e2e selectors that referenced
      the standalone quick-move button.
- [ ] 4.2 Browser acceptance on the guarded shared E2E target (1280×900): document height ≤2458px and
      first-viewport controls ≤35 with the audit formula; full-page screenshot.
- [ ] 4.3 Browser acceptance at 375px: no horizontal scroll, mobile targets not
      regressed.

- [ ] 4.4 Count the plan, write, submit path before and after at 1280×900 and
      375×812; record the additional menu activation for secondary week moves.
- [ ] 4.5 Run the full sequential E2E suite and all root verification commands.
- [ ] 4.6 Archive the change into the canonical specifications and remove the
      generated archive directory per the repository cleanliness contract.

- [ ] 4.7 Verify native Tab traversal on both widths and preserve bottom
      clearance for focused controls while the completion cluster is visible.
