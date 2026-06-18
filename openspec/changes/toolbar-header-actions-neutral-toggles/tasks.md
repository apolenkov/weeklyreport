# Tasks

## 1. Shared segmented-toggle primitive (neutral family)

- [x] 1.1 Add a `SegmentedToggle` presentational primitive under
      `apps/web/src/components/report-shell/` that renders the segmented-pill chrome:
      neutral `--color-border` outline, solid `--color-surface-empty` track, pill
      radius, one shared per-segment `min-width`, no vertical padding beyond the 44px
      touch target. Active segment: `--color-foreground` fill + white text. Inactive:
      transparent over the track, `--color-muted-foreground` text, hover →
      `--color-foreground`. Consumer supplies the element per segment.
- [x] 1.2 Unit-test the primitive: active/inactive classes, equal segment width,
      neutral (non-accent) active fill, keyboard focus visible.

## 2. Compose the three toggles onto the primitive

- [x] 2.1 Refactor `ViewModeToggle` to compose `SegmentedToggle` with two
      `<Link scroll={false}>` segments; preserve URL navigation and the slides route.
- [x] 2.2 Refactor `ScopeToggle` to compose `SegmentedToggle`; preserve
      `role="radiogroup"` / `role="radio"` and the 2–3 segment count.
- [x] 2.3 Refactor `RecordVisibilityToggle` (lead Mine/Everyone) to compose
      `SegmentedToggle`; preserve `aria-pressed` two-state semantics. It now matches
      Edit/Slides and Product/Leads.
- [x] 2.4 Update tests/snapshots that assert the old brand-accent active fill or
      the old grey-padded Mine/Everyone style to the neutral family.

## 3. Remove the undefined `--color-surface` reference

- [x] 3.1 Confirm the segmented toggles in `report-shell` (`view-mode-toggle`,
      `scope-toggle`, and the lead `RecordVisibilityToggle`) no longer read
      `var(--color-surface)`; their inactive segment uses `--color-surface-empty`.
      Scope the grep to those toggle files — do NOT touch other pre-existing
      `--color-surface` callsites (e.g. the empty-submissions state in
      `weekly-report-page.tsx`), which are a separate undefined-token issue outside
      this change (noted in proposal Out of scope).

## 4. Move document actions onto the page header line

- [x] 4.1 `ReportToolbar`: drop the `documentActions` prop/row; the component
      renders only the context-control bar (one bordered row) with its
      `aria-label="Context controls"` group.
- [x] 4.2 Lead (`lead-form.tsx`): render the document-action group (Version⏳,
      PDF⏳, Fill-From, Save, Submit Section / Request Reopen / Revoke) in the
      header's right slot, wrapped in `role="group" aria-label="Document actions"`.
      Keep the green single-primary accent hierarchy; reversal actions stay neutral.
- [x] 4.3 Weekly report page (`weekly-report-page.tsx`): render the
      document-action group (Export PDF, Move to archive, Publish & Lock, or the
      shell-supplied leading action) in the header's right slot. Viewer gets only the
      Export PDF icon there; Back-to-Archive + Agent review stay in the context bar.
- [x] 4.4 Head shell (`head-report-shell.tsx`): in slides mode, render the same
      header action group + single-row context bar; keep the department label on the
      header line as a label.
- [x] 4.5 Toggle All stays a quiet neutral text button (icon + label) in the
      lead context bar — not green, not a segmented toggle.

## 5. Accessibility + reachability

- [x] 5.1 Header action group has an accessible group name; focus order is header
      actions → context bar (DOM order: header before toolbar).
- [x] 5.2 Header line wraps (`flex-wrap`) and the context bar scrolls/wraps so no
      control is clipped at narrow widths.
- [x] 5.3 Verify icon-only controls keep `aria-label` + tooltip (no
      `report-toolbar-parity` regression); labeled actions keep visible text.
- [x] 5.4 Contrast check: white on `--color-foreground` (active) and
      `--color-muted-foreground` on `--color-surface-empty` (inactive) meet AA at
      `text-sm`.

## 6. Gates + live verification

- [x] 6.1 `pnpm typecheck`, `pnpm lint`, `pnpm test` green; update component tests
      for the moved actions and neutral toggles.
- [x] 6.2 Live walk all three roles (lead, head, viewer): header carries the
      document actions, the bordered bar is one row at fixed height, the three
      toggles are identical and neutral-dark when active, no yellow tint, Toggle All
      quiet.
- [x] 6.3 Head header density at the live width (1088px content column):
      resolved by making the header's left block `flex-1 min-w-0` so it yields space
      and the document-action group stays on the header line's right (matching lead),
      rather than moving the department label into the context bar. The department
      label stays on the header line (keeps `head-toolbar-semantics`); it wraps to a
      second sub-line within the left block only in the worst case (empty period +
      publish-precondition hint).
