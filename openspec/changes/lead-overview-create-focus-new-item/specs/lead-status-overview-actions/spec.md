## ADDED Requirements

### Requirement: Overview create save MUST land focus on the new item

After a successful plain "Save update" in the Overview composer's create mode, the
composer MUST close and keyboard focus MUST move to the newly created item's own
Overview control, identified by the saved item's stable identity, with that item
scrolled into view. If that control is not rendered, focus MUST return to the control
that opened the composer, and otherwise to the Overview heading. Focus MUST NOT land
on a control of a different reporting unit. Cancel, edit-mode saves and "Save and add
another" keep their existing focus behaviour. The Overview MUST show a unit's
items in the same durable identity order that report reads return, so a saved item
does not move when the confirmed section is read back.

#### Scenario: A new item is saved in a unit with several rows

- **WHEN** the lead creates an item with "Save update" in a product that already shows several Current rows
- **THEN** the composer closes and keyboard focus is on the new item's control
- **AND** the new item is inside the visible scroll area
- **AND** focus is not on a control of the next product

#### Scenario: The saved item stays in place after the read-back

- **WHEN** a create save succeeds and the confirmed section is read back in durable identity order
- **THEN** the new item keeps the position it had right after the composer closed
- **AND** it stays inside the visible scroll area

#### Scenario: The new item's control is unavailable

- **WHEN** a create save succeeds but the new item's control is not rendered
- **THEN** focus returns to the control that opened the composer, or to the Overview heading if that control is gone

#### Scenario: Other composer exits are unchanged

- **WHEN** the lead cancels the composer, saves an edit, or uses "Save and add another"
- **THEN** focus follows the existing rules for that action
