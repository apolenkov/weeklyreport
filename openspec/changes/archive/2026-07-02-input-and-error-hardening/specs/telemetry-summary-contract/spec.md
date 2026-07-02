## ADDED Requirements

### Requirement: Telemetry summary sparkline is bounded to 4 points

The `sparkline` array in `telemetrySummarySchema` MUST be length ≤ 4. This
tightens the previous `.max(8)` bound to match the only producer, which calls
`onTimeRatioPerPeriod(4)` and therefore never emits more than 4 points. The
schema doc comment already states "length ≤ 4"; the runtime bound MUST agree
so the shared contract is exact rather than permissive. Each entry remains a
number in `[0, 1]` (an on-time ratio), ordered oldest→newest, with missing
periods filtered out.

Consumer surface: `packages/shared/src/schemas/telemetry.ts`
(`telemetrySummarySchema.sparkline`); producer
`apps/api/src/modules/telemetry/telemetry.service.ts`
(`TelemetryService.getSummary` → `onTimeRatioPerPeriod(4)`); rendered on
`/dashboard` for head/admin/viewer roles.

#### Scenario: A 4-point sparkline is accepted

- **GIVEN** a `telemetrySummarySchema` payload whose `sparkline` has 4 entries,
  each in `[0, 1]`
- **WHEN** the schema parses the payload
- **THEN** parsing succeeds and the sparkline is returned unchanged

#### Scenario: A sparkline longer than 4 points is rejected

- **GIVEN** a `telemetrySummarySchema` payload whose `sparkline` has 5 or more
  entries
- **WHEN** the schema parses the payload
- **THEN** Zod parsing fails (the `.max(4)` bound is exceeded)

#### Scenario: An empty sparkline is accepted

- **GIVEN** a fresh deployment with no published periods, so `sparkline` is `[]`
- **WHEN** the schema parses the payload
- **THEN** parsing succeeds and `sparkline` is the empty array
