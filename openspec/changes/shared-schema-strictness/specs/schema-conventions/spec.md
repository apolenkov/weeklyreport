## ADDED Requirements

### Requirement: Sibling Schemas Sharing A Column Use The Same Format Validator

Two shared Zod schemas declaring a field for the same underlying database column MUST use the same format-level validator for that field.

For example, `reportSchema.publishedById` and
`reportPeriodSchema.publishedById` both represent `Report.publishedById`. A
schema MUST NOT validate a shared column with a looser type (e.g.
`z.string()`) than a sibling schema already uses for the identical column
(e.g. `z.uuid()`).

#### Scenario: `reportPeriodSchema.publishedById` matches `reportSchema.publishedById`

- **WHEN** `reportPeriodSchema.parse` receives a `publishedById` that is not a
  valid UUID
- **THEN** parsing rejects it, the same way `reportSchema.parse` already
  rejects a non-UUID `publishedById`
