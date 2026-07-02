## ADDED Requirements

### Requirement: Report-content FKs to Project use a consistent onDelete policy

Every report-content model that references `Project` MUST use the same FK
`onDelete` policy so a project's authored content cannot be partly protected and
partly cascade-deleted. `Decision` and `StageStatus` (currently `CASCADE` on
project delete) MUST be aligned with `Item`, `Risk`, and `ProjectStatus`
(`RESTRICT`), so report content is protected uniformly and a project carrying any
content cannot be hard-deleted. The `StageAssignment` join table MAY remain
`CASCADE`. This is enforced in `prisma/schema.prisma` and the single init
migration `prisma/migrations/20260530162224_init/migration.sql` (MVP reshape: edit
the schema and hand-edit the init migration, then `migrate reset` — not an
incremental alter-table migration). The schema MUST document that hard product
deletion is unsupported; products are retired via the soft-delete `archived`
flag.

#### Scenario: a project with only Decisions cannot cascade-delete content

- **GIVEN** a `Project` with `Decision` rows but no `Item` or `Risk` rows
- **WHEN** a hard delete of that project is attempted
- **THEN** the delete is restricted exactly as it would be for a project with
  `Item`/`Risk` rows, because `Decision` and `StageStatus` now use `RESTRICT`
- **AND** no authored `Decision` content is silently cascade-deleted

#### Scenario: the schema documents the no-hard-delete policy

- **GIVEN** a maintainer reads `prisma/schema.prisma` for the project-content FKs
- **WHEN** they look for the delete policy
- **THEN** the report-content FKs to `Project` are uniformly `RESTRICT` and a
  comment states hard product deletion is unsupported (archive instead)
- **AND** the init migration SQL matches the schema's `ON DELETE` clauses

### Requirement: GroupProduct block comment states the enforced single-group invariant

The `GroupProduct` block comment in `prisma/schema.prisma` MUST correctly state
the enforced single-group invariant rather than an unenforced multi-group claim.
The current preamble says "a product can belong to multiple groups
(cross-departmental)", which contradicts both the `@@unique([productId])`
constraint and the B1 inline comment that immediately follows it. The corrected
comment SHALL describe the actual invariant (exactly one group per product,
enforced by `@@unique([productId])`); it SHALL NOT claim cross-departmental or
multi-group membership as a current capability. No schema change is required —
this is a comment-only correction.

#### Scenario: a maintainer reads the GroupProduct block and understands the current invariant

- **GIVEN** a maintainer reads the `GroupProduct` model block in
  `prisma/schema.prisma`
- **WHEN** they look for the product-to-group ownership rule
- **THEN** the block comment states that a product currently belongs to exactly
  one reporting group, enforced by `@@unique([productId])`
- **AND** no phrase in the comment implies cross-departmental or multi-group
  membership as a current capability
