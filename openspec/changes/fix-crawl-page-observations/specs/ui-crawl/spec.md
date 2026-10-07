## ADDED Requirements

### Requirement: Quick restoration compares live field state

Quick crawler state comparison MUST include deterministic live non-password input, textarea and select values, including selected options. Password values MUST NOT enter signatures. Existing checked, URL, surface, expanded and visible text state MUST remain part of comparison.

#### Scenario: A live field changes without changing page text

- **WHEN** a supported live field value changes
- **THEN** quick restoration detects the changed state and either restores it or reports incomplete restoration

#### Scenario: Password changes

- **WHEN** a password field changes
- **THEN** its value remains absent from crawler signatures

### Requirement: Current press receives its own long-task measurement

The crawler MUST finish the action task and collect long-task observations before returning press evidence. Each measurement MUST describe the action interval, excluding tasks from previous presses.

#### Scenario: Synchronous slow handler

- **WHEN** a press synchronously blocks the main thread for 250 ms
- **THEN** that result reports the blocking duration
- **AND** the next fast press does not inherit it

### Requirement: Geometry observations distinguish offscreen and scrollable controls

Crawler obstruction checks MUST use a point inside the control's visible viewport intersection. Fully offscreen controls MUST remain discoverable without unrelated edge obstructions. Hidden or clipped overflowing content MUST be reported unless intentionally truncated or internally scrollable in a native editable control; accessible auto/scroll overflow MUST NOT alone count as clipping.

#### Scenario: Offscreen control beside an unrelated viewport edge control

- **WHEN** a control lies fully outside the viewport
- **THEN** it remains discoverable without an obstruction finding from the edge control

#### Scenario: Hidden content and accessible scrolling

- **WHEN** native geometry shows hidden/clip overflow or accessible auto/scroll overflow
- **THEN** only unavailable content is reported as clipping
- **AND** intentional ellipsis and native editable scrolling remain allowed
