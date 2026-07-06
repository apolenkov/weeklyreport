# status-slide-rendering (delta)

## ADDED Requirements

### Requirement: Paused and postponed rows keep the frame language

The lead slide grid MUST render `paused` and `postponed` items inside the shipped no-status-words frame language: both keep the dashed in-flight frame, `paused` adds a pause glyph and `postponed` a forward glyph with muted text — plus sr-only "Paused"/"Postponed" labels so screen readers and grayscale print keep the distinction. Glyph shapes (not hue) MUST carry the difference.

#### Scenario: paused item on the slide

- **WHEN** a current item with status `paused` renders on the lead slide
- **THEN** the row shows the dashed frame with a pause glyph, no status words, and an sr-only "Paused" label

#### Scenario: postponed item is distinct from planned

- **WHEN** a next item with status `postponed` renders beside a `planned` one
- **THEN** the two rows are visually distinguishable without color (glyph + muted text vs plain dashed)
