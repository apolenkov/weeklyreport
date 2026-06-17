# demo-seed-datasets

## MODIFIED Requirements

### Requirement: Small tier is minimal and stage-realistic

The `small` tier SHALL use exactly ONE lead with explicit
`(lead × product × stage)` ownership, so no product card mixes unrelated authors;
the realistic multi-lead, stage-split layout belongs to the `middle` tier, not
`small`. It SHALL contain three products: two whose items each carry a single
SDLC stage, and one fully-green product (Внутренний BI) whose single lead owns
ALL seven SDLC stages, every stage seeded with a green (`on-track`) status and
no `blocked` / `at-risk` risk, so the demo opens with one complete, healthy,
fully-owned pipeline alongside partially-owned products. At least one item SHALL
span two stages (`Development` + `Testing`) to demonstrate that `Item.stageNames`
may hold more than one stage. Russian product and stage names are seed DATA, not
UI strings.

#### Scenario: the fully-green product is fully owned

- **WHEN** the small tier is seeded and the lead opens the report for
  Внутренний BI
- **THEN** all seven SDLC stages render as owned by the single lead with a green
  status
- **AND** no stage on that product renders as unowned

#### Scenario: a partially-owned product still has unowned stages

- **WHEN** the small tier is seeded and the lead opens a single-stage product
  (Маркетинговый портал or Платформа интеграций)
- **THEN** the owned stage renders as the lead's own
- **AND** the remaining SDLC stages render as unowned, so the fully-green
  product contrasts with a partially-owned one

#### Scenario: a multi-stage item renders

- **WHEN** the small tier is seeded and the head opens the report
- **THEN** at least one item shows two stage chips (Development, Testing)

#### Scenario: ownership is partitioned by lead

- **WHEN** the head groups the small report by lead
- **THEN** the single lead's products show only that lead's own items and stages
- **AND** no product appears under a lead who authored nothing on it
