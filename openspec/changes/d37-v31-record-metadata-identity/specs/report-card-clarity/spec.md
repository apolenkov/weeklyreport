## MODIFIED Requirements

### Requirement: The stage chip is an identity label, not a status signal

An item's stage chip SHALL render with a single uniform treatment that names the
SDLC stage (and the contributing lead's initials), independent of the item's
workflow status. The item's workflow status (`in-progress` / `completed` /
`blocked` / `planned`) SHALL be conveyed by a separate signal on the row (left
stripe or a dedicated marker), never by the stage chip's fill.

#### Scenario: two items in different workflow states

- **WHEN** a product card renders a completed item and an in-progress item on the
  same stage
- **THEN** both stage chips render with the same uniform treatment
- **AND** the difference in workflow status is shown by the row stripe/marker,
  not by the chip color

#### Scenario: Repeated admitted decision-stage labels are updated

- **GIVEN** a decision read model contains two Planning stage labels and one Design label
- **WHEN** the decision metadata is rendered and then updated to one Design label and three Planning labels
- **THEN** its stage metadata displays exactly the supplied number of labels in the supplied order
- **AND** every label retains the same uniform identity treatment without changing stored report data
