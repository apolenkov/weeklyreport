# report-card-clarity Specification

## Purpose

Make product report cards scannable and scope-correct through aligned rows, explicit ownership, structured risks, stage-scoped add actions, and non-duplicated attention signals.

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
At risk severity badge. The Risks & Blockers section renders when the product has
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
  gutter and a Blocked / At risk badge
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
- **AND** status indicators use the alarm hue (red) only for blocked content
- **AND** the structured `Impact` field label retains its explicit alarm-hue treatment for every risk, independently of severity

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

### Requirement: The report overview follows the active scope

The Report overview band MUST group by the same unit as the report body for the
active scope, so the summary and the body never disagree. In `by product` scope
the overview SHALL summarize products (one card per product). In `by lead` scope
the overview SHALL summarize leads: one card per lead that has content, each card
carrying the lead's name, the lead's worst product status across that lead's
own-contribution product slices, and the lead's summed current / next / risk
counts. A lead is treated as "has content" using the SAME predicate that decides
whether the body renders a lead group — any item, risk, decision, priority, or
Needs-Attention — not the narrower current+next+risk count used for a product
card's muted state. The overview heading and explanatory copy MUST name the unit
of the active scope (products vs leads), not a fixed "products" label. Lead cards
MUST render in a deterministic order — worst status first (blocked, then at-risk,
then on-track), ties broken by lead name — mirroring the status-first order the
product overview already uses, so the overview never reshuffles unpredictably.

#### Scenario: by-lead scope summarizes leads, not products

- **WHEN** the head views the report in `by lead` scope
- **THEN** the overview renders one card per lead that has content (not one per
  product)
- **AND** each lead card shows the lead's name, the worst status among that
  lead's own-contribution product slices, and the lead's summed current / next /
  risk counts
- **AND** the overview heading names leads as the unit, not products

#### Scenario: by-product scope is unchanged

- **WHEN** the head views the report in `by product` scope
- **THEN** the overview renders one card per product, and a
  card click jumps to that product's accordion (`report-product-<id>`)

#### Scenario: clicking a lead card jumps to that lead's section

- **WHEN** the head is in `by lead` scope and clicks a lead overview card
- **THEN** the page scrolls to that lead's section (anchored at
  `report-lead-<id>`) and moves focus to the section so a keyboard or
  screen-reader user lands there too
- **AND** no product accordion is force-expanded by the lead-card click (the
  lead's product cards keep their own default open/closed state)

#### Scenario: a lead with only decisions still gets a card

- **WHEN** a lead in `by lead` scope authored only decisions (or only
  priorities, or only a Needs-Attention) and no current/next items or risks
- **THEN** that lead is treated as having content and receives an active
  overview card (not a muted/empty one), matching the body which renders that
  lead's group

#### Scenario: lead cards render in a deterministic order

- **WHEN** several leads have content with mixed worst statuses
- **THEN** the lead cards render worst-status-first (blocked, then at-risk, then
  on-track), with same-status leads ordered by name
- **AND** the order is stable across re-renders (no unpredictable reshuffle)

#### Scenario: a priority-only or needs-attention-only lead still gets a card

- **WHEN** a lead authored only priorities (or only a Needs-Attention) and no
  items, risks, or decisions
- **THEN** that lead is treated as having content and receives an active overview
  card, consistent with the body rendering that lead's group

#### Scenario: the viewer inherits the same overview

- **WHEN** the viewer views a report in `by lead` scope through the viewer
  report surface
- **THEN** the overview groups by lead identically to the head surface, because
  both render the same scope-adaptive overview component

### Requirement: Every overview activation repeats its destination action

Each activation of an active report overview card MUST be treated as fresh
navigation intent, including consecutive activations of the same card. In
product scope, explicit navigation MUST open the targeted content-bearing
product accordion and scroll it into view. A manual collapse after that
navigation MUST remain in effect through ordinary rerenders, and the next
explicit activation of that product's overview card MUST reopen and scroll it.
The activation MUST NOT reset another product accordion's local disclosure
state.

In lead scope, every activation MUST scroll to and focus the targeted lead
section, including repeated activation of the same lead. Lead navigation MUST
continue to leave product accordion disclosure states unchanged.

#### Scenario: Repeated product navigation follows a manual collapse

- **GIVEN** a user navigated to a content-bearing product from the overview and
  then manually collapsed its accordion
- **WHEN** the user activates the same product overview card again
- **THEN** that product accordion reopens and scrolls into view again
- **AND** unrelated product accordions retain their local disclosure state

#### Scenario: Ordinary rendering preserves a manual collapse

- **GIVEN** a user manually collapsed an overview-targeted product accordion
- **WHEN** the report rerenders without another overview activation for that
  product
- **THEN** the product accordion remains collapsed

#### Scenario: Navigating elsewhere preserves the previous product state

- **GIVEN** overview navigation opened one product and the user either retained
  that state or made an explicit disclosure choice
- **WHEN** the user activates another product overview card
- **THEN** the first product keeps its open or collapsed disclosure state
- **AND** the newly targeted product opens and scrolls into view

#### Scenario: Repeated lead navigation repeats focus and scroll

- **GIVEN** a user already navigated to a lead section from the overview
- **WHEN** the user activates the same lead overview card again
- **THEN** the page scrolls to and focuses that lead section again
- **AND** no product accordion is force-expanded or reset
