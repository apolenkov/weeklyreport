# report-toolbar-parity

## MODIFIED Requirements

### Requirement: Labeled header actions are not icon-ified by parity work

The icon-button rule MUST apply ONLY to controls inside the report toolbar pill.
Header-row actions that durable specs require labeled (`Present`, `Print`,
`Publish` — see `head-toolbar-semantics`) and the lead header actions (`Submit
Report`, `Toggle All`, `Request Reopen`, `Revoke`) MUST keep their visible text
labels. `Export PDF` is deliberately EXEMPT (user sign-off 2026-06-16): it renders
as the shared 32px icon button with `aria-label` + tooltip so the head and lead
toolbars share one icon-action vocabulary.

#### Scenario: the head report header renders after the parity change

- **WHEN** the head report header renders its utility and publish actions
- **THEN** `Publish` (and `Present`/`Print` if present) show their text labels
  unchanged
- **AND** `Export PDF` renders as a 32px icon button with `aria-label`/tooltip,
  not icon-only without an accessible name
