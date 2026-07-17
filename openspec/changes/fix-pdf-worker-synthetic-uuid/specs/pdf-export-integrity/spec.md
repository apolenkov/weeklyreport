## ADDED Requirements

### Requirement: Legacy PDF-export synthetic session satisfies userSessionSchema

The legacy (pre-`requestedBy`) PDF-export synthetic session MUST parse successfully against `userSessionSchema`, including a `userId` that is a valid UUID accepted by `z.uuid()`.

#### Scenario: Legacy synthetic session parses against userSessionSchema

- WHEN `buildLegacyPdfExportSession(reportId)` constructs the synthetic
  session for an inbound PDF-export cookie with no `requestedBy` claim
- THEN `userSessionSchema.safeParse(session).success` is `true`

#### Scenario: Synthetic user id is composed only of hex digits and dashes

- WHEN the synthetic PDF-export `userId` constant is inspected
- THEN every character outside the UUID's dash separators is a hex digit
  (`0-9`, `a-f`)
