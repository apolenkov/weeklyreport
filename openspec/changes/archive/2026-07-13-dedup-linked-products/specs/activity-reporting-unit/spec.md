## ADDED Requirements

### Requirement: Duplicate linked-product ids are rejected as a clean validation error

A `linkedProductIds` payload containing a repeated product id MUST be rejected at schema validation on `projectActivityCreateSchema` and `projectActivityUpdateSchema`, rather than being allowed to reach the
database and collide with `ProjectActivityProduct`'s
`@@unique([activityId, productId])` constraint. The repository layer MUST
additionally dedupe `linkedProductIds` before writing the `create` path's
join rows, and MUST use `skipDuplicates: true` on the update path's
`createMany` call, so a caller that bypasses the shared schema still cannot
trigger an unhandled Prisma unique-constraint error.

#### Scenario: a create payload with a duplicate product id is rejected

- **GIVEN** a `projectActivity.create` payload whose `linkedProductIds`
  contains the same product id twice
- **WHEN** the payload is validated against `projectActivityCreateSchema`
- **THEN** validation fails with a `BAD_REQUEST` naming the duplicate, and no
  database write is attempted

#### Scenario: an update payload with a duplicate product id is rejected

- **GIVEN** a `projectActivity.update` payload whose `linkedProductIds`
  contains the same product id twice
- **WHEN** the payload is validated against `projectActivityUpdateSchema`
- **THEN** validation fails with a `BAD_REQUEST` naming the duplicate, and no
  `ProjectActivityProduct` reconciliation is attempted

#### Scenario: a non-schema caller with duplicated ids does not raise an unhandled Prisma error

- **GIVEN** a repository-level `create` or `update` call whose
  `linkedProductIds` contains a repeated id, bypassing the shared Zod schema
- **WHEN** the repository builds the `ProjectActivityProduct` join rows
- **THEN** the duplicate is deduped (create path) or ignored via
  `skipDuplicates` (update path), and no `P2002` propagates out of the
  repository
