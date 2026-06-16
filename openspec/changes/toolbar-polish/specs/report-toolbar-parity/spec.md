# report-toolbar-parity

## MODIFIED Requirements

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
