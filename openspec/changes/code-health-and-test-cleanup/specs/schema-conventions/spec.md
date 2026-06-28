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
