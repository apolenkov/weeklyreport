## MODIFIED Requirements

### Requirement: Compact toolbar icon buttons share one primitive

Icon-only action buttons inside the report toolbar MUST render through
the shared `ToolbarIconButton` primitive
(`apps/web/src/components/report-shell/toolbar-icon-button.tsx`) at
one compact 32px size, and MUST each carry an `aria-label` and a
tooltip (`title`). Converting a text control to an icon button MUST
NOT change its behavior, ARIA role, or state semantics — a switch
stays `role="switch"` with `aria-checked`, and informational counts
(such as the archived-period count) remain visible, not tooltip-only.
As a single, explicit exception, the `ReportToolbar`'s trailing group
MAY render exactly ONE labeled primary action — the server Export-PDF
action (`pdfExport.request`) — with a visible text label rather than as
an icon-only button; no other labeled action is permitted in that group.

#### Scenario: the archive toggle renders as an icon button

- **WHEN** the report toolbar renders the archive toggle on the lead
  or head surface
- **THEN** it is a 32px icon button with `aria-label` and tooltip
- **AND** it keeps `role="switch"` and `aria-checked`
- **AND** a non-zero archived count remains visible on the control

#### Scenario: a toolbar icon button is inspected for accessibility

- **WHEN** any icon-only button inside the report toolbar renders
- **THEN** it exposes a non-empty accessible name via `aria-label`
- **AND** a tooltip with equivalent wording

#### Scenario: the toolbar trailing group renders the primary export action

- **WHEN** the `ReportToolbar` trailing group renders on a report
  surface that may export
- **THEN** it contains exactly one labeled primary Export-PDF action
- **AND** no other labeled action appears in the trailing group

### Requirement: Labeled header actions are not icon-ified by parity work

The icon-button rule MUST apply ONLY to controls inside the report
toolbar pill. Header-row actions that durable specs require labeled
(`Export PDF`, `Publish` — see `head-toolbar-semantics`) and the lead
header actions (`Submit Report`, `Toggle All`, `Request Reopen`,
`Revoke`) MUST keep their visible text labels. `Present` and browser
`Print` are no longer labeled header actions on report surfaces and are
not part of this enumeration.

#### Scenario: the head report header renders after the parity change

- **WHEN** the head report header renders its utility and publish
  actions
- **THEN** each shows its icon-plus-text or text label unchanged
- **AND** none has been reduced to icon-only rendering

#### Scenario: Present and Print are absent from the labeled header actions

- **WHEN** the head report header renders after the consolidation
- **THEN** no labeled `Present` action and no labeled browser-`Print`
  action appears in the header
