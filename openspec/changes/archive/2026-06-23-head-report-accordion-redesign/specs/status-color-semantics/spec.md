# status-color-semantics Specification

## ADDED Requirements

### Requirement: Item rows carry a workflow-status badge surface

An item row in the head report product card SHALL convey its workflow status
(`blocked` / `in-progress` / `completed` / `planned`) through a dedicated,
right-aligned status badge surface, in addition to the row's status rail. The
badge SHALL draw its colors from named status tokens — never hardcoded hex — and
SHALL keep the stage label an identity surface (the badge, not the stage,
encodes status). Risks and decisions SHALL NOT carry this item badge: a risk's
severity reads from its rail and `Impact` label, and a decision has no workflow
status.

#### Scenario: each status renders a distinctly colored badge

- **WHEN** a card renders a blocked item, an in-progress item, a completed item,
  and a planned item
- **THEN** each renders a status badge whose color comes from a named token
- **AND** the four badges are mutually distinct

#### Scenario: the alarm hue stays reserved

- **WHEN** the status badges render
- **THEN** the red alarm hue appears only on the `blocked` badge

### Requirement: The in-progress status has a named token

The `in-progress` workflow status SHALL resolve its badge color through a named
token (`--color-status-in-progress-bg` / `--color-status-in-progress-fg`) added
to the global token surface, distinct from the reserved alarm (red), at-risk
(amber), and priority (gold) hues. A future surface rendering in-progress MUST
reuse this token rather than hardcode the value.

#### Scenario: the in-progress badge resolves a token

- **WHEN** an in-progress item renders its status badge
- **THEN** the badge background and foreground come from the named in-progress
  tokens
- **AND** the value is not a hardcoded hex literal in the component
