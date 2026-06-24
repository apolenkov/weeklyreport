# report-card-clarity Specification

## Purpose

TBD - created by archiving change report-card-clarity. Update Purpose after archive.

## Requirements

### Requirement: The stage chip is an identity label, not a status signal

An item's stage chip SHALL render with a single uniform treatment that names the
SDLC stage (and the contributing lead's initials), independent of the item's
workflow status. The item's workflow status (`in-progress` / `completed` /
`blocked` / `planned`) SHALL be conveyed by a separate signal on the row (left
stripe or a dedicated marker), never by the stage chip's fill.

#### Scenario: two items in different workflow states

- **WHEN** a product card renders a completed item and an in-progress item on the
  same stage
- **THEN** both stage chips render with the same uniform treatment
- **AND** the difference in workflow status is shown by the row stripe/marker,
  not by the chip color

### Requirement: Needs Attention never duplicates an item

A product's escalation ("needs attention") SHALL fold into the Risks & Blockers
section as a leading row rather than render as a separate "Needs Attention"
banner, and SHALL be suppressed when its text matches the text of a row already
rendered in the same product card — whether a current/next-week item or a risk.
When it renders, it SHALL add information beyond what the item and risk rows
already show, and it SHALL carry a Flagged identity gutter and a Blocked /
At Risk severity badge. The Risks & Blockers section renders when the product has
either structured risks or a distinct escalation.

#### Scenario: escalation text equals a shown item

- **WHEN** a product's escalation text is identical to a current-week item's text
- **THEN** no escalation row renders that duplicate text

#### Scenario: escalation text equals a shown risk

- **WHEN** a product's escalation text is identical to a rendered risk's text
- **THEN** no escalation row renders above the duplicate risk

#### Scenario: escalation adds information

- **WHEN** a product's escalation is a distinct head-facing summary
- **THEN** it renders as a leading row inside Risks & Blockers with a Flagged
  gutter and a Blocked / At Risk badge
- **AND** no standalone "Needs Attention" banner appears

### Requirement: By-lead scope slices each product to one lead

In the head report "by lead" scope, a product card under a lead SHALL show only
that lead's own contribution to the product (their items, risks, decisions, and
stages). The "by product" scope SHALL continue to show the full cross-lead
aggregate of each product.

#### Scenario: a lead owns two products

- **WHEN** the head views the report grouped by lead and a lead owns two products
- **THEN** two product cards render under that lead, each limited to that lead's
  items and stages

#### Scenario: a product has multiple contributing leads

- **WHEN** a product was authored by two leads and the head groups by lead
- **THEN** each lead's card for that product shows only their own items
- **AND** no other lead's items appear in it

### Requirement: Add-item and add-risk offer stages scoped to the product

When a lead adds an item or risk, the SDLC stage options offered SHALL depend on
the selected product — only the stages relevant to that product (the author's
owned stages on it) are selectable.

#### Scenario: selecting a single-stage product

- **WHEN** a lead opens the add-item dialog and selects a product owned on one
  stage
- **THEN** only that stage is offered

#### Scenario: selecting a two-stage product

- **WHEN** a lead selects a product owned on Development and Testing
- **THEN** both Development and Testing are offered, and no unrelated stage is

### Requirement: A product card is scannable at a glance

The product card SHALL present its content so the head can read it at a glance:
no duplicated content, a clear hierarchy carried by typography and spacing rather
than competing fills, and the status signal legible without a legend.

#### Scenario: a presenter scans a card

- **WHEN** the head opens a product card with items, risks, and a decision
- **THEN** each section reads as a distinct block with no repeated content
- **AND** the alarm hue (red) appears only on blocked content

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
