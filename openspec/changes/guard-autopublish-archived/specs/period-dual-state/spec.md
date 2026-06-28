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
