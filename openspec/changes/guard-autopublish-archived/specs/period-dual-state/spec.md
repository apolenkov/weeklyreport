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
