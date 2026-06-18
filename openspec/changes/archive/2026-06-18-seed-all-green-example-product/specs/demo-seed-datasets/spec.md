## ADDED Requirements

### Requirement: The small tier shows at least one fully-green product

The small tier MUST seed at least one product whose health resolves to green (on-track) — no own or foreign stage at-risk or blocked, and no covering risk — so the demo shows a healthy product alongside the at-risk and blocked ones.

1. At least one product in the small tier MUST have green health: every owned
   stage on-track or empty, no covering risk (own or foreign), and no foreign
   co-owner stage at-risk/blocked.
2. The green product MUST still be non-empty — it MUST carry at least one
   current-week item and a decision — so the card demonstrates content, not an
   empty placeholder.
3. This requirement MUST NOT weaken the existing small-tier requirements: one
   product still carries a blocked item ("A blocked item demonstrates Needs
   Attention") and one product still carries a multi-stage item ("Small tier is
   minimal and stage-realistic").

#### Scenario: a fully-green product is visible in the small tier

- **WHEN** the small tier is seeded and the primary lead opens their report
- **THEN** at least one product card reads green (on-track) health with no
  at-risk/blocked stage and no risk pill
- **AND** at least one other product still reads at-risk or blocked, so the demo
  shows both ends of the health spectrum

#### Scenario: the green product is not empty

- **WHEN** the fully-green product card renders
- **THEN** it shows at least one current-week item and a decision, so it reads
  as a healthy-but-active product rather than an empty one
