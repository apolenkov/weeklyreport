## MODIFIED Requirements

### Requirement: Eligible unfinished prior-period work carries into a new period automatically

A lead's eligible unfinished prior-period work MUST be carried forward into a new period automatically when the lead's section for that period is established, with no manual head action. The carry-over consumer MUST choose at most one target Item occurrence per source `stableId` using this precedence:

1. Items with a resolution, or progress `done`, `paused`, or `postponed`, are not active rollover candidates.
2. An explicit next-period commitment (`type: "next"` not already carried, or a Current item with nonblank `nextStepText`) wins and becomes one Current `planned` target occurrence. For a Current item the target text is the next-step text; source result and history remain unchanged.
3. If no explicit commitment exists, a Current `in_progress` item continues once as a Current `in_progress` target occurrence. It is marked carried and unconfirmed, so rollover does not count it as a new weekly result.
4. Remaining unstarted `planned` work does not become an active target occurrence and MUST be projected in the target period's Paused work register as automatically paused with a system reason that it was not scheduled for the new week.

Every created Item MUST preserve `stableId`, parent, stages, tag, and priority; clear `nextStepText`; set `carriedOver: true`; and clear `pausedReason` because paused work is excluded. Items and unresolved decisions MUST have their Product or Activity attached to the target section. A complete unresolved decision (no `resolvedAt`) is cloned with `resolvedAt: null`. An incomplete decision MUST NOT carry from a live source or a published snapshot; its author retains scoped recovery under `lead-retained-incomplete-records`.

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

### Requirement: Carried work stays unconfirmed until the lead acts on it

A Current occurrence with `carriedOver: true` awaits lead confirmation. It MUST remain visible and MUST block submit completion (`UNCONFIRMED_CARRIED_ITEM`); submit MUST NOT silently clear the marker. Explicit confirmation, editing, or an explicit terminal outcome MUST clear the marker through the authorized write path (an outcome clears it in the same transaction as the outcome and its audit event). Moving an occurrence to Next MUST clear the marker because that move is an explicit author plan, so the occurrence stays eligible for a later carry-over. Resolved decisions (`resolvedAt` set) and incomplete decisions MUST NOT carry.

#### Scenario: Unconfirmed carried work reaches submit

- **WHEN** an editable section contains a Current occurrence with `carriedOver: true`
- **THEN** submit is rejected with `UNCONFIRMED_CARRIED_ITEM` and guidance names the item to update
- **AND** submit does not clear the marker

#### Scenario: A lead confirms carried work

- **WHEN** the lead confirms a carried Current occurrence without editing it
- **THEN** only `carriedOver` is cleared and reload observes the confirmed state

#### Scenario: Carried work is cancelled before confirmation

- **WHEN** the lead records an explicit terminal outcome for a carried Current occurrence
- **THEN** the outcome transaction clears `carriedOver` together with the outcome and audit event
- **AND** submit is not blocked by a stale confirmation marker

#### Scenario: Work is moved through consecutive periods

- **WHEN** work carried into Current B is explicitly moved to Next B and period C opens
- **THEN** the move clears `carriedOver` in Next B and carry-over creates one unconfirmed Current occurrence in C
- **AND** text, status, priority, stable identity and history are preserved without duplicates

#### Scenario: resolved decisions do not carry

- **WHEN** the authoritative predecessor contains both resolved and unresolved decisions
- **THEN** only complete unresolved decisions are created in the editable target with `resolvedAt: null`

#### Scenario: incomplete decision is excluded from a live source

- **GIVEN** a live source contains an incomplete decision and a complete unresolved decision with an eligible target parent
- **WHEN** carry-over runs and is replayed
- **THEN** the complete decision carries once and the incomplete decision is not carried or reported as carried
- **AND** the author retains the incomplete source draft for authorized recovery

#### Scenario: published source excludes the retained draft

- **GIVEN** a published snapshot contains a complete unresolved decision and omits an incomplete decision retained privately by its author
- **WHEN** carry-over uses that snapshot
- **THEN** the complete decision remains eligible under existing rules and the retained draft is not carried
- **AND** omission disclosure does not claim that the omitted draft was carried or that no incomplete record was omitted
