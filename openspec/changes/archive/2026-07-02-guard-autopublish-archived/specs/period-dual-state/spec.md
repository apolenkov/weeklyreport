## ADDED Requirements

### Requirement: Auto-Publisher Must Exclude Archived Periods From Candidate Query

The auto-publisher scheduler candidate query SHALL include `archived: false` so that
an admin-archived period is never selected for auto-publication, mirroring the
`archived: false` guard already present in the auto-archiver candidate query.

When a draft period is archived by an admin, `buildTransition("archive")` sets
`archived=true` and `periodState="archived"` but leaves `status="draft"` (the
`archive` transition does not update `status` for draft-state periods). Without this
guard the auto-publisher query `{status:"draft", deadline<cutoff}` matches the
archived period, `publishAuto` promotes it, and the resulting row has
`archived=true` with `periodState="published"` — a dual-state divergence this spec
forbids.

#### Scenario: Archived draft period is not selected by the auto-publisher

- **WHEN** a `Report` in `periodState="archived"` with `status="draft"` and
  `archived=true` has a `deadline` that falls before the current cutoff
  (`deadline + gracePeriodHours < now`)
- **THEN** `AutoPublisherScheduler.runOnce` does not include that report in its
  candidate set
- **AND** `publishAuto` is never called for that report
- **AND** the report remains in `periodState="archived"`, `status="draft"`,
  `archived=true` after the scheduler tick completes

#### Scenario: Auto-publisher still selects eligible non-archived drafts

- **WHEN** a `Report` in `periodState="open"` with `status="draft"` and
  `archived=false` has a `deadline` that falls before the current cutoff
- **THEN** `AutoPublisherScheduler.runOnce` includes that report in its candidate
  set and calls `publishAuto`
- **AND** the report transitions to `periodState="published"`, `status="published"`,
  `archived=false` after the tick

### Requirement: Auto-Publish Write Must Skip Periods Archived After Candidate Selection

The auto-publish write SHALL be conditioned on the target report still being
`status="draft"` and `archived=false` at write time, so a period archived between
candidate selection and the write is never promoted to `published`.

The candidate query filter alone cannot close this gap: `runOnce` reads candidate
ids, then writes per candidate. If an admin archives a draft after it was selected
but before its write, the `archive` transition leaves `status="draft"`, so neither
the candidate filter nor the `status==="published"` idempotency guard rejects it,
and the `autoPublish` transition does not clear `archived`. A compare-and-set on
the write (matching only `status="draft"` and `archived=false`) is the only point
that closes the race.

#### Scenario: Period archived after selection is not promoted to published

- **WHEN** `AutoPublisherScheduler.runOnce` has selected a draft `Report` as a
  candidate, and an admin archives that report (`archived=true`,
  `periodState="archived"`, `status` stays `"draft"`) before its auto-publish
  write executes
- **THEN** the auto-publish write matches no row because its compare-and-set
  guard requires `status="draft"` and `archived=false`
- **AND** the report is not transitioned to `periodState="published"` and remains
  `periodState="archived"`, `archived=true`

### Requirement: Auto-Publish Skip Must Suppress All Success Side-Effects

The auto-publish path SHALL propagate an explicit skipped outcome when the
compare-and-set write matches zero rows, so that none of the publish success
side-effects fire for the skipped period: the publish metrics
(`customreportReportsSubmittedTotal`, `customreportPeriodStateTransitionsTotal`),
the snapshot-ingestion enqueue, the `periodAutoPublish` audit event, the
missing-section count, and the report id in the scheduler's returned `periodIds`.

The compare-and-set alone is necessary but not sufficient: `AssembledReport`
exposes neither `archived` nor `periodState` (only `status`), so a re-read of the
still-archived draft after a zero-row write is indistinguishable by shape from a
freshly published report. If the skip is inferred from the returned report rather
than signaled explicitly, `PublicationService.publishAuto` would still increment
metrics and enqueue ingestion, and `AutoPublisherScheduler.runOnce` would still
count missing sections, emit the audit event, and add the id to `periodIds` — a
period the spec says was skipped would be reported as a successful auto-publish.
The skip must therefore be carried as a discriminated result from the repository
write through `publishAuto` to the scheduler, not derived from the returned report.

#### Scenario: Skipped auto-publish emits no success side-effects

- **WHEN** a draft `Report` selected as a candidate is archived before its
  auto-publish write, so the compare-and-set guard matches zero rows
- **THEN** `PublicationService.publishAuto` returns an explicit skipped outcome
  rather than an `AssembledReport` for that period
- **AND** no publish metric is incremented for that period
- **AND** no snapshot-ingestion job is enqueued for that period
- **AND** no `periodAutoPublish` audit event is emitted for that period
- **AND** no missing-section count is computed for that period
- **AND** the report id is not included in the scheduler's returned `periodIds`
