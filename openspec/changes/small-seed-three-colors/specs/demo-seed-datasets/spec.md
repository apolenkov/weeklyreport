## MODIFIED Requirements

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
