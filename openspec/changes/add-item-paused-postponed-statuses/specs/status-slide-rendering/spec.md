# status-slide-rendering (delta)

## ADDED Requirements

### Requirement: Paused and postponed rows keep the no-status-words visual language

The lead slide grid (`buildOwnItemRow` → `ItemRow`) MUST render `paused` and `postponed` items without visible status text, using the slide's established row treatment (glyph or muted row styling, distinct from the blocked tint and the at-risk wash) plus an sr-only state label, so screen readers and grayscale print keep the distinction.

#### Scenario: Paused item on the slide

- **WHEN** a current item with workflow status `paused` renders on the lead slide
- **THEN** the row shows a non-textual paused mark, no status words appear, and an sr-only "Paused" label is present

#### Scenario: Postponed item does not read as active work

- **WHEN** a `postponed` item renders in the Current work column
- **THEN** its treatment is visibly distinct from unmarked in-progress rows and from the completed check
