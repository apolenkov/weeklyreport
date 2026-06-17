# Toolbar two-row layout: document action vs context control

## Why

The report toolbar mixes two kinds of control on one line: operations on the
report document (Save, Submit, Publish, export) and controls that only change
which report you see and how it is presented (period navigation, archive,
scope, view mode, expand-all). Users cannot tell at a glance which controls
touch the document and which only reframe it.

This change reorganizes the toolbar into two stacked rows by a single axis —
**Document action vs Context control** — so the document operations sit
together with a clear primary commit, and the framing controls sit together in
a quiet neutral row. The axis is "operates on the document" vs "changes which /
how shown", NOT "mutates data vs read-only" (a context control such as the
visibility scope may persist a setting yet still belongs to the bottom row).

## What Changes

- Split the report toolbar into two rows: a top **Document action** row and a
  bottom **Context control** row, for `lead` and `head`. `viewer` and the lead
  preview inherit the structure because they render the same `WeeklyReportPage`.
- Top row carries an accent hierarchy: the forward primary commit (Submit
  Section / Publish & Lock) is the single solid brand-green button; other
  document actions take an accent outline. Bottom row is neutral grey with no
  primary-action accent fill (the segmented-toggle active-state indicator and
  the transient Save busy state keep their existing accent — they mark
  selection/status, not a commit).
- **Reversal** lifecycle actions (Request Reopen, Revoke, head Reopen) do NOT
  use the inviting green — they take a neutral/outline treatment, so colour
  keeps one meaning (forward-safe green) consistent with the existing
  "hue carries one meaning" discipline.
- Existing Coming-soon document actions (lead Version stub, lead PDF stub)
  reserve their slot in the top row as inert controls, so the bar does not jump
  when a deferred feature later activates. No new controls are introduced;
  "Copy" is the Fill-From icon, not a separate control, and is NOT added.
- Context controls placed in the bottom row: period navigation, the
  show-archived-periods filter, Scope (head Product|Leads / lead Mine|Everyone),
  view mode (Edit|Slides), expand-all (Toggle All), Agent review. The
  published-period "Move to archive" lifecycle button is a document action (top
  row), distinct from the show-archived filter.
- On a lead read-only past period, hide only the real mutating actions
  (Save/Submit/Fill-From); the inert Coming-soon controls stay visible per the
  deferred-feature pattern.
- Rename the lead commit button copy `Submit Report` → `Submit Section`, to
  match the glossary (a period is never globally "submitted"; submission is a
  per-lead act on a section). Adjust tests asserting the old label.
- Status indicators (Live · X/Y Submitted badge, autosave time, "No submitted
  content yet" hint) stay out of the two action rows — they remain on the
  status/header line.

## Out of scope

- Reviving versions/snapshots (the Version control stays the existing inert
  Coming-soon stub; versions-v2 remains parked).
- Adding a real Copy control or a real lead PDF export.
- Admin surfaces (admin does not render the report toolbar).
- Full breakpoint redesign — out of scope; but narrow-width reachability IS in
  scope (each row must scroll/wrap so no control is clipped out of reach).

## Impact

- Affected specs: ADDED `report-toolbar-layout`; MODIFIED `report-toolbar-parity`
  (labeled actions keep text after moving into the document-action row; lead
  commit renamed) and `head-toolbar-semantics` (segmented toggles + the
  deferred placeholder relocate from the header into the Context control row,
  visual-family and ComingSoon rules preserved). Honours without modifying
  `lead-report-controls-integrity` (Save busy accent; read-only hides real
  commit controls; show-archived only when archived periods exist),
  `deferred-feature-pattern` (inert controls stay visible), and
  `lead-toolbar-presentation` (inert-control shape).
- Affected code (paths): `apps/web/src/components/report-shell/report-toolbar.tsx`,
  `.../report-shell/{scope-toggle,view-mode-toggle,archive-toggle,save-now-button,toolbar-icon-button,agent-review-coming-soon}.tsx`,
  `apps/web/src/components/lead/{lead-form,fill-from-button,version-coming-soon,pdf-export-coming-soon,period-navigator}.tsx`,
  `apps/web/src/components/weekly-report/{weekly-report-page,publish-lock-button,export-pdf-button}.tsx`,
  `apps/web/src/components/head/head-report-shell.tsx`, and the route headers
  `apps/web/src/app/(app)/reports/[reportId]/page.tsx` (viewer) and
  `.../lead/report/[reportId]/preview/page.tsx` (lead preview). Note:
  `publish-lock-button` and `export-pdf-button` live under `weekly-report/`, not
  `report-shell/`.
- Docs: CONTEXT.md gains glossary entries for `Document action` and
  `Context control` (concept only — the layout/colour detail lives in
  `design.md`).
