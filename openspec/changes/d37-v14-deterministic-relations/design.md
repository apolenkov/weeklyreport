# Design

## Context

See proposal.md. The canonical mapper already name-sorts activities and each activity's linked products, but stable JavaScript sorting preserves arbitrary input order on equal names. Reviews retain their queried order. Public snapshot assembly consumes these mapped arrays. The live publication repository already uses the ordered reportFullIncludeForSnapshot; its stable author-name sort is not a separate defect and is unchanged.

## Decisions

Preserve each existing name comparison, then compare the collection's durable activityId/productId only when names compare equal. This keeps existing presentation priority while making identity ties independent of relation retrieval order. IDs are opaque deterministic tie-breakers, not timestamps.

For sectionReviews, enforce createdAt then reviewerId in the one shared Prisma include consumed verbatim by live/frozen producers. The reviewer identity is unique per section. Do not simulate driver sorting inside the mapper or duplicate the query contract in a second read path.

Before: relation order → equal-name stable sort / unordered review input → varying mapped/frozen arrays. After: current name key + identity, or queried review timestamp + reviewer identity → canonical arrays → unchanged snapshot projection and consumers. Frozen title-override projection keeps the canonical activity order; this change does not redefine its existing name key.

## Invariants

Section membership, activity risk scope, product status Maps, reviewer privacy, canonical items/risks/decisions stableId order, and role/lifecycle/write policies stay unchanged. No database schema/migration or destructive operation is introduced.

## Risks / Trade-offs

- Sorting IDs first would change current presentation → the test uses a name-primary entry with a larger ID, and tied-name rows in both input orders.
- Pure mapper permutation proves downstream determinism but not Prisma row ordering → the review test checks the actual public include shape; real PG/live/frozen acceptance remains a separate Root lane boundary.

## Migration Plan

No data migration or flag is required. Deliver sources/tests with normal hooks; Root synchronizes the owning spec and runs aggregate gates/review. Native and real PG acceptance remain explicitly open. Rollback restores these source/test changes together and reopens ordering sensitivity.
