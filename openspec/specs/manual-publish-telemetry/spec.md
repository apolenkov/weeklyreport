# Manual Publish Telemetry

## Purpose

Pin the durable telemetry contract that the live manual publish path emits
the submitted and state-transition counters, only after the repository
write succeeds, carrying the actual prior period status. Governs
publish-path observability.

## Requirements

### Requirement: Live manual publish path emits the publish counters

The system MUST increment `weeklyreportReportsSubmittedTotal`
(`{ state: "published" }`) and
`weeklyreportPeriodStateTransitionsTotal`
(`{ from: <prior periodStatus>, to: "published" }`) when
`PeriodService.publishPeriod` (consumer surface: tRPC procedure
`period.publish`, `apps/api/src/modules/period/application/period.service.ts`)
successfully publishes a period. The increments MUST happen only after
the repository write succeeds. The `from` label MUST carry the actual
prior `periodStatus` (`"open"` or `"reopened"`), not a hardcoded
value.

#### Scenario: Head publishes an open period

- **WHEN** a head triggers `period.publish` on a period with
  `periodStatus = "open"` and the repository write succeeds
- **THEN** both counters increment exactly once, with
  `from: "open", to: "published"` on the transition counter

#### Scenario: Head re-publishes a reopened period

- **WHEN** a head triggers `period.publish` on a period with
  `periodStatus = "reopened"` and the repository write succeeds
- **THEN** the transition counter increments with
  `from: "reopened", to: "published"`

#### Scenario: Repository write fails

- **WHEN** `repository.publishPeriod` throws
- **THEN** neither counter increments
