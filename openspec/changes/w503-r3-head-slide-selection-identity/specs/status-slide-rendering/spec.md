## ADDED Requirements

### Requirement: The head slide deck keeps the selected slide through content refreshes

The head slide deck MUST identify the selected slide by its stable key (slide id
and page index), not by its position. When a data refresh reorders, inserts or
removes other slides, the deck MUST keep rendering the same selected slide. When
the selected slide is absent from the refreshed list, the deck MUST render the
first slide instead of the empty state while any slide exists.

#### Scenario: A slide inserted before the selection does not change it

- **GIVEN** a head viewing the second slide of a deck
- **WHEN** a refetch adds a slide that sorts before it
- **THEN** the same slide remains selected at its new position

#### Scenario: The selected slide is removed

- **GIVEN** a head viewing a non-first slide
- **WHEN** a refetch removes that slide while others remain
- **THEN** the first slide renders and no empty state is shown

#### Scenario: Selection by position is no longer the contract

- **WHEN** a refetch changes the order of the remaining slides
- **THEN** the selected slide is the one with the stored key, whatever its index
