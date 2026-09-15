## MODIFIED Requirements

### Requirement: Lead Report MUST be a unified authoring surface

`/lead/report/:reportId` MUST support reading, item creation and editing, explicit movement of one editable occurrence between Current and Next, Product stages, Activity status, risks, decisions and completion guidance in one Report. Each work item MUST have one primary Edit path through the existing editor coordinator. The basic Status Overview editor MUST NOT expose a separate next-step form or priority controls; hidden priority data MUST be preserved. Slides MUST remain a separate presentation. All writes MUST use the existing editor coordinator and canonical lineage commands.

#### Scenario: A lead creates a short update

- **WHEN** the lead activates Add item for a reporting unit
- **THEN** one editor opens with the unit selected and an explicit Current week or Next week choice
- **AND** required stage and progress fields follow the existing Product or Activity rules
- **AND** priority is absent from the basic form

#### Scenario: A lead edits or replans work

- **WHEN** the lead activates Edit, Move to this week, or Move to next week
- **THEN** the same canonical editor opens with the applicable item and target week
- **AND** the action does not create a second draft store or mutation path

#### Scenario: An unfinished edit encounters a failure

- **WHEN** saving fails, a version conflicts, or the lead opens details
- **THEN** the pending text and selected week remain available with a relevant recovery action
- **AND** the document does not describe unsaved input as Saved

#### Scenario: An author visits another period before finishing input

- **WHEN** the lead navigates away and returns to the same editable section
- **THEN** the unfinished input and selected active week remain available for that section and author
- **AND** cancelling restores focus and unload warns without claiming durable storage

### Requirement: Report rows MUST communicate lineage and preserve readable geometry

The Report projector MUST join records using stable identity, never text similarity. A section MUST contain at most one editable occurrence per lineage across Current and Next. Each logical work item MUST render once in a stable row/card with an immutable prior-plan snapshot, one active-week placement, visible status and one action rail. Independent records MUST NOT be visually paired merely because they occupy the same list index. Shared temporal tracks and actions MUST remain aligned without clipping at 200% zoom.

#### Scenario: Work is planned for another week

- **WHEN** an author moves the same logical work between Current and Next
- **THEN** the immutable prior-plan snapshot and active occurrence remain available on one lineage
- **AND** retrying the operation does not create a duplicate occurrence
- **AND** the author does not need to understand a separate next-step object

#### Scenario: A task continues next week

- **WHEN** the author moves eligible work from Current to Next
- **THEN** the editable occurrence changes bucket without changing identity, text or status
- **AND** its immutable prior-plan snapshot and history remain readable

#### Scenario: Unrelated Current and Next items are present

- **WHEN** a unit contains independent items in both weeks
- **THEN** each item has its own row/card and action rail
- **AND** unequal list lengths do not create false visual relationships or floating controls

#### Scenario: Previous source is unavailable

- **WHEN** the predecessor cannot be loaded authoritatively
- **THEN** Report explains its unavailability
- **AND** it does not label current items Not in prior plan or claim a coverage percentage

### Requirement: Prior-plan outcomes MUST be atomic and authorized

For an unlinked prior plan, the canonical item editor MUST seed from the authoritative predecessor and create exactly one Current or Next occurrence with the same stable identity and explicit week selection. It MUST preserve the predecessor status and fields unless the lead edits them, preserve the immutable predecessor, reject unauthorized or stale requests, and avoid duplicate occurrences on retries. Resolve plan MUST remain the audited command for Done and Won't do only; it MUST NOT expose Continue, Plan next, or a separate next-step input. An existing editable occurrence MUST move between Current and Next as the same record without changing its text, status, lineage, priority or comments unless the lead explicitly edits those fields. Completed work MUST NOT move into a future active bucket; historical replanning remains explicit.

#### Scenario: A lead resolves an unlinked prior plan as done

- **WHEN** the lead selects Resolve plan then Done for a valid predecessor
- **THEN** one Current/done occurrence is created with the same lineage
- **AND** the predecessor snapshot remains unchanged

#### Scenario: A lead plans an unlinked prior task for next week

- **WHEN** the lead selects Plan this work for an unlinked prior task and chooses Next week
- **THEN** the canonical editor opens for a Next/planned occurrence on the same lineage
- **AND** Postponed remains a selectable progress status excluded from automatic carry-over

#### Scenario: A lead moves current work to next week

- **WHEN** the lead selects Move to next week for eligible Current work
- **THEN** the canonical editor opens with Next week selected and the same item values
- **AND** saving changes only the active-week placement unless the lead explicitly edits another field
- **AND** no duplicate occurrence or separate commitment is created

#### Scenario: A carried plan awaits confirmation

- **WHEN** a prior Next plan is projected into a newly opened period
- **THEN** the lead must confirm it before it is treated as a Current update
- **AND** period opening alone does not assert progress or change its status

#### Scenario: A lead adds a next step to a current result

- **WHEN** legacy UI or data supplies a next-step commitment for eligible Current work
- **THEN** the compatibility path preserves the Current result and commitment without a duplicate
- **AND** the new Status Overview authoring path presents an explicit Move to next week workflow instead of a separate next-step form

### Requirement: Tracked work MUST remain accountable across period boundaries

The system MUST distinguish immutable prior-plan snapshots from the one editable occurrence of a logical work item. That occurrence MUST live in Current or Next, never both, and moving it MUST preserve stable identity, text, workflow status, priority rank, comments and history. A system-carried Current occurrence MUST remain visibly unconfirmed until the lead confirms or edits it; period opening MUST NOT assert progress. Open work MUST remain discoverable across period gaps. Paused work MUST retain its reason and require explicit resumption. Postponed work MUST remain available for explicit replanning without automatic activation. Terminal work MUST remain historical without recurring in active carry-over.

#### Scenario: Work moves between active weeks

- **WHEN** the author moves eligible work from Current to Next or Next to Current
- **THEN** the same editable occurrence changes bucket without cloning or changing its saved fields
- **AND** the immutable prior-plan snapshot remains unchanged

#### Scenario: A carried item awaits confirmation

- **WHEN** automatic carry-over creates the new period's Current occurrence
- **THEN** the item remains marked as system-carried until the lead explicitly confirms or edits it
- **AND** submit treats the unconfirmed occurrence as incomplete rather than silently confirming it

#### Scenario: A paused task crosses a reporting gap

- **WHEN** a paused task has no new update for two periods
- **THEN** it remains discoverable with its last confirmed state and pause reason
- **AND** opening a later report does not silently resume it or invent a weekly result

#### Scenario: A deferred task is replanned

- **WHEN** the author replans a deferred task after multiple periods
- **THEN** the editable occurrence retains its original identity and history
- **AND** the published predecessor is unchanged and retries cannot create duplicates

#### Scenario: A historical source is no longer the latest occurrence

- **WHEN** a newer submitted or published occurrence exists before the target period
- **THEN** a command using the older occurrence is rejected without changing the target or audit
- **AND** a malformed published snapshot prevents fallback to mutable live rows

#### Scenario: An author explicitly reopens terminal historical work

- **WHEN** the author chooses the latest completed or cancelled historical occurrence
- **THEN** explicit replanning may create a new editable occurrence with the same lineage
- **AND** terminal work remains separate from the active open-work register and automatic carry-over

#### Scenario: A prior promise is reviewed but not completed

- **WHEN** the author postpones or continues a prior promise
- **THEN** it may count as reviewed but MUST NOT count as completed
- **AND** promises with no confirmed outcome remain visibly unresolved

#### Scenario: Partial delivery and next step coexist

- **WHEN** legacy data contains a Current result and a distinct future commitment on one lineage
- **THEN** both texts remain readable before conversion
- **AND** Move to next week preselects the future text, archives the Current result in readable history, clears the legacy commitment after save, and leaves exactly one editable Next occurrence
- **AND** Cancel or failed save preserves both original texts
