## ADDED Requirements

### Requirement: A deck's fullscreen state ends when the deck is no longer available

The shared fullscreen state MUST be reset when the surface that owns the deck stops being a slide surface. A later return to the deck MUST NOT report fullscreen until the user enters it again, and the reset MUST NOT move focus.

#### Scenario: leaving the slide surface while in fullscreen

- **WHEN** a deck is in fullscreen and the report switches to a surface without the deck (for example browser Back from slides to document mode)
- **THEN** the fullscreen toggle state is not-fullscreen
- **AND** returning to the slide surface shows the toggle as "Enter fullscreen" (`aria-pressed="false"`)

#### Scenario: no stale exit-focus after re-entering the deck surface

- **WHEN** the user returns to the slide surface after the reset above and the document reports a fullscreen change to not-fullscreen
- **THEN** focus is not moved to the toolbar toggle
