## ADDED Requirements

### Requirement: Lead report surfaces present truthful navigation and counts

The lead report read surfaces MUST NOT present inert navigation affordances
or grammatically incorrect counts. Specifically, two low-risk defects found by
the lead-role driver on run `wf_d2d739f7-3a7`:

1. A search result on `/reports` that deep-links to
   `/lead/report/[reportId]#section-<id>` MUST resolve to a real in-page
   target — either the lead form renders a matching `id="section-<id>"` anchor,
   or the dead `#section-<id>` fragment MUST be removed from the link so it does
   not imply navigation that does nothing.
2. The product accordion period label MUST pluralize its item noun correctly:
   "1 item", "N items" — never a hardcoded plural ("1 items").

#### Scenario: a search result deep-links to a report section

- **WHEN** a user opens a `/reports` search result that targets
  `/lead/report/[reportId]#section-<id>`
- **THEN** the page either scrolls to the matching section anchor
- **OR** the link carries no `#section-<id>` fragment at all (no inert anchor)

#### Scenario: a period contains exactly one item

- **WHEN** the product accordion renders a period with a single item
- **THEN** the label reads "1 item" (singular), not "1 items"
