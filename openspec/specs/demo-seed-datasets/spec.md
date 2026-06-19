# demo-seed-datasets Specification

## Purpose

TBD - created by archiving change demo-seed-datasets. Update Purpose after archive.

## Requirements

### Requirement: Three selectable demo-seed tiers

The system SHALL provide three demo-seed tiers — `small`, `middle`, `huge` —
each runnable independently (`pnpm db:seed:small`, `db:seed:middle`,
`db:seed:huge`), with `small` as the default demo seed. The canonical test
fixture `prisma/seed.ts` SHALL remain unchanged.

#### Scenario: a presenter seeds the small tier

- **WHEN** `pnpm db:seed:small` runs against a non-prod database
- **THEN** the database is reset to the small dataset only
- **AND** the head, the leads it uses, and `ACTIVE_REPORT_ID` resolve so that
  dev-login and `/head/report/<ACTIVE_REPORT_ID>` load without error

#### Scenario: the test fixture is untouched

- **WHEN** any demo tier is seeded
- **THEN** `prisma/seed.ts` and the IDs/names its E2E assertions pin are not
  modified by the change

### Requirement: Small tier is minimal and stage-realistic

The `small` tier SHALL contain 2 products whose items each carry a single SDLC
stage, plus 1 product carrying an item that spans two stages
(`Development` + `Testing`), to demonstrate that `Item.stageNames` may hold more
than one stage. It SHALL use 2–3 canonical leads with explicit
`(lead × product × stage)` ownership so no product card mixes unrelated authors.

#### Scenario: a multi-stage item renders

- **WHEN** the small tier is seeded and the head opens the report
- **THEN** at least one item shows two stage chips (Development, Testing)
- **AND** the other two products show single-stage items only

#### Scenario: ownership is partitioned by lead

- **WHEN** the head groups the small report by lead
- **THEN** each lead's products show only that lead's own items and stages
- **AND** no product appears under a lead who authored nothing on it

### Requirement: Demo periods support the head and switching flows

The `small` tier SHALL seed the active (`open`) period plus one prior
`published` period for the leads it uses, so the demo can show the head's
published view and period switching without seeding deep history.

#### Scenario: published view is demoable

- **WHEN** the small tier is seeded
- **THEN** the period navigator exposes the active week and one published week
- **AND** opening the published week renders a non-empty head report

### Requirement: A blocked item demonstrates Needs Attention

The demo SHALL seed at least one blocked item so the derived "Needs Attention"
banner has content to surface. The banner is DERIVED from blocked items
(`buildEscalationsFromReadSections`), not a seedable row, so it cannot be authored
directly. De-duplicating the banner against the item it derives from is owned by
`report-card-clarity`, not by the seed.

#### Scenario: a blocked item surfaces the banner

- **WHEN** the small tier is seeded with one blocked item
- **THEN** that product's card has a Needs-Attention banner to demonstrate

### Requirement: Demo seed is deterministic

Every demo tier SHALL use fixed UUIDs and fixed content (no run-time randomness
in identifiers), so a reseed reproduces the same dataset and any pinned
references stay valid. Period dates MAY be computed relative to the run week so
the active period always covers "today".

#### Scenario: reseeding is stable

- **WHEN** the same tier is seeded twice
- **THEN** the entity IDs and textual content are identical across runs

### Requirement: The small tier seeds cross-author co-ownership and foreign content

The small demo tier MUST seed more than one author across the lead's products so that the lead report's Mine/Everyone visibility toggle has a visible effect and the SDLC pipeline shows realistic split ownership, while remaining deterministic.

1. The small tier MUST include at least one co-owner lead besides the primary
   lead, and MUST assign that co-owner ownership of at least one SDLC stage on a
   product the primary lead also contributes to.
2. Stage ownership across the three products MUST be consistent — a given
   colleague who owns a stage owns that same stage on each product where that
   role applies (ownership is role-shaped, not randomly scattered).
3. On at least one product the primary lead MUST own exactly two stages, and at
   least one stage on that product MUST be left unowned (an unfilled role), so
   the pipeline shows both partial ownership and a vacant stage.
4. The small tier MUST seed each co-owner at least one foreign report-section
   record (a current-week item and/or a risk/decision) on a shared product, so
   that switching the lead report to Everyone surfaces real read-only foreign
   rows and foreign locked stage chips, while Mine shows only the primary lead's
   records.
5. The enriched small tier MUST remain deterministic and idempotent: fixed ids
   and dates, no wall-clock or random values, stable across reseed (consistent
   with `seed-determinism`).

#### Scenario: Everyone reveals foreign content in the small tier

- **WHEN** the primary lead opens their report seeded by the small tier and
  switches the visibility toggle from Mine to Everyone
- **THEN** at least one read-only foreign item/risk/decision authored by a
  co-owner becomes visible, and at least one stage chip shows as locked/owned by
  another author — so the toggle visibly changes the content

#### Scenario: the internal project shows partial ownership and a vacant stage

- **WHEN** the small tier is seeded and the primary lead's internal
  ("eBay"-style) product is rendered in the SDLC pipeline
- **THEN** the primary lead owns exactly two of its stages and at least one
  stage is unowned (no assignee), reflecting an unfilled role

#### Scenario: reseed is deterministic

- **WHEN** the small tier is reseeded after `prisma migrate reset`
- **THEN** the same ids, authors, stage assignments, and foreign records are
  produced, with no wall-clock or random drift

### Requirement: The small tier shows at least one fully-green product

The small tier MUST resolve to THREE distinct product health colors at once — one green (on-track), one at-risk (yellow), and one blocked (red) — so the demo shows the whole spectrum on one screen. The green product is the internal BI product; it is the showcase with broad ownership and a single vacant stage.

1. Exactly one product MUST read green: every owned stage on-track or empty, no
   covering risk (own or foreign), and no foreign co-owner stage at-risk/blocked.
   This product is the internal BI product.
2. On the green product every SDLC stage MUST be owned by some author (the primary
   lead or a co-owner) EXCEPT exactly one stage — Support — left unowned, so the
   pipeline reads as broadly staffed with one visible vacant role. The primary lead
   still owns exactly two of its stages.
3. Exactly one product MUST read at-risk (yellow): at least one at-risk stage and NO
   blocked stage (Платформа интеграций).
4. Exactly one product MUST read blocked (red): at least one blocked stage
   (Маркетинговый портал). The blocked demonstration MAY be a foreign-owned stage so
   the "co-owned product red on a stage you do not own" scenario is preserved.
5. The green product MUST still be non-empty — at least one current-week item and a
   decision — so the card demonstrates content, not an empty placeholder.
6. This requirement MUST NOT weaken the existing small-tier requirements: one product
   still carries a blocked item ("A blocked item demonstrates Needs Attention") and
   one product still carries a multi-stage item ("Small tier is minimal and
   stage-realistic").

#### Scenario: three health colors are visible in the small tier

- **WHEN** the small tier is seeded and the primary lead opens their report
- **THEN** one product card reads green (on-track) with no risk pill, one reads
  at-risk (yellow), and one reads blocked (red)

#### Scenario: the green showcase is broadly staffed with one vacant stage

- **WHEN** the green BI product renders in the SDLC pipeline
- **THEN** every stage except Support is owned by some author, and Support is vacant
- **AND** the primary lead owns exactly two of its stages

#### Scenario: the green product is not empty

- **WHEN** the fully-green product card renders
- **THEN** it shows at least one current-week item and a decision, so it reads as a
  healthy-but-active product rather than an empty one

### Requirement: Co-owner foreign content spans both week buckets across multiple shared sections

The small demo tier MUST seed each co-owner foreign report-section content that
spans BOTH week buckets — a current-week item and a next-week item — across more
than one shared section, so the lead report's Everyone visibility lens shows a
fuller cross-author team picture, while resolved product health stays unchanged.

1. Each co-owner (Maria on Testing, Igor on DevOps) MUST seed at least one
   shared section that carries a `current`-week item AND a `next`-week item, so
   the Everyone lens shows foreign content in both week buckets, not only the
   current one.
2. Foreign co-owner content MUST span at least two shared sections per co-owner
   where that co-owner's role applies, so the Everyone lens reads as a real
   shared workload rather than a single token row.
3. Each co-owner MUST still seed at least one foreign decision on a shared
   product, preserving the existing cross-author decision coverage.
4. New foreign rows MUST be on-track items (or decisions, which carry no
   severity); this requirement MUST NOT add any new risk, so resolved product
   health is unchanged — Маркетинговый портал stays at-risk (yellow), Платформа
   интеграций stays on-track (green, the `seed-all-green-example-product`
   anchor), and Внутренний BI stays blocked (red).
5. The enriched content MUST remain deterministic and idempotent: fixed ids and
   fixed text, no wall-clock or random values, stable across reseed (consistent
   with `seed-determinism` and the existing small-tier determinism requirement).

#### Scenario: Everyone shows foreign content in both week buckets

- **WHEN** the primary lead opens their small-tier report and switches the
  visibility toggle from Mine to Everyone
- **THEN** at least one co-owner's foreign content appears in BOTH the
  current-week and next-week buckets on a shared product
- **AND** the foreign content spans more than one shared section, so the
  Everyone lens reads as a fuller shared workload

#### Scenario: enrichment does not move product health

- **WHEN** the small tier is seeded with the broadened co-owner content
- **THEN** Маркетинговый портал still reads at-risk (yellow), Платформа
  интеграций still reads on-track (green), and Внутренний BI still reads
  blocked (red)
- **AND** no new risk row was added by this enrichment

#### Scenario: reseed is deterministic

- **WHEN** the small tier is reseeded after `prisma migrate reset`
- **THEN** the same ids, authors, week-bucket items, and decisions are produced,
  with no wall-clock or random drift
