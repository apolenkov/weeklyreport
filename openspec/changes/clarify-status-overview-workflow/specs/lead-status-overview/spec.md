## ADDED Requirements

### Requirement: Overview MUST explain the weekly reporting sequence in plain language

The Lead Report route's Status Overview MUST present each linked work lineage as the ordered sequence `Previously planned`, `Current week`, and `Next week`. Previously planned MUST remain visibly read-only. An editable Current or Next cell MUST expose one clearly labelled primary action that names the resulting user task. Internal lineage terminology and icon-only controls MUST NOT be the sole explanation of a primary authoring action.

#### Scenario: Lead understands the three-period row

- **WHEN** an editable lead views a linked row with content in all three temporal columns
- **THEN** the row identifies the prior plan, current result, and next step in that order
- **AND** descriptions, metadata, disclosures, and action regions align consistently across the row

#### Scenario: Editable cell has one obvious action

- **WHEN** a Current or Next cell can be edited or completed
- **THEN** its primary action uses a visible task-oriented label such as `Edit update`, `Add next step`, or `Edit next step`
- **AND** any icon control has an equivalent accessible name and does not compete as a second unexplained primary action

### Requirement: Continuation drag MUST be an optional enhancement

The Lead Report route's Status Overview MUST retain pointer drag from an eligible Current item to its own Next-week target. The same continuation MUST remain available through a visible labelled button and keyboard operation. The surface MUST explain the drag outcome, reject invalid targets without persistence, and MUST NOT imply that dragging reorders records.

#### Scenario: Lead creates a next step without dragging

- **WHEN** the lead activates `Add next step` from an eligible Current lineage
- **THEN** the canonical continuation editor opens for that lineage
- **AND** saving preserves the Current result while projecting the entered Next step

#### Scenario: Lead drags Current to Next

- **WHEN** the lead drags an eligible Current item to its own Next-week target
- **THEN** the same canonical continuation editor opens with the same save, cancel, conflict, and focus behavior as the labelled action
- **AND** no item order changes

### Requirement: Promotion MUST be understandable and secondary

The Lead Report route's Status Overview MUST retain manual audited promotion of an eligible linked Next step, but MUST describe the result in plain language and present it as secondary to editing the next step. Promotion MUST preserve the existing history, conflict, locking, and canonical write behavior.

#### Scenario: Lead starts a planned next step now

- **WHEN** an eligible linked Next step exists
- **THEN** the surface offers a secondary action labelled `Start next step now`
- **AND** activating it invokes the existing audited promotion operation without introducing an automatic period transition

### Requirement: Independent updates MUST identify their temporal meaning

The Lead Report route's Status Overview MUST NOT group unmatched Current and standalone Next items under one ambiguous `Additional updates` label. Unmatched Current items MUST be identified as `Unplanned this week`; independent Next items MUST be identified as `Standalone next-week plans`. Each item MUST remain visible exactly once and retain its canonical editor and lineage behavior.

#### Scenario: Current work has no prior plan

- **WHEN** a Current item has no matching prior planned stable identity
- **THEN** it appears once under `Unplanned this week`
- **AND** its applicable edit and continuation actions remain available

#### Scenario: Next plan has no Current lineage

- **WHEN** a Next item has no matching Current stable identity
- **THEN** it appears once under `Standalone next-week plans`
- **AND** its applicable edit action remains available without implying a prior result

### Requirement: Empty temporal cells MUST communicate the next applicable step

The Lead Report route's Status Overview MUST render an empty temporal cell with either one applicable labelled action or a plain-language empty state. A decorative dash MAY accompany the state but MUST NOT be its only explanation.

#### Scenario: Linked work has no next step

- **WHEN** an eligible Current result has no linked Next commitment
- **THEN** the Next-week cell offers `Add next step`
- **AND** the row remains aligned with rows that already contain a Next step

#### Scenario: Read-only cell has no content

- **WHEN** a temporal cell is empty and cannot be edited
- **THEN** it exposes a readable `No update` state
- **AND** no write action is available
