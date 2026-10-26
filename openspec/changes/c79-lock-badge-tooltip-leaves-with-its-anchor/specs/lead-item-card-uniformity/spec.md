# Spec Delta

## ADDED Requirements

### Requirement: A hovered lock badge's tooltip MUST NOT outlive its anchor

The read-only explanation shown on hover by a card's lock badge MUST be removed
when the badge leaves the document while hovered. A badge unmounting MUST NOT
remove a tooltip that another anchor is showing.

#### Scenario: The hovered card leaves the list

- **WHEN** a reviewer hovers a lock badge and its card is removed from the list
- **THEN** no tooltip remains on screen

#### Scenario: An unrelated badge unmounts

- **WHEN** another anchor's tooltip is shown and an unrelated lock badge unmounts
- **THEN** the other anchor's tooltip stays visible

#### Scenario: A previous owner leaves after another badge takes ownership

- **WHEN** one badge shows its tooltip and another badge replaces it
- **AND** the previous badge unmounts or emits mouseleave
- **THEN** the current badge's tooltip stays visible
- **AND** leaving the current badge removes its tooltip
