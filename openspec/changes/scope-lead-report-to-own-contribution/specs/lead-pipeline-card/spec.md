# lead-pipeline-card

## ADDED Requirements

### Requirement: The lead page renders only the lead's own records

The lead's own report page MUST render, as records, only the signed-in lead's own
items, risks, and decisions, and MUST NOT render any other author's item text,
risk text, impact, mitigation, decision text, item/risk counts, or full name.

Ownership is decided by authorship: a record is "own" iff the signed-in lead
authored it, regardless of which stages it spans.

#### Scenario: a co-owned product with another lead's records

- **WHEN** a lead opens their report page for a product whose stages are split
  with another lead who has filed items, risks, and decisions
- **THEN** only the signed-in lead's own items, risks, and decisions render
- **AND** no foreign item text, risk text/impact/mitigation, decision text, count,
  or full name appears anywhere on the page

#### Scenario: a risk spanning an own stage and a co-lead's stage

- **WHEN** the signed-in lead authored a risk naming both their own stage and a
  co-lead's stage
- **THEN** that risk renders as the lead's own record
- **AND** a risk authored by the co-lead never renders as text

### Requirement: A co-owned product's health is honest, shown as status-only context

The product health colour on a lead's card MUST reflect every contributing lead's
stages, so a co-owning lead is never shown a healthy product while a co-owner's
stage is at-risk or blocked.

Foreign stages MUST appear only as anonymized Product context on the SDLC
pipeline card — a dimmed, identity-only chip carrying the stage name, the
contributing lead's INITIALS, and the stage status colour — and MUST NOT carry
foreign counts, text, or full names. Foreign stage status MUST derive from the
canonical traffic-light-from-risks rule, not a blocked-item path. This applies to
the pipeline Product context chip only, not the item-row stage chip.

#### Scenario: a co-lead's stage is blocked

- **WHEN** a co-lead owns the Testing stage of a shared product and it is blocked,
  and the signed-in lead's own stages are all green
- **THEN** the product health colour reads at-risk/blocked, not green
- **AND** the co-lead's Testing stage shows as a dimmed identity-only chip with
  the contributing lead's initials and the blocked colour, with no counts

#### Scenario: a co-lead has ownership but no records

- **WHEN** a co-lead owns a stage on the shared product but has filed no items or
  risks
- **THEN** that stage still renders as a dimmed identity-only chip with initials
- **AND** it shows no counts

### Requirement: Slides mode obeys the same own-records rule

The lead slides view MUST follow the same own-records rule as the lead form — it
MUST NOT render any other author's records — while keeping the honest, status-only
Product context health signal.

#### Scenario: lead opens slides on a co-owned product

- **WHEN** a lead opens slides mode for a product they co-own
- **THEN** only the lead's own records appear on the slides
- **AND** the product health still reflects the co-owner's stage status

### Requirement: Product context is returned only to an authorized caller

The Product context read MUST return data only to a caller who owns a section in,
or has access to, the requested report; a request with an arbitrary or unrelated
`reportId` MUST return no foreign context.

#### Scenario: caller requests an unrelated report

- **WHEN** a lead requests Product context for a `reportId` in which they have no
  section and no access
- **THEN** the read returns no foreign stages, counts, names, or status
