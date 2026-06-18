## MODIFIED Requirements

### Requirement: Labeled header actions are not icon-ified by parity work

Named commit and utility actions MUST keep their visible text labels whether they render on the page header line or inside `ReportToolbar`; only compact icon-only controls use the `ToolbarIconButton` primitive.

The rule is by control kind, not by container: a compact icon-only toolbar
control (e.g. `Export PDF`) MUST render as the shared 32px `ToolbarIconButton`
with an `aria-label` + tooltip; a named commit/utility control MUST keep its
visible text label whether it sits on the page header line's document-action
group or in the report toolbar's context-control bar. The named actions that
durable specs require labeled (`Present`, `Print`, `Publish` — see
`head-toolbar-semantics`) and the lead actions (`Submit Section`, `Toggle All`,
`Request Reopen`, `Revoke`) MUST keep their visible text labels; promoting the
document actions onto the page header line does NOT icon-ify them (`Toggle All`
stays a labeled neutral button in the context bar). `Export PDF` stays out of the
keep-labeled set (user sign-off 2026-06-16). The lead commit label is `Submit
Section` (a period is never globally "submitted").

#### Scenario: labeled actions keep their text on the header line

- **WHEN** the report surface renders the labeled commit and utility actions in
  the page header line's document-action group
- **THEN** `Publish` / `Submit Section` (and `Present` / `Print` / `Request
Reopen` / `Revoke` where present) keep their visible text labels, not icon-only
- **AND** `Toggle All` keeps its visible text label in the context-control bar

#### Scenario: the report toolbar renders its trailing export control

- **WHEN** the report surface renders an export control
- **THEN** `Export PDF` renders as a 32px icon button with an `aria-label`/tooltip
  (an accessible name), not icon-only without one
