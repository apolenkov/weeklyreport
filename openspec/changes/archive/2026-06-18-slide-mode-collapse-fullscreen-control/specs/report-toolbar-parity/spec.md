## MODIFIED Requirements

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
