## ADDED Requirements

### Requirement: Completion actions stay reachable after the header scrolls away

The editable lead report MUST show a compact sticky cluster containing Save state/action, Add, and Submit only after the header action group leaves the viewport, and MUST hide that cluster from view and focus while the canonical header actions are visible.

#### Scenario: A lead scrolls down a long editable report

- **WHEN** the header action group no longer intersects the viewport
- **THEN** the compact completion cluster becomes visible and keyboard reachable
- **AND** its Save, Add, and Submit controls invoke the same handlers and expose the same pending/disabled states as the header controls

#### Scenario: The lead returns to the header

- **WHEN** the header action group enters the viewport again
- **THEN** the compact cluster is hidden and not focusable
- **AND** no duplicate accessible Save, Add, or Submit control remains active

#### Scenario: The report is not editable

- **WHEN** the report is submitted, read-only, or in slides mode
- **THEN** the compact edit completion cluster does not render

### Requirement: The end of the form explains submit readiness

The editable lead form MUST render a readiness summary next to a final Submit action that states what remains unset, which eligible statuses will be automatically promoted to On Track, and which current issues block submission.

#### Scenario: Unset statuses will auto-promote

- **WHEN** owned product, activity, or stage statuses are unset but otherwise eligible for the existing submit auto-promotion
- **THEN** the summary identifies the affected count/scope under `Will be set to On Track`
- **AND** it does not describe those statuses as blocking submission

#### Scenario: Risk-stage coupling blocks submission

- **WHEN** an at-risk/blocked product has committed risk data that does not satisfy the existing stage-coupling rule
- **THEN** the summary identifies the issue under `Blocks submission`
- **AND** both the final and sticky/header Submit actions refuse to open confirmation until it is resolved

#### Scenario: The report is ready

- **WHEN** no existing client-side submit blocker remains
- **THEN** the summary announces that the report is ready
- **AND** the final Submit action opens the same confirmation flow as the header action

### Requirement: Readiness and submission share one derivation

The lead form MUST derive readiness display and client-side Submit gating from one pure projection of the current draft, products, own risks, autosave state, and mutation state; it MUST NOT maintain a separate UI-only validator.

#### Scenario: Draft data changes

- **WHEN** the lead changes a status, risk-stage link, or saved draft state
- **THEN** the summary and all Submit disabled/blocking behavior update from the same derived result
- **AND** server submit validation remains authoritative after confirmation

### Requirement: The compact cluster remains accessible on small screens

The sticky completion cluster MUST provide at least 40px interactive targets, respect the bottom safe-area inset, reserve content clearance while visible, and expose save/error/pending information without relying on color alone.

#### Scenario: A lead uses a narrow mobile viewport

- **WHEN** the compact cluster is visible near the end of the form
- **THEN** it does not cover the readiness summary or final fields
- **AND** each action is reachable by keyboard/touch with an accessible name
