# Spec Delta

## ADDED Requirements

### Requirement: A saved stage outside the available list stays visible and removable

The shared product-parent stage control (`StageMultiSelect` behind `StageStep`)
MUST show every stage name stored on an Item, Decision or Risk record but
absent from the product's current available-stage list as a chip reading
`<name> — no longer assigned`. Each chip MUST be removable from the edit dialog
without editing another field. Such a name MUST NOT render as a selectable
checkbox and MUST NOT contribute to the severity preview.

#### Scenario: A saved stage is no longer available

- **WHEN** the Item, Decision, or Risk edit dialog opens a record whose saved
  stage names include a stage absent from the product's current available
  stages
- **THEN** the stage control shows a chip reading `Legacy — no longer assigned`
  in place of the missing checkbox
- **AND** the severity preview ignores that name

#### Scenario: The lead removes the leftover chip

- **WHEN** the lead activates the remove control of a leftover chip
- **THEN** the next `onChange` payload omits that stage name
- **AND** the other selected and saved stage names are unchanged

### Requirement: An untouched saved stage stays in the stage payload

A stage name stored on the record but outside the available list MUST stay in
the next `onChange` payload until the lead removes its chip. Stage ownership
remains the server's authority (`STAGE_NOT_OWNED` and the unchanged-record rule),
so the control MUST NOT silently intersect or rewrite stored names. Names the
lead unchecks or removes MUST be dropped from the payload, preserving the order
of the names that remain.

#### Scenario: An untouched saved stage survives a toggle

- **WHEN** the lead toggles an available stage while a leftover chip is shown
- **THEN** the `onChange` payload keeps the saved unavailable name
- **AND** the saved names keep their order

#### Scenario: Unchecking an available stage keeps the saved name

- **WHEN** the lead unchecks an available selected stage while a leftover chip
  is shown
- **THEN** the payload omits the unchecked stage
- **AND** the payload keeps the saved unavailable name
