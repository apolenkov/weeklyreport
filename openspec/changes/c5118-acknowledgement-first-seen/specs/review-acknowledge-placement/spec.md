## ADDED Requirements

### Requirement: An acknowledgement receipt records the first view

An acknowledgement receipt's `seenAt` SHALL record when the reviewer first
acknowledged the group for that report. A repeated acknowledgement of the same
report and group by the same reviewer SHALL succeed without changing the stored
receipt, so the "Seen by" roster order does not change. The acknowledge control
SHALL stay disabled until the roster has loaded, SHALL mark itself busy while
loading, and SHALL NOT present a pressed or unpressed state before the
reviewer's own acknowledgement status is known.

#### Scenario: A repeated acknowledgement keeps the first view

- **GIVEN** a reviewer acknowledged a group for a report
- **WHEN** the same reviewer acknowledges the same group again
- **THEN** the receipt's `seenAt` is unchanged
- **AND** the "Seen by" roster keeps its order

#### Scenario: The control waits for the roster

- **GIVEN** the acknowledgement roster is still loading
- **WHEN** the acknowledge control renders
- **THEN** it is disabled and busy, has no pressed state, and a click sends no
  acknowledgement
