## MODIFIED Requirements

### Requirement: Live manual publish path emits the publish counters

The system MUST increment `customreportReportsSubmittedTotal`
(`{ state: "published" }`) and `customreportPeriodStateTransitionsTotal`
(`{ from: <prior periodStatus>, to: "published" }`) only when the publish
compare-and-set transitioned exactly one row (count === 1), so a redundant
concurrent or repeat publish emits neither counter.

This governs both publish entry points: `PeriodService.publishPeriod`
(tRPC procedure `period.publish`,
`apps/api/src/modules/period/period.service.ts`) and
`PublicationService.publishReport` (tRPC procedure `review.publish`,
`apps/api/src/modules/publication/publication.service.ts`). The increments
MUST happen only after the repository write succeeds. The `from` label MUST
carry the actual prior `periodStatus` (`"open"` or `"reopened"`), not a
hardcoded value.

#### Scenario: Head publishes an open period

- **WHEN** a head triggers `period.publish` on a period with
  `periodStatus = "open"` and the compare-and-set transitions one row
- **THEN** both counters increment exactly once, with
  `from: "open", to: "published"` on the transition counter

#### Scenario: Head re-publishes a reopened period

- **WHEN** a head triggers `period.publish` on a period with
  `periodStatus = "reopened"` and the compare-and-set transitions one row
- **THEN** the transition counter increments with
  `from: "reopened", to: "published"`

#### Scenario: Repository write fails

- **WHEN** `repository.publishPeriod` throws
- **THEN** neither counter increments

#### Scenario: Redundant concurrent publish does not double-count

- **WHEN** two publishes race on the same period and one compare-and-set
  transitions one row while the other transitions zero rows
- **THEN** each counter increments exactly once (from the winning call only)
- **AND** the losing call increments neither counter
