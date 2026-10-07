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
      stack to `space-y-4`.

## 4. Coverage and acceptance

- [ ] 4.1 Update component tests for the header add control, the composer host,
      and the disclosure-bound health list; update e2e selectors that referenced
      the standalone quick-move button.
- [ ] 4.2 Browser acceptance on lane A (1280×900): document height ≤2458px and
      first-viewport controls ≤35 with the audit formula; full-page screenshot.
- [ ] 4.3 Browser acceptance at 375px: no horizontal scroll, mobile targets not
      regressed.
