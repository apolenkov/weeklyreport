# report-item-display-integrity Specification

## Purpose

Keep every counted current-week and next-week report item visible under its
stored product identity when current assignments change.

## Requirements

### Requirement: Counted report items remain rendered

The lead report form MUST render every current-week and next-week item included
in its visible section count. When a stored item references a product that is
absent from the lead's current assignment list, the form MUST preserve the
item's stored product identity and render it in a deterministic appended
product column. It MUST NOT drop, duplicate, or silently reassign the item.

#### Scenario: A historical item belongs to an unassigned product

- **GIVEN** a lead has a stored report item for a product that is not in the lead's current product assignments
- **WHEN** the lead opens the report form
- **THEN** the assigned-product columns remain first
- **AND** an appended column identifies the stored product
- **AND** the item remains rendered and reachable
- **AND** the visible section count equals the number of rendered item cards

#### Scenario: Several unassigned products own stored items

- **GIVEN** stored report items reference several products absent from the current assignment list
- **WHEN** the board groups the items
- **THEN** it appends one column per missing product in stable first-seen order
- **AND** each stored item appears exactly once under its own product identity
