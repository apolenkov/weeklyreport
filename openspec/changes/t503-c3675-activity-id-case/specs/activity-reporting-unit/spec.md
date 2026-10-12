## ADDED Requirements

### Requirement: Project-activity write identifiers are parsed in canonical lowercase

`projectActivityCreateSchema`, `projectActivityUpdateSchema`,
`projectActivityArchiveSchema` and `projectActivityLeadEdgeSchema` SHALL accept
`groupId`, `id`, `activityId`, `leadId` and `linkedProductIds` in any letter
case and SHALL emit them in lowercase, so reference lookups against the
case-sensitive text keys resolve the same row regardless of input case. The
read contract `projectActivitySchema` SHALL keep persisted ids verbatim.

#### Scenario: an uppercase reference id is normalized on every project-activity command

- **WHEN** a `projectActivity.create`, `update`, `archive`, `attachLead` or `detachLead` payload carries `groupId`, `id`, `activityId` or `leadId` with uppercase hex letters and is parsed by its schema
- **THEN** the parsed output carries each such id in lowercase

## MODIFIED Requirements

### Requirement: Duplicate linked-product ids are rejected as a clean validation error

A `linkedProductIds` payload containing a repeated product id MUST be
rejected — including a case-variant repeat of the same UUID (ids are stored
as case-sensitive text and generated lowercase) — at schema validation on
`projectActivityCreateSchema` and `projectActivityUpdateSchema`, rather than
being allowed to reach the database and collide with
`ProjectActivityProduct`'s `@@unique([activityId, productId])` constraint.
The schemas MUST emit `linkedProductIds` normalized to lowercase so every
downstream comparison operates on the canonical form. The repository layer
MUST additionally dedupe `linkedProductIds` case-insensitively before
writing the `create` path's join rows, and MUST use `skipDuplicates: true`
on the update path's `createMany` call, so a caller that bypasses the shared
schema still cannot trigger an unhandled Prisma unique-constraint error.

#### Scenario: a create payload with a duplicate product id is rejected

- **GIVEN** a `projectActivity.create` payload whose `linkedProductIds`
  contains the same product id twice
- **WHEN** the payload is validated against `projectActivityCreateSchema`
- **THEN** validation fails with a `BAD_REQUEST` naming the duplicate, and no
  database write is attempted

#### Scenario: a create payload with a case-variant duplicate is rejected

- **GIVEN** a `projectActivity.create` payload whose `linkedProductIds`
  contains the same UUID twice differing only in letter case
- **WHEN** the payload is validated against `projectActivityCreateSchema`
- **THEN** validation fails with a `BAD_REQUEST` naming the duplicate, and no
  database write is attempted

#### Scenario: an update payload with a duplicate product id is rejected

- **GIVEN** a `projectActivity.update` payload whose `linkedProductIds`
  contains the same product id twice (byte-identical or case-variant)
- **WHEN** the payload is validated against `projectActivityUpdateSchema`
- **THEN** validation fails with a `BAD_REQUEST` naming the duplicate, and no
  `ProjectActivityProduct` reconciliation is attempted

#### Scenario: an uppercase id is normalized to lowercase

- **GIVEN** a valid payload whose `linkedProductIds` contains an
  uppercase-lettered UUID
- **WHEN** the payload is parsed by `projectActivityCreateSchema` or
  `projectActivityUpdateSchema`
- **THEN** the parsed output carries the id in lowercase

#### Scenario: a non-schema caller with duplicated ids does not raise an unhandled Prisma error

- **GIVEN** a repository-level `create` or `update` call whose
  `linkedProductIds` contains a repeated id — byte-identical or
  case-variant — bypassing the shared Zod schema
- **WHEN** the repository builds the `ProjectActivityProduct` join rows
- **THEN** the duplicate is deduped (create path) or ignored via
  `skipDuplicates` (update path), and no `P2002` propagates out of the
  repository
