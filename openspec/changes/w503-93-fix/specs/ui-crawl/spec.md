# Specification Delta: ui-crawl

## MODIFIED Requirements

### Requirement: Geometry observations distinguish offscreen and scrollable controls

Crawler obstruction checks MUST use a point inside the control's visible viewport intersection. Fully offscreen controls MUST remain discoverable without unrelated edge obstructions. Hidden or clipped overflowing content MUST be reported unless intentionally truncated or internally scrollable in a native editable control; accessible auto/scroll overflow MUST NOT alone count as clipping.

Controls that have zero area, are clipped out of view by overflow, are translated offscreen, or have zero scale MUST NOT be pressed in batch runs and MUST yield a distinct result (`invisible`). Overlays with `opacity: 0` or `pointer-events: none` MUST NOT be treated as obstructing elements.

#### Scenario: Offscreen control beside an unrelated viewport edge control

- **WHEN** a control lies fully outside the viewport
- **THEN** it remains discoverable without an obstruction finding from the edge control

#### Scenario: Hidden content and accessible scrolling

- **WHEN** native geometry shows hidden/clip overflow or accessible auto/scroll overflow
- **THEN** only unavailable content is reported as clipping
- **AND** intentional ellipsis and native editable scrolling remain allowed

#### Scenario: Invisible or unreachable controls in batch runs

- **WHEN** a batch encounters a control with zero area, clipped by hidden overflow, translated offscreen, or scaled to zero
- **THEN** the crawler does not press the control
- **AND** the press result reports status `invisible`

#### Scenario: Overlay with opacity zero

- **WHEN** an overlay with opacity 0 is positioned over a clickable control
- **THEN** the overlay is not considered an obstruction
- **AND** the control is not reported as obstructed by that overlay
