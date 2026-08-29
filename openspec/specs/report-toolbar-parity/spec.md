## Purpose

The lead and head report surfaces must share one toolbar vocabulary so the
period-context bar, its compact icon buttons, and the labeled header actions read
consistently across surfaces and do not regrow into per-surface bespoke styles.

## Requirements

### Requirement: Report surfaces share one toolbar container component

Report-context control bars MUST render through one shared component.
Every such bar (period navigation, archive toggle, draft utilities) on
the lead, head, and viewer report surfaces uses `ReportToolbar`
(`apps/web/src/shared/ui/report-shell/report-toolbar.tsx`) — not
through per-surface bespoke containers. This covers the lead form
(`apps/web/src/features/report-pages/ui/lead/shell/lead-form.tsx`), the head review shell
(`apps/web/src/features/report-pages/ui/head/head-report-shell.tsx`), the new viewer
report shell (the read-only analogue of the head shell consumed by
`/reports/[reportId]`), and the shared report page
(`apps/web/src/features/report-pages/ui/weekly/weekly-report-page.tsx`)
consumed by `/head/report`, `/reports/[reportId]`, and the lead
preview. A page MUST NOT stack two period toolbars; when a shell
composes the toolbar, it passes the element through the page's
explicit `toolbar` slot, which replaces the inner context bar and
renders below the page header row.

#### Scenario: the head review page renders

- **WHEN** `/head/report/[reportId]` renders in form mode
- **THEN** exactly one period toolbar appears, using the shared
  `ReportToolbar` container
- **AND** it sits below the page header row, matching the lead
  arrangement

#### Scenario: a standalone consumer of the shared report page renders

- **WHEN** `/reports/[reportId]` renders for a viewer
- **THEN** its period-context bar uses the shared `ReportToolbar`
  container
- **AND** the viewer report shell composes that bar through the page's
  `toolbar` slot, never stacking a second one

### Requirement: Compact toolbar icon buttons share one primitive

Icon-only action buttons inside the report toolbar MUST render through
the shared `ToolbarIconButton` primitive
(`apps/web/src/shared/ui/report-shell/toolbar-icon-button.tsx`) at
one compact 32px size, and MUST each carry an `aria-label` and a
tooltip (`title`). Converting a text control to an icon button MUST
NOT change its behavior, ARIA role, or state semantics — a switch
stays `role="switch"` with `aria-checked`. The archive toggle is a quiet
state indicator and deliberately carries NO numeric count badge: a count
on the control read as a "press me" call-to-action rather than a switch,
so the archived-period count is not surfaced on the toggle itself.

#### Scenario: the archive toggle renders as an icon button

- **WHEN** the report toolbar renders the archive toggle on the lead
  or head surface
- **THEN** it is a 32px icon button with `aria-label` and tooltip
- **AND** it keeps `role="switch"` and `aria-checked`
- **AND** it carries no numeric count badge (a quiet state indicator, not
  a counted call-to-action)

#### Scenario: a toolbar icon button is inspected for accessibility

- **WHEN** any icon-only button inside the report toolbar renders
- **THEN** it exposes a non-empty accessible name via `aria-label`
- **AND** a tooltip with equivalent wording

### Requirement: Labeled header actions are not icon-ified by parity work

Named commit actions MUST keep their visible text labels whether they render on the page header line or inside `ReportToolbar`; compact utility controls use icon-only treatments with an `aria-label` + tooltip.

The rule is by control kind, not by container: a compact icon-only toolbar
control (e.g. `Export PDF`, and the mode-adaptive collapse-all / fullscreen
control) MUST render with an `aria-label` + tooltip; a named commit control MUST
keep its visible text label whether it sits on the page header line's
document-action group or in the report toolbar's context-control bar. The named
actions that durable specs require labeled (`Present`, `Print`, `Publish` — see
`head-toolbar-semantics`) and the lead commit/reversal actions (`Submit Section`,
`Request Reopen`, `Revoke`) MUST keep their visible text labels; promoting the
document actions onto the page header line does NOT icon-ify them. The former
`Toggle All` button is replaced by the icon-only mode-adaptive collapse-all
(edit) / fullscreen (slides) control in the context bar, which carries its
accessible name via `aria-label` + tooltip rather than a visible text label.
`Export PDF` stays out of the keep-labeled set (user sign-off 2026-06-16). The
lead commit label is `Submit Section` (a period is never globally "submitted").

#### Scenario: labeled actions keep their text on the header line

- **WHEN** the report surface renders the labeled commit and utility actions in
  the page header line's document-action group
- **THEN** `Publish` / `Submit Section` (and `Present` / `Print` / `Request
Reopen` / `Revoke` where present) keep their visible text labels, not icon-only

#### Scenario: the context-bar collapse/fullscreen control is icon-only

- **WHEN** the report toolbar's context bar renders the mode-adaptive
  collapse-all / fullscreen control
- **THEN** it is icon-only with an `aria-label` + tooltip (not a visible "Toggle
  All" text label)

### Requirement: The lead toolbar presents the same control set in edit and slides

The lead report toolbar MUST render the same set of context controls in both edit and slides modes — including the Record-visibility toggle — so no control changes position or appears/disappears when the lead switches between modes.

1. The Record-visibility toggle (Mine only / Everyone) MUST render in both edit
   and slides modes (today it renders only in edit), so the controls after it do
   not shift position between modes.
2. The toolbar's control order and geometry MUST be identical across modes; the
   only mode-adaptive slot is the existing trailing utility (collapse-all in
   edit, fullscreen in slides), which already occupies one fixed-width position.
3. The visibility toggle MUST be functional in slides, not an inert placeholder —
   it drives the slide deck's record visibility (see `status-slide-rendering`).

#### Scenario: switching edit to slides keeps controls in place

- **WHEN** a lead toggles the view-mode control from edit to slides on their
  report
- **THEN** the Record-visibility toggle remains present in the same position and
  the view-mode toggle and trailing utility do not shift horizontally

#### Scenario: the visibility toggle is present and live in slides

- **WHEN** a lead views their report in slides mode
- **THEN** the Mine only / Everyone toggle is rendered and interactive, and
  changing it changes what the deck shows (not a disabled placeholder)

### Requirement: The viewer report toolbar presents the head control set minus mutations

The viewer report toolbar MUST render the head control set minus every mutation
control. The viewer MUST get the product/lead scope toggle, the slides (present)
view-mode control, and the Export-PDF action; the viewer MUST NOT get Publish &
Lock, Reopen, or Move-to-archive. Switching the viewer between edit and slides
modes MUST NOT add, remove, or reposition any of the viewer's controls. The
`?mode=slides` deep link (and the `/present` redirect into it) MUST render the
report in slides mode for the viewer, not silently fall back to form mode.

This brings the viewer toolbar to "head minus mutation" so a viewer can present the
report, while the read-only guarantee stays intact. The **published-only guarantee
is removed** by `viewer-live-status` (the viewer now reads the current period live);
the toolbar's control set and read-only stance are unchanged. It does not change the
lead or head toolbars.

#### Scenario: Viewer sees the presenting controls

- **WHEN** `/reports/[reportId]` renders for a viewer
- **THEN** the toolbar shows the product/lead scope toggle, the slides view-mode
  control, and the Export-PDF action
- **AND** all of them use the shared `ReportToolbar` container

#### Scenario: Viewer never sees mutation controls

- **WHEN** the viewer report toolbar renders in either edit or slides mode
- **THEN** Publish & Lock, Reopen, and Move-to-archive are absent
- **AND** no other control mutates report or period state

#### Scenario: Viewer slides deep link renders slides

- **GIVEN** a viewer
- **WHEN** the viewer opens `/reports/[reportId]?mode=slides` (or `/present`, which
  redirects there)
- **THEN** the report renders in slides mode, not form mode

#### Scenario: Viewer control set is stable across modes

- **GIVEN** a viewer on `/reports/[reportId]`
- **WHEN** the viewer toggles the view-mode control between edit and slides
- **THEN** the scope toggle, the view-mode control, and Export-PDF remain present
  in the same positions
