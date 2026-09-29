# carry-over-automation Specification

## Purpose

Carry eligible unfinished work into a new reporting period automatically through one race-safe write, without a manual carry-over banner.

## Requirements

### Requirement: Eligible unfinished prior-period work carries into a new period automatically

A lead's eligible unfinished prior-period work MUST be carried forward into a new period automatically when the lead's section for that period is established, with no manual head action. The carry-over consumer MUST choose at most one target Item occurrence per source `stableId` using this precedence:

1. Items with a resolution, or progress `done`, `paused`, or `postponed`, are not active rollover candidates.
2. An explicit next-period commitment (`type: "next"` not already carried, or a Current item with nonblank `nextStepText`) wins and becomes one Current `planned` target occurrence. For a Current item the target text is the next-step text; source result and history remain unchanged.
3. If no explicit commitment exists, a Current `in_progress` item continues once as a Current `in_progress` target occurrence. It is marked carried and unconfirmed, so rollover does not count it as a new weekly result.
4. Remaining unstarted `planned` work does not become an active target occurrence and MUST be projected in the target period's Paused work register as automatically paused with a system reason that it was not scheduled for the new week.

Every created Item MUST preserve `stableId`, parent, stages, tag, and priority; clear `nextStepText`; set `carriedOver: true`; and clear `pausedReason` because paused work is excluded. Items and unresolved decisions MUST have their Product or Activity attached to the target section. An unresolved decision (no `resolvedAt`) is cloned with `resolvedAt: null`.

The write-integrity guard MUST hold: carry-over writes only into an exact editable lifecycle tuple (`status: 'draft'`, `periodState: 'open'`, `periodStatus: 'open'`, or `status: 'published'`, `periodState: 'open'`, `periodStatus: 'reopened'`, with `archived: false`) and MUST NOT overwrite a submitted target section. Carry-over MUST be idempotent: re-establishing the same section MUST NOT duplicate rows, including duplicate eligible source occurrences with one `stableId`; the existing per-section lineage key and source/target execution dedupe remain authoritative. The automatic path records `CarryOverExecution` and `CarryOverRecord` rows.

For a published source, eligible content MUST come from the immutable published snapshot. Its frozen author ids MUST be intersected, in one current-user query, with users that still exist and are active before target sections are materialized. A missing or deactivated historical author MUST NOT create a target section or abort carry-over for remaining active authors.

#### Scenario: eligible unfinished work is carried without a head click

- **GIVEN** one lineage has an unfinished Current result and an explicit next-period commitment
- **WHEN** automatic carry-over establishes the new section
- **THEN** exactly one Current `planned` target occurrence contains the commitment text, keeps the lineage and priority, and has no next commitment
- **AND** the source result and published snapshot remain unchanged

#### Scenario: an explicit next step preserves the current result

- **GIVEN** a Current item has a weekly result and a distinct next commitment
- **WHEN** its eligible commitment carries into the next period
- **THEN** the new Current item contains the commitment text, is planned and unconfirmed, keeps the same stableId, and has no next commitment
- **AND** the source occurrence and published snapshot remain unchanged

#### Scenario: unfinished Current work continues without inventing a result

- **GIVEN** a Current `in_progress` item has no explicit next-period commitment
- **WHEN** automatic carry-over establishes the new section
- **THEN** exactly one Current `in_progress` target occurrence keeps its text and lineage and is marked carried and unconfirmed
- **AND** it does not count as a confirmed result for the target week until the lead updates it

#### Scenario: finished prior work is not carried

- **WHEN** a prior-period item is resolved or has progress `done`
- **THEN** no active target occurrence is created
- **AND** its source history and resolution audit remain unchanged

#### Scenario: postponed prior work is replanned manually

- **WHEN** a prior-period item has progress `postponed`
- **THEN** no active target occurrence is created
- **AND** the lead may replan it explicitly when relevant

#### Scenario: paused commitments remain suspended

- **GIVEN** a paused item retains its pause reason or next commitment
- **WHEN** automatic carry-over runs
- **THEN** no active target occurrence is created
- **AND** the source pause reason remains unchanged and resumption requires explicit action

#### Scenario: uncommitted planned work is paused automatically

- **GIVEN** a Current `planned` item has neither an explicit next-period commitment nor confirmed progress
- **WHEN** the new period's carry-over and open-work projection are established
- **THEN** no active target occurrence is created
- **AND** Paused work shows the lineage once as automatically paused because it was not scheduled for the new week, while source history remains unchanged

#### Scenario: duplicate source lineage yields one target occurrence

- **GIVEN** more than one eligible source representation shares a `stableId`
- **WHEN** carry-over runs or is replayed
- **THEN** the target section contains at most one occurrence for that `stableId`
- **AND** the explicit commitment takes precedence over fallback continuation

#### Scenario: no prior period carries nothing

- **WHEN** a lead's section is established on a period that has no prior period
- **THEN** nothing is carried and no error is raised

#### Scenario: published history targets only current active authors

- **GIVEN** a published snapshot contains active, deactivated, and since-removed historical authors
- **WHEN** automatic carry-over prepares the target period
- **THEN** it preserves the frozen source content but creates target sections only for current active authors
- **AND** missing or deactivated authors neither receive sections nor abort remaining carry-over

#### Scenario: a missing target parent receives no carried records

- **GIVEN** the source item's or unresolved decision's Product or Activity is absent from the target section
- **WHEN** automatic carry-over runs
- **THEN** it creates neither that item nor that decision

#### Scenario: re-establishing the section does not duplicate

- **WHEN** a lead's new-period section is established again after carry-over completed
- **THEN** no carried item or decision is duplicated

#### Scenario: a submitted target is never overwritten

- **WHEN** carry-over targets a submitted section or a published or archived period
- **THEN** the write-integrity guard rejects the write without partial changes

### Requirement: Automatic carry-over has no manual banner

The head report surface MUST NOT render a manual "Copy forward unfinished"
action because carry-over runs automatically. The head MUST NOT be shown a
manual action that duplicates the automatic behavior.

#### Scenario: a newly opened period shows no manual banner

- **WHEN** a head opens a newly opened period whose leads had unfinished
  prior-period work
- **THEN** no "Copy forward unfinished" banner is shown
- **AND** the carried work is already present in the leads' sections

### Requirement: Concurrent carry-over executions resolve to one race-safe write

The carry-over write transaction MUST resolve two racing executions for the
same `(sourceReportId, targetReportId)` pair to a single race-safe write:
when the losing transaction's existence check finds a `CarryOverExecution`
row the winner already committed, it MUST return the winner's already-recorded
execution and records instead of attempting to insert records against an
execution id that was never committed. The write transaction MUST also
re-validate the exact current editable lifecycle tuple (including canonical
`periodState: 'open'`, matching report `status`/`periodStatus`, and
`archived: false`) immediately before writing, not only from a
check performed before the transaction opened, so a period that transitions
to `published` or `archived` in the window between that earlier check and
the transaction's write is rejected rather than written into. The transaction
MUST lock, re-read, check, and write only target sections whose authors are
present in the planned carry-over entries. Unrelated target sections, including
submitted sections, MUST neither block the carry-over nor be mutated.

#### Scenario: the losing transaction returns the winner's rows

- **WHEN** two carry-over executions for the same source and target report
  race, and the second transaction's existence check finds a
  `CarryOverExecution` row the first transaction already committed
- **THEN** the second transaction does not attempt to insert
  `CarryOverRecord` rows against its own uncommitted execution id
- **AND** it returns the first transaction's already-recorded execution and
  records

#### Scenario: a period that stops being editable mid-race is rejected

- **WHEN** a carry-over transaction re-reads the target report's
  `periodStatus`/`archived` immediately before writing, and the period has
  become `published` or `archived` since the pre-transaction editability check
- **THEN** the transaction aborts without writing any execution, record, or
  carried item/decision row
- **AND** the caller receives a conflict error rather than a partially written
  state

#### Scenario: a scheduled or contradictory lifecycle is rejected

- **GIVEN** the target report looks editable in a pre-transaction read, then
  an archive/unarchive or scheduler interleaving leaves legacy fields
  editable-looking while `periodState` is `scheduled` or the lifecycle tuple
  contradicts itself
- **WHEN** the carry-over transaction locks and re-reads the target report
- **THEN** it rejects the carry-over as a conflict and writes no execution,
  record, item, or decision

#### Scenario: an unrelated submitted target does not block a planned carry-over

- **GIVEN** the target report has one planned author section and another
  submitted section for an author absent from the carry-over plan
- **WHEN** automatic or manual carry-over executes
- **THEN** the planned author's eligible rows are carried
- **AND** the unrelated submitted section remains unchanged and does not cause
  a conflict

#### Scenario: a submitted planned target still blocks

- **GIVEN** a target section belongs to an author present in the carry-over
  plan and is already `submitted`
- **WHEN** carry-over executes
- **THEN** the write is rejected with the canonical carry-over conflict
- **AND** no execution, record, or carried row is committed

### Requirement: Carry-over results and section versions reflect committed row writes

The carry-over write transaction MUST return a target section assembled from rows persisted for the winning execution. It MUST NOT merge caller-planned rows into a replay result after a committed execution is found. On a fresh execution, each matched target section MUST increment `ReportSection.version` exactly once when at least one item or decision is actually inserted. The transaction MUST use database-reported insert counts: an empty or fully deduplicated write MUST leave the version unchanged. The fresh primary result MUST be re-read after row writes and expose the persisted identities and resulting version. Carried decisions MUST deduplicate by durable `stableId`, retaining the current target occurrence and its current resolved state.

#### Scenario: Concurrent loser returns only the winner's persisted target

- **GIVEN** a winning execution and carried rows already exist
- **WHEN** a racing loser reaches the transaction with different clone ids or additional planned rows
- **THEN** it returns the winner's execution and records with the current persisted primary target section
- **AND** it performs no carried-row insert or section-version update

#### Scenario: Actual inserts advance one section revision

- **WHEN** a fresh carry-over inserts one or more item or decision rows into a matched target section
- **THEN** that section's version increments exactly once
- **AND** the returned primary target section contains the persisted rows and incremented version

#### Scenario: Empty or deduplicated carry does not create a revision

- **WHEN** a fresh carry-over has no rows to insert, or every attempted row is skipped as a duplicate
- **THEN** the matched section version remains unchanged

#### Scenario: Multi-section carry updates only changed sections

- **GIVEN** a fresh carry-over matches multiple target sections
- **WHEN** rows are actually inserted into only a subset of them
- **THEN** only that subset receives one version increment per section
- **AND** unrelated target sections remain unread and unmodified by the carry-over write

#### Scenario: A stale client cannot erase never-published carried rows

- **GIVEN** a client loaded target section version N before a fresh carry-over inserts never-published item or decision lineage
- **WHEN** the client attempts a complete section save with version N
- **THEN** the save is rejected by the existing section-version conflict
- **AND** the carried rows remain present
