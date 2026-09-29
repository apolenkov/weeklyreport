# unified-report-authoring Specification

## Purpose

Provide one coherent lead report authoring surface with shared inline editing,
lineage, recovery, and progress semantics across report sections.

## Requirements

### Requirement: Lead Report MUST be a unified authoring surface

`/lead/report/:reportId` MUST support reading, inline item creation and editing,
Product stages, Activity status, risks, decisions and completion guidance in
one Report. The visible Edit mode MUST be removed only once this parity is
verified. Slides MUST remain a separate presentation. All writes MUST use the
existing editor coordinator, including new explicit lineage commands.

#### Scenario: A lead creates a short update

- **WHEN** the lead activates Add current update or Plan next week
- **THEN** the inline text input opens in one action with the unit and week already selected
- **AND** a sole owned Product stage is preselected, multiple stages remain selectable, and Activity has no stage input
- **AND** progress is visible and editable without opening a modal

#### Scenario: An unfinished edit encounters a failure

- **WHEN** saving fails, a version conflicts, or the lead opens details
- **THEN** the pending text is preserved and the relevant recovery action is visible
- **AND** the document does not describe unsaved input as Saved

#### Scenario: An author visits another period before finishing input

- **WHEN** the lead navigates within the application and returns to the same editable section
- **THEN** the unfinished inline or outcome input remains available for that section and author
- **AND** cancelling restores keyboard focus to its action or the overview heading
- **AND** document unload warns about unsaved input without claiming durable browser storage

### Requirement: Report rows MUST communicate lineage and preserve readable geometry

The Report projector MUST join records using stable identity, never text
similarity. A section MUST contain at most one editable occurrence per lineage.
Stages and progress MUST be visible. Shared row tracks and action footers MUST
remain aligned without clipping text, metadata or controls at 200% zoom.

#### Scenario: A task continues next week

- **WHEN** the author reports a current result and plans a next step
- **THEN** both descriptions remain available on the same lineage row
- **AND** planning the next step neither overwrites the current result nor creates a duplicate task

#### Scenario: Previous source is unavailable

- **WHEN** the predecessor cannot be loaded authoritatively
- **THEN** Report explains its unavailability
- **AND** it does not label current items Not in prior plan or claim a coverage percentage

### Requirement: Outcome lock waits MUST be bounded by PostgreSQL

Resolve and Restore MUST set a transaction-local PostgreSQL lock timeout of
15 seconds before acquiring outcome locks. A lock timeout MUST roll back the
operation without partial item, version or receipt changes. This bounds each
lock wait; it does not establish a whole-request latency guarantee.

#### Scenario: An outcome waits on a locked report

- **WHEN** another transaction holds a required report lock beyond the lock timeout
- **THEN** the outcome fails while that transaction still holds the lock
- **AND** its stored state remains unchanged
- **AND** the same command can succeed after the blocker releases the lock

### Requirement: Prior-plan outcomes MUST be atomic and authorized

For an unlinked prior plan, Resolve plan MUST resolve predecessor identity server-side and atomically
materialize Done as Current/done, Continue as Current/in_progress, Plan next
as Next/planned, or an audited Won't do resolution. It MUST preserve the
immutable predecessor, reject unauthorized/stale requests and avoid duplicate
occurrences on retries. New commands MUST coordinate with existing draft saves.
For an existing Current occurrence, Plan next MUST instead persist an explicit
next-period commitment independently of its current result and progress on the
same occurrence. It MUST NOT move that result to Next or infer a commitment from
the result text. Completed work MUST NOT acquire a next commitment through this
command; historical replanning remains a separate explicit flow.

#### Scenario: A lead resolves an unlinked prior plan as done

- **WHEN** the lead selects Resolve plan then Done for a valid predecessor
- **THEN** one Current/done occurrence is created with the same lineage
- **AND** the predecessor snapshot remains unchanged

#### Scenario: A lead plans an unlinked prior task for next week

- **WHEN** the lead selects Plan next week for an unlinked prior task
- **THEN** the occurrence is Next/planned and eligible for normal carry-over
- **AND** Postpone remains a distinct Next/postponed action excluded from automatic carry-over

#### Scenario: A lead adds a next step to a current result

- **WHEN** the lead selects Plan next week for an existing unfinished Current occurrence and supplies the next-step text
- **THEN** the current result and progress remain unchanged and the next commitment is stored separately on the same occurrence
- **AND** no duplicate occurrence is created and the predecessor remains immutable

### Requirement: Prior outcome resolution MUST coordinate source locks before writes

Resolve MUST acquire the selected source and freshness locks before mutating the
target section, item or receipt. Concurrent submitted-source revocation MUST
produce a serial result without a circular wait caused by the outcome's version
write. Early stale-version rejection, transactional compare-and-set and replay
semantics MUST remain intact.

#### Scenario: Submitted-source revocation overlaps prior-plan resolution

- **WHEN** Resolve and revocation concurrently use the same submitted source
- **THEN** if Resolve acquires the source first, it materializes the outcome before revocation
- **AND** if revocation acquires the source first, Resolve rejects the unavailable source without target changes
- **AND** neither ordering produces a database deadlock between those operations

### Requirement: Won't do MUST preserve auditable intent

Product and Activity Items in editable Current or Next MUST support Won't do
with a nonblank reason and server-derived actor/time. Resolution MUST remain
separate from workflowStatus, survive save/recreate and snapshots, be excluded
from active work and carry-over, and remain visible in report/history/export.
Restore plan MUST recover the previous valid state only in an editable section
and retain an audit of reversal. Risks and Decisions MUST keep their own models.

#### Scenario: An author corrects a draft resolution

- **WHEN** the author selects Restore plan while the section is editable
- **THEN** the previous type/progress/reason is restored and the reversal is audited
- **AND** an expired toast does not make correction unavailable

#### Scenario: Work resumes after publication

- **WHEN** a previously published cancelled item is planned again in a later editable section
- **THEN** a new occurrence preserves lineage without modifying the published snapshot

### Requirement: Tracked work MUST remain accountable across period boundaries

The system MUST distinguish stable task identity, author-confirmed weekly results, and next-period commitments. At a period boundary an explicit next commitment MUST take precedence and appear once as Current planned work; otherwise unfinished Current in-progress work MUST remain discoverable once as a carried, unconfirmed Current continuation. Rollover MUST NOT present either case as a newly confirmed weekly result. Unstarted planned work without an explicit commitment MUST become a derived automatically paused entry in Paused work, outside the active columns. Existing paused work MUST retain its reason and require explicit resumption. Postponed, resolved, and terminal work MUST remain historical and outside automatic active carry-over. The prior occurrence and published snapshot MUST remain immutable.

#### Scenario: Partial delivery and next step coexist

- **WHEN** the author reports API delivery and plans testing for the same task
- **THEN** both the current result and next commitment are persisted independently
- **AND** rollover creates one planned target occurrence for testing, not two tasks or a duplicate result

#### Scenario: unfinished work has no new commitment

- **WHEN** the latest eligible occurrence is Current and in progress with no next commitment
- **THEN** rollover creates one carried in-progress continuation marked unconfirmed
- **AND** reporting for the new week does not count its copied text as an author-confirmed result

#### Scenario: unstarted work was not scheduled for the new week

- **WHEN** the latest eligible occurrence is Current and planned with no next commitment
- **THEN** the active Current column contains no new occurrence for it
- **AND** Paused work shows it once with the automatic reason that it was not scheduled for the new week

#### Scenario: A paused task crosses a reporting gap

- **WHEN** a paused task has no new update for two periods
- **THEN** it remains discoverable with its last confirmed state and pause reason
- **AND** opening a later report does not resume it or create an active occurrence

#### Scenario: A deferred task is replanned

- **WHEN** the author replans a deferred task after multiple periods
- **THEN** the new commitment retains the original task identity and history
- **AND** the published predecessor is unchanged and retries cannot create duplicates

#### Scenario: A historical source is no longer the latest occurrence

- **WHEN** a newer submitted or published occurrence exists before the target period
- **THEN** a command using the older occurrence is rejected without changing target or audit
- **AND** a malformed published snapshot prevents fallback to mutable live rows

#### Scenario: An author explicitly reopens terminal historical work

- **WHEN** the author chooses the latest completed or cancelled historical occurrence
- **THEN** explicit replanning may create a new occurrence with the same lineage
- **AND** terminal work remains separate from automatic carry-over

#### Scenario: A prior promise is reviewed but not completed

- **WHEN** the author postpones or continues a prior promise
- **THEN** it may count as reviewed but MUST NOT count as completed
- **AND** promises with no confirmed outcome remain visibly unresolved
