## ADDED Requirements

### Requirement: The project-level flagged-red escalation is emitted once per red product

The shared Blocked-&-At-Risk builder MUST emit the project-level "flagged red"
escalation exactly once per red product, regardless of how many leads co-own
that product. The builder is `buildEscalationsFromReadSections` in
`apps/api/src/modules/published-report-snapshot.ts`. The product-level red
signal is product-scoped (it is derived from the product's effective status, not
from any single lead's contribution), so it MUST NOT be emitted once per
contributing lead's section.

De-duplication MUST happen in the builder (the single shared source for both the
live dashboard and the published-report snapshot), keyed by `projectId`, and
tracked across the whole section loop (not per section). The surviving
escalation MUST retain a deterministic contributing lead's `leadName` (the
`Escalation` schema requires a non-empty `leadName`); collapsing the duplicates
MUST NOT change the published report's correctness — the flagged-red row's
content does not depend on which owner is retained.

This de-duplication MUST apply ONLY to the project-level flagged-red escalation.
The per-item `blocked` escalations and the per-risk `unresolved_risk`
escalations are genuinely per-record and MUST remain unchanged in both count and
content.

#### Scenario: a red product co-owned by multiple leads

- **WHEN** the builder runs over report sections in which the same product is
  flagged red and is co-owned by two or more leads
- **THEN** exactly one flagged-red (`at_risk`, product-level) escalation is
  emitted for that product
- **AND** it carries a deterministic contributing lead's non-empty `leadName`

#### Scenario: item and risk escalations are unaffected by the dedupe

- **WHEN** the builder runs over sections that include `blocked` items and
  unresolved risks alongside a multi-co-owner red product
- **THEN** the per-item `blocked` escalations and the per-risk
  `unresolved_risk` escalations are emitted unchanged in count and content
- **AND** only the duplicate project-level flagged-red rows are collapsed

#### Scenario: the live and published surfaces stay in parity

- **WHEN** the same report sections are passed to the builder on the live
  dashboard path and on the published-report snapshot path
- **THEN** both surfaces receive the same single flagged-red escalation per red
  product
- **AND** neither surface renders duplicate flagged-red rows that differ only by
  assignee
