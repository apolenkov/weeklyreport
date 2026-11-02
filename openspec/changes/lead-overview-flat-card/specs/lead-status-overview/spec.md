## MODIFIED Requirements

### Requirement: Empty temporal cells MUST state their emptiness in plain language

Status Overview MUST show empty desktop cells as `—` plus sr-only `No item in this period`, with the dash hidden from assistive technology. On mobile, one plain-language line per unit MUST state that other periods are empty, without naming each empty period or repeating dates. Empty cells MUST NOT render create controls; creation for an empty editable period stays reachable from the unit header Add item control, including for an entirely empty unit on mobile.

#### Scenario: A temporal cell has no content

- **WHEN** a Previously planned, Current week, or Next week desktop cell has no item
- **THEN** it shows `—` visually and `No item in this period` to a screen reader
- **AND** no edit, next-step or Add control exists inside the empty cell
- **AND** historical and read-only views expose no write controls

#### Scenario: Empty periods are compacted on mobile

- **WHEN** a mobile reporting unit contains empty temporal cells
- **THEN** one plain-language line states that other periods are empty, such as `No items in other periods`
- **AND** individual empty lanes remain collapsed and do not repeat dates or name each empty period
- **AND** the unit header Add item control stays visible, also when the unit has no items
