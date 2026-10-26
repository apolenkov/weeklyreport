# Spec Delta

## ADDED Requirements

### Requirement: A hovered slide mark's tooltip MUST NOT outlive its anchor

The tooltip that a slide row or author badge shows on hover MUST be removed when
that anchor leaves the document while hovered. An anchor unmounting MUST NOT
remove a tooltip that another anchor is showing.

#### Scenario: The hovered row leaves the list

- **WHEN** a reviewer hovers a slide row and the row is removed from the list
- **THEN** no tooltip remains on screen

#### Scenario: An unrelated mark unmounts

- **WHEN** a slide row's tooltip is shown and an unrelated author badge unmounts
- **THEN** the row's tooltip stays visible
