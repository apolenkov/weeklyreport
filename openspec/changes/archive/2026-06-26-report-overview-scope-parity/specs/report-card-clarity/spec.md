# report-card-clarity Specification (delta)

## ADDED Requirements

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
- **THEN** the overview renders one card per product exactly as before, and a
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
