# report-card-clarity Specification

## ADDED Requirements

### Requirement: Product-card rows share a uniform aligned anatomy

Every content row in a product card SHALL render on one shared column grid so
that, within a card, all rows' stage labels share one left edge and all rows'
primary content (item text or risk problem) shares one left edge. This covers
current-week items, next-week items, risks, and decisions. A row's stage/owner
meta SHALL occupy a fixed-width gutter; a variable-width meta MUST NOT push the
content's left edge, so the content column does not jump from row to row.

The columns, left to right, SHALL be: a priority marker column, a status rail, a
fixed-width meta gutter (SDLC stage over the contributing lead's initials), the
content, and (for item rows) a status badge.

#### Scenario: items with different-width stages align

- **WHEN** a card renders current-week items whose stage labels differ in width
- **THEN** every item's text starts at the same horizontal position
- **AND** every item's stage label starts at the same horizontal position

#### Scenario: a prioritized item does not shift the gutter

- **WHEN** a card renders a prioritized item and an unprioritized item
- **THEN** the priority marker renders in its own column, not stacked above the
  stage
- **AND** both rows' stage labels sit at the same vertical offset from the row
  top (the gutter does not float)

### Requirement: Owner initials render on every content row

Every content row SHALL display the contributing lead's initials in its gutter.
This applies to current-week items, next-week items, risks, and decisions alike:
next-week items, risks, and decisions MUST NOT omit the owner that current-week
items show.

#### Scenario: a next-week item shows its owner

- **WHEN** a card renders a next-week item authored by a lead
- **THEN** the item's gutter shows that lead's initials and SDLC stage, not a
  bare "Planned" label

#### Scenario: a risk shows its owner

- **WHEN** a card renders a risk raised by a lead
- **THEN** the risk's gutter shows that lead's initials and stage

### Requirement: Risk rows render Impact and Mitigation as structured fields

A risk row SHALL render its problem, impact, and mitigation as distinct labeled
fields rather than a single run-on string. The `Impact` label SHALL use the
alarm (blocked) hue and the `Mitigation` value SHALL use the brand-green accent.

#### Scenario: a risk renders its three parts

- **WHEN** a card renders a risk with a problem, an impact, and a mitigation
- **THEN** the problem reads as a lead line
- **AND** `Impact` and `Mitigation` render as separate labeled rows beneath it
