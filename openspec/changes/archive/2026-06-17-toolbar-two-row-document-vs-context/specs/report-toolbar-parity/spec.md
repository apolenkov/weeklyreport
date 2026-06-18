## MODIFIED Requirements

### Requirement: Labeled header actions are not icon-ified by parity work

Named commit and utility actions MUST keep their visible text labels even when they render inside `ReportToolbar`; only compact icon-only controls use the `ToolbarIconButton` primitive.

The rule is by control kind, not by container: a compact icon-only toolbar
control (e.g. `Export PDF`) MUST render as the shared 32px `ToolbarIconButton`
with an `aria-label` + tooltip; a named commit/utility control MUST keep its
visible text label whether it sits in the page header row or the document-action
toolbar row. The named actions that durable specs require labeled (`Present`,
`Print`, `Publish` — see `head-toolbar-semantics`) and the lead actions (`Submit
Section`, `Toggle All`, `Request Reopen`, `Revoke`) MUST keep their visible text
labels; the two-row layout moves the lead actions into the document-action row
but does NOT icon-ify them. `Export PDF` stays out of the keep-labeled set
(user sign-off 2026-06-16). The lead commit label is `Submit Section` (renamed
from `Submit Report` to match the glossary: a period is never globally
"submitted").

#### Scenario: labeled actions keep their text in the document-action row

- **WHEN** the report toolbar renders the labeled commit and utility actions in
  the document-action row
- **THEN** `Publish` / `Submit Section` (and `Present` / `Print` / `Toggle All`
  / `Request Reopen` / `Revoke` where present) keep their visible text labels,
  not icon-only

#### Scenario: the report toolbar renders its trailing export control

- **WHEN** the report toolbar pill renders its trailing group with an export
  control
- **THEN** `Export PDF` renders as a 32px icon button with an `aria-label`/tooltip
  (an accessible name), not icon-only without one
