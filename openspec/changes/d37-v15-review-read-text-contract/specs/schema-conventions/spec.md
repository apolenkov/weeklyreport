## MODIFIED Requirements

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
