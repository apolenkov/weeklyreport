# Proposal

## Why

Equivalent relation inputs with equal display names produce different activity and linked-product order in live and frozen report sections; review rows also lack an explicit query order. D37-V14 C3505 demonstrates downstream sensitivity with the actual canonical mapper and snapshot builder. The coordinator selected current presentation keys followed by identity as the minimal deterministic contract.

## What Changes

- Preserve the existing Russian name comparator for activities and linked products, using activityId/productId only to break equal-name ties.
- Request sectionReviews by createdAt ascending, then reviewerId ascending for timestamp ties.
- Verify actual mapper/frozen permutation invariance and the existing public Prisma include contract.

## Capabilities

### Modified Capabilities

- `published-section-order-determinism`: specify the exact relation collection orders shared by canonical live and frozen section projections.

## Impact

Owned report-sections.mappers.ts/report-sections.include.ts and their approved existing include test change. No schema, write path, authorization, product filtering or section-author sorting change is required. Main specification synchronization remains with Root.

## Non-goals

- Inferring creation time, chronology or recency from UUIDs.
- Reordering status Maps, single-object activity relations, stages or other collections.
- SQL performance changes or claiming repeated PG/native UI acceptance from pure mapper checks.
