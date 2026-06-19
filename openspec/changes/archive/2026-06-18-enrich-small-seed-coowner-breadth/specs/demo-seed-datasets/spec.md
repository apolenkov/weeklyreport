## ADDED Requirements

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
