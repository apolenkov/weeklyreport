## Purpose

Bound every section-save array payload so no client-supplied array field can grow unbounded.

## Requirements

### Requirement: Every section-save array carries the shared payload-size bound

Every array field in `draftSaveSchema` and `submitSectionSchema` MUST carry
`.max(MAX_RECORDS_PER_SECTION_SAVE)`
(`packages/shared/src/schemas/section.schema.ts`). This includes `projectStatuses` and
`stageStatuses` alongside the already-bounded `activityStatuses`, `items`,
`risks`, and `decisions`, so no section-save array can accept an unbounded
client-supplied payload.

#### Scenario: An oversized projectStatuses array is rejected

- **GIVEN** a draft-save or submit payload whose `projectStatuses` array
  exceeds `MAX_RECORDS_PER_SECTION_SAVE` entries
- **WHEN** the payload is parsed against `draftSaveSchema` or
  `submitSectionSchema`
- **THEN** validation fails with a max-length issue on `projectStatuses`,
  the same way it already fails for an oversized `items`/`risks`/
  `decisions`/`activityStatuses` array

#### Scenario: An oversized stageStatuses array is rejected

- **GIVEN** a draft-save or submit payload whose `stageStatuses` array
  exceeds `MAX_RECORDS_PER_SECTION_SAVE` entries
- **WHEN** the payload is parsed against `draftSaveSchema` or
  `submitSectionSchema`
- **THEN** validation fails with a max-length issue on `stageStatuses`

#### Scenario: A payload within the bound is unaffected

- **GIVEN** a draft-save or submit payload whose `projectStatuses` and
  `stageStatuses` arrays each stay within `MAX_RECORDS_PER_SECTION_SAVE`
  entries
- **WHEN** the payload is parsed
- **THEN** parsing succeeds exactly as it did before the bound was added
