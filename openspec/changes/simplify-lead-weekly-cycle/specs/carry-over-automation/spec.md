# Spec Delta

## MODIFIED Requirements

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
