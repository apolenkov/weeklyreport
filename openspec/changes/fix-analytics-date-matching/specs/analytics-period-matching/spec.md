## ADDED Requirements

### Requirement: Period Comparison Matches Each Side by a UTC Day Range

`periodComparison` (`apps/api/src/modules/analytics/analytics.prisma-repository.ts`) MUST resolve each compared period by a half-open UTC day range `[startOfDayUTC(date), startOfDayUTC(date) + 1 day)` over `Report.periodEnd`, NOT by exact equality against `new Date(dateOnly)`. The input is a date-only `YYYY-MM-DD` label while `Report.periodEnd` is a full `DateTime` carrying a time component, so an exact-equality match resolves to midnight UTC and never matches a stored end-of-day timestamp.

The day range MUST be computed in UTC so the match is timezone-stable and aligns with the existing `isoDateOnly(d)` label, which formats `periodEnd` via `toISOString().slice(0, 10)`. The `published` floor MUST be preserved on both sides.

#### Scenario: Stored periodEnd with a time component still matches its date label

- **GIVEN** a published `Report` whose `periodEnd` is `2026-06-26T17:00:00.000Z`
- **AND** a `periodComparison` request whose `periodA` is `2026-06-26`
- **WHEN** the repository resolves side A
- **THEN** that report is matched into side A
- **AND** its project statuses and risk counts appear in the comparison rows

#### Scenario: Exact-midnight equality regression is closed

- **GIVEN** two published reports with non-midnight `periodEnd` timestamps on `periodA` and `periodB`
- **WHEN** `periodComparison` runs
- **THEN** both sides resolve non-empty
- **AND** the result is NOT an empty `rows` array

### Requirement: Range Queries Include the Full Final Day of `periodTo`

`trafficLightHistory` and `leadVelocity` (`apps/api/src/modules/analytics/analytics.prisma-repository.ts`) MUST include reports whose `periodEnd` falls anywhere within the `periodTo` calendar day, NOT only those whose `periodEnd` is exactly midnight UTC. The current upper bound `periodEnd: { lte: new Date(periodTo) }` resolves `periodTo` to midnight UTC and silently excludes a report whose `periodEnd` carries a later time component on that same day.

The upper bound MUST become a half-open exclusive bound at the start of the day AFTER `periodTo` (`periodEnd: { lt: startOfDayUTC(periodTo) + 1 day }`), computed in UTC so the final day is fully inclusive and the match stays timezone-stable and consistent with the `isoDateOnly` label. The `published` floor and the `leadId`/`projectId` filters MUST be preserved.

#### Scenario: trafficLightHistory includes a final-day report with a time component

- **GIVEN** a published `Report` whose `periodEnd` is `2026-06-26T17:00:00.000Z`
- **AND** a `trafficLightHistory` request whose `periodTo` is `2026-06-26`
- **WHEN** the repository resolves the range
- **THEN** that report contributes a column label for `2026-06-26`
- **AND** it is NOT excluded because its time component is after midnight UTC

#### Scenario: leadVelocity includes a final-day report with a time component

- **GIVEN** a published `Report` whose `periodEnd` is `2026-06-26T17:00:00.000Z`
- **AND** a `leadVelocity` request whose `periodTo` is `2026-06-26`
- **WHEN** the repository resolves the range
- **THEN** that report contributes a velocity entry for its period label

### Requirement: Date-Only Analytics Inputs Are Validated as Real Calendar Dates

The shared `isoDateOnly` schema (`packages/shared/src/schemas/analytics.ts`), used by every analytics input field (`periodFrom`, `periodTo`, `periodA`, `periodB`) and every date-label output field, MUST reject a string that is correctly shaped but is not a real calendar date. A format-only regex (`/^\d{4}-\d{2}-\d{2}$/`) accepts impossible dates such as `2026-13-45` and `2026-02-30`, which then produce a wrong or `Invalid Date` query boundary instead of a clean edge rejection.

The schema MUST keep the format regex as the first gate and add a refine that parses the value as a UTC date and confirms it round-trips back to the same `YYYY-MM-DD`. Validation MUST be timezone-stable (parsed and re-formatted in UTC) so a valid date is never rejected near a day boundary.

#### Scenario: Well-formed real date is accepted

- **GIVEN** the input string `2026-06-26`
- **WHEN** `isoDateOnly` parses it
- **THEN** parsing succeeds and the value is unchanged

#### Scenario: Impossible calendar date is rejected

- **GIVEN** the input string `2026-02-30`
- **WHEN** `isoDateOnly` parses it
- **THEN** parsing fails with a validation error
- **AND** no `new Date(...)` boundary derived from it reaches the query

#### Scenario: Out-of-range month or day is rejected

- **GIVEN** the input string `2026-13-45`
- **WHEN** `isoDateOnly` parses it
- **THEN** parsing fails with a validation error

### Requirement: Analytics Aggregates Across Every Report Mapped to a Date Label

`trafficLightHistory` and `periodComparison` (`apps/api/src/modules/analytics/analytics.prisma-repository.ts`) MUST aggregate across ALL reports whose `periodEnd` falls under a given date label, NOT only the first matching report. `trafficLightHistory` currently fills each cell with `reports.find((rr) => isoDateOnly(rr.periodEnd) === label)` and `periodComparison` resolves each side with `findFirst`; when more than one `Report` row maps to a label (a republished period, or two periods sharing a `periodEnd` date but differing by `periodStart`), the other reports' project statuses and risks are silently dropped.

When two or more reports contribute a status for the same project under the same label, the method MUST apply a single documented deterministic tie-break (for example, the report with the latest `periodEnd` timestamp, then latest `createdAt`) so the result is stable across query runs. Risk counts under a label MUST sum across the contributing reports rather than reflecting only one. The `projectId`/`leadId` filters and the `published` floor MUST be preserved.

#### Scenario: Two reports share a date label

- **GIVEN** two published reports A and B whose `periodEnd` formats to the same `YYYY-MM-DD` label
- **AND** report A carries a status for project P1 and report B carries a status for project P2
- **WHEN** `trafficLightHistory` builds the column for that label
- **THEN** both P1 and P2 have a non-null cell for that label
- **AND** neither project's status is dropped because it lived on the second report

#### Scenario: Deterministic tie-break for a duplicated project status

- **GIVEN** two reports under the same label that each carry a status for the same project P1
- **WHEN** the column for that label is built twice
- **THEN** both runs return the same cell value for P1 under the documented tie-break

#### Scenario: Risk counts sum across reports under a comparison side

- **GIVEN** two reports mapped to `periodA`, each carrying one risk for project P1
- **WHEN** `periodComparison` resolves side A
- **THEN** `riskCountA` for P1 is the sum across both reports, not the count from one
