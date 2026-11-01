# schema-conventions Specification

## Purpose

Standardize shared Zod string formats and require index-backed foreign keys, cascades, and consistent sibling validation for the same persisted column.

## Requirements

### Requirement: Shared Schemas MUST Use Top-Level Zod String-Format Validators

Zod string-format validation in the shared schemas, the tRPC router, and the API env schema MUST use the top-level validators (`z.uuid()`, `z.email()`, `z.url()`, `z.iso.datetime()`) rather than the deprecated method-style forms (`z.string().uuid()`, `z.string().email()`, `z.string().url()`, `z.string().datetime()`). Each validator MUST retain the product's canonical accept/reject behavior.

#### Scenario: No deprecated method-style string-format validator remains

- **WHEN** the schema surface (`packages/shared/src/**/*.schema.ts`, `apps/api/src/infrastructure/trpc/trpc.router.ts`, `apps/api/src/infrastructure/config/env.schema.ts`) is scanned for `z.string().uuid(`, `z.string().email(`, `z.string().url(`, or `z.string().datetime(`
- **THEN** zero matches are found
- **AND** every string-format validation site uses the equivalent top-level validator

#### Scenario: Top-level validators preserve the canonical validation boundary

- **WHEN** the shared schemas validate identifiers, URLs, email addresses, and
  ISO datetimes
- **THEN** `z.uuid()` rejects non-RFC-4122 literals and
  `z.url().startsWith("postgresql://")` enforces the `DATABASE_URL` protocol
- **AND** the full test suite and `pnpm typecheck` prove the declared boundary

### Requirement: FK and Cascade Columns MUST Be Index-Backed

Every foreign-key column that participates in a `Prisma` relation MUST be
covered by a leftmost database index — either its own `@@index` or as the
leftmost column of a composite index — so a delete that cascades through it,
or a read that filters on it, does not force a sequential scan.

#### Scenario: CarryOver tables index their FK and cascade columns

- **WHEN** `prisma/schema.prisma` is inspected for `CarryOverRecord` and
  `CarryOverExecution`
- **THEN** `CarryOverRecord.executionId` (the `ON DELETE CASCADE` FK to
  `CarryOverExecution`) has its own `@@index`
- **AND** `CarryOverExecution.sourceReportId` and `.targetReportId` (the
  `RESTRICT` FKs to `Report`) each have their own `@@index`

#### Scenario: Review tables index their FK columns

- **WHEN** `prisma/schema.prisma` is inspected for `SectionReview` and
  `ReviewAcknowledgement`
- **THEN** `SectionReview.reviewerId` has its own `@@index`
- **AND** `ReviewAcknowledgement.groupId` has its own `@@index`, distinct
  from the existing `@@index([reportId, groupId])` in which `groupId` is not
  the leftmost column

### Requirement: Sibling Schemas Sharing A Column Use The Same Format Validator

Two shared Zod schemas declaring a field for the same underlying database column MUST use the same format-level validator for that field.

For example, `assembledReportSchema.publishedById` and
`reportPeriodSchema.publishedById` both represent `Report.publishedById`. A
schema MUST NOT validate a shared column with a looser type (e.g.
`z.string()`) than a sibling schema already uses for the identical column
(e.g. `z.uuid()`).

#### Scenario: `reportPeriodSchema.publishedById` matches `assembledReportSchema.publishedById`

- **WHEN** `reportPeriodSchema.parse` receives a `publishedById` that is not a
  valid UUID
- **THEN** parsing rejects it, the same way `assembledReportSchema.parse` already
  rejects a non-UUID `publishedById`

#### Scenario: Present review text has the same format at read and write boundaries

- **WHEN** the read model carries `RecordComment.text` or a present `SectionReview.comment` containing invisible-only text, a null byte, or more than the existing 2000-character review comment limit
- **THEN** the read boundary rejects that field with the same visible-text, null-byte and length guard as its owning write boundary
- **AND** normal read text remains byte-for-byte unchanged, including surrounding spaces and line breaks

#### Scenario: A legacy verdict has no reason

- **WHEN** a stored section verdict predates its optional reason and its read model omits the comment
- **THEN** the legacy read remains valid
- **AND** no new placeholder reason or cross-field verdict rule is introduced

### Requirement: Published projections are immutable and independently scopeable

`PublishedSectionScope` and `PublishedSearchDocument` MUST reference only their
owning `Report` through a cascading foreign key. Their frozen section, author,
group, record, and product identifiers MUST NOT reference mutable live tables,
because publication recovery may restore a snapshot without that live graph and
later ownership changes must not rewrite history.

`PublishedSectionScope` MUST have group/report and author/report indexes for
database-side admission. `PublishedSearchDocument.searchTsv` MUST be a stored
generated Russian `tsvector` with a GIN index. Both projections MUST use a
report-leftmost primary key so their Report foreign-key lifecycle is indexed.

#### Scenario: Frozen projection identifiers outlive the live graph

- **WHEN** the schema and canonical init migration are inspected
- **THEN** projection `reportId` columns cascade from `Report`
- **AND** no projection section, author, group, record, or product identifier
  has a foreign key to a mutable table
- **AND** the scope and full-text indexes match the declared query paths

### Requirement: Shared text boundaries reject selected invisible-only content

Shared `safeText` fields and report stage-name write fields MUST reject values composed only of ECMAScript whitespace and U+00AD, U+034F, U+180E, U+200B–U+200D, U+2060–U+2064 or U+FEFF. Existing null-byte rejection, length bounds, optionality and validation messages MUST remain unchanged. Read models MUST NOT apply this rule to stored values.

#### Scenario: Selected invisible characters cannot provide required text

- **WHEN** a shared text field receives any selected character alone, repeated or mixed with whitespace and the other selected characters
- **THEN** validation rejects it with the existing visible-content message

#### Scenario: Stage-name arrays use the same visible-content boundary

- **WHEN** a report write contains a stage name made only of the selected invisible characters and whitespace
- **THEN** validation rejects the stage name
- **AND** the existing stage-name array bounds and optional write-array policy remain unchanged
- **AND** a read model returns such a stored stage name exactly

### Requirement: Successful shared text validation preserves the input

Shared text and stage-name validation MUST retain the exact successful input string, including whitespace, multilingual characters, combining marks, emoji sequences and the selected invisible characters within text that otherwise passes validation. Validation MUST NOT trim, normalize or remove characters from successful input.

#### Scenario: Multilingual and combined text keeps its exact representation

- **WHEN** otherwise valid text contains Cyrillic, CJK, Arabic, decomposed accented letters, joiner-based emoji or selected invisible characters alongside visible text
- **THEN** parsing succeeds and returns the exact input string

#### Scenario: Existing length and null-byte boundaries remain effective

- **WHEN** text exceeds its caller's length bound or contains a null byte even alongside visible characters
- **THEN** validation rejects it under the existing length or null-byte rule

### Requirement: Reads of persisted report text do not re-apply author write rules

Report read models, publication snapshots first, MUST accept non-empty text
that the database already holds in item, risk and decision fields and their
stage names, review comments and verdict reasons, item-outcome and resolution
fields, and activity catalogue names, Jira accounts and weekly title overrides without re-applying the visible-content or length rules of the author
write schemas,
and MUST return it exactly as stored, without trimming, normalizing or
replacing it. Server copies of persisted rows (publication snapshots, carry-over,
section merge and the item an outcome command moves) MUST follow the same read
rule. Author write schemas MUST
keep rejecting such text in every field and stage name they validate.

#### Scenario: A stored row that the current write rule rejects is read

- **GIVEN** a stored report row whose text the current write rule rejects
- **WHEN** publication, a publication snapshot read or projection, the lead form, weekly report, carry-over, the activity catalogue or the PDF render reads it
- **THEN** the read succeeds and returns that text exactly
- **AND** the neighbouring rows of the section are returned unchanged

#### Scenario: The same text is submitted as a new write

- **WHEN** an author submits that text in any item, risk or decision field or stage name
- **THEN** the write is rejected under the existing rule
