## ADDED Requirements

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
