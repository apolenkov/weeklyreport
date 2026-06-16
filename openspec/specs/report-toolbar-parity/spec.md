## Purpose

The lead and head report surfaces must share one toolbar vocabulary so the
period-context bar, its compact icon buttons, and the labeled header actions read
consistently across surfaces and do not regrow into per-surface bespoke styles.

## Requirements

### Requirement: Report surfaces share one toolbar container component

Report-context control bars MUST render through one shared component.
Every such bar (period navigation, archive toggle, draft utilities) on
the lead and head report surfaces uses `ReportToolbar`
(`apps/web/src/components/report-shell/report-toolbar.tsx`) — not
through per-surface bespoke containers. This covers the lead form
(`apps/web/src/components/lead/lead-form.tsx`), the head review shell
(`apps/web/src/components/head/head-report-shell.tsx`), and the shared
report page (`apps/web/src/components/weekly-report/weekly-report-page.tsx`)
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

### Requirement: Compact toolbar icon buttons share one primitive

Icon-only action buttons inside the report toolbar MUST render through
the shared `ToolbarIconButton` primitive
(`apps/web/src/components/report-shell/toolbar-icon-button.tsx`) at
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

The icon-button rule MUST apply to controls inside the report toolbar pill.
Header-row actions that durable specs require labeled (`Present`, `Print`,
`Publish` — see `head-toolbar-semantics`) and the lead header actions (`Submit
Report`, `Toggle All`, `Request Reopen`, `Revoke`) MUST keep their visible text
labels. `Export PDF` lives inside the report toolbar pill's trailing group (not
the header utility/publish row), so the icon-button rule applies to it: it renders
as the shared 32px icon button with `aria-label` + tooltip (user sign-off
2026-06-16), and is removed from the keep-labeled set it was previously listed in.

#### Scenario: the report toolbar renders its trailing export control

- **WHEN** the report toolbar pill renders its trailing group with an export
  control
- **THEN** `Export PDF` renders as a 32px icon button with an `aria-label`/tooltip
  (an accessible name), not icon-only without one

#### Scenario: header-row labeled actions are unchanged

- **WHEN** the head report header row renders its publish and utility actions
- **THEN** `Publish` (and `Present`/`Print` if present) keep their visible text
  labels unchanged
