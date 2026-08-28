## MODIFIED Requirements

### Requirement: Deterministic gate covers only bounded critical journeys

The blocking browser gate MUST freeze only reviewed, stabilized WeeklyReport critical journeys. Route-wide navigation, console, network, page-error, and axe checks remain catalog-driven; the gate MUST NOT enumerate every DOM control or compile an exhaustive state/interaction graph.

#### Scenario: A critical journey is frozen

- **WHEN** a lead, head, admin, or viewer journey is required for release acceptance
- **THEN** one deterministic Playwright scenario asserts the user-visible outcome and required read-back
- **AND** no exhaustive per-element expected-outcome model is added

#### Scenario: A non-critical catalog intent remains exploratory

- **WHEN** a reviewed intent is not part of the release-critical denominator
- **THEN** it remains available to a human or advisory driver
- **AND** it does not expand the blocking acceptance contour implicitly

## ADDED Requirements

### Requirement: Human and AI drivers are advisory, not acceptance authorities

Human and AI drivers MAY inspect the live WeeklyReport surface using the catalog, but their reports MUST be treated as review candidates. Only deterministic gates and the bounded Playwright acceptance contour may produce the blocking product verdict.

#### Scenario: An AI driver reports a candidate

- **WHEN** an AI driver identifies a possible browser defect
- **THEN** the candidate is independently reproduced by a deterministic test or reviewed product evidence before it blocks acceptance
- **AND** the driver cannot mutate or overwrite the canonical test result
