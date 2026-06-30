## ADDED Requirements

### Requirement: A Single Quick-Add Affordance Opens the Existing Dialog per Type

The lead form SHALL provide one quick-add affordance that selects a record type
(current-item / next-item / decision / risk / blocker) and opens the corresponding
EXISTING dialog with the minimum required fields, introducing no new editor and no new
record model.

"blocker" maps to a current `Item` with `workflowStatus=blocked`. Quick-add MUST keep
every existing write invariant — ≥1 owned stage on item/risk (per the C6 ownership
guard), stage + product on decision, and the unchanged submit gate — so "fast" never
means stage-less. The stage MUST be pre-selected when the lead owns exactly one on the
chosen product, else require one tap.

#### Scenario: Quick-add a blocker routes to a blocked item

- **GIVEN** a lead using quick-add
- **WHEN** the lead picks "blocker" for a product and saves
- **THEN** a current `Item` with `workflowStatus=blocked` is created via the existing item dialog
- **AND** no new record type is introduced

#### Scenario: Quick-add still requires a stage

- **GIVEN** a lead quick-adding a risk on a product where they own two stages
- **WHEN** the dialog opens
- **THEN** the lead must select a stage (no stage-less save), pre-selected only when exactly one is owned

### Requirement: The Unified By-State View Is an Opt-In Presentation Projection

The unified by-state view SHALL be an opt-in projection that groups the lead's items
into derived buckets without introducing any new persisted enum state, and the classic
two-section format SHALL remain the default.

The buckets (done / in-progress / blocked / planned-next / deferred) are computed from
`Item.type`, `workflowStatus`, `completed`, and `carriedOver` by a total, deterministic
function with explicit precedence (the fields are not orthogonal). There is no `failed`
bucket. `carriedOver` means "arrived from the previous period as current" and MUST NOT
be presented as "deferred". Physical `Item.type` (`current|next`) storage MUST be
preserved so the submit gate and the carry-over filter are unaffected. The view is gated
behind an org `AppSettings` flag set by the head for the department; with the flag off,
the classic two-section format renders.

#### Scenario: Default is the classic two-section format

- **GIVEN** the org `AppSettings` unified-view flag is off
- **WHEN** a lead opens their report
- **THEN** the classic Current-week / Next-week two-section format renders

#### Scenario: Opt-in unified view groups by derived bucket

- **GIVEN** the head has enabled the unified-view flag
- **WHEN** a lead opens their report
- **THEN** items render in one section grouped by the derived buckets
- **AND** no new enum value is written; physical `Item.type` is unchanged

#### Scenario: A carried item is not labelled deferred

- **GIVEN** an item with `carriedOver=true, type=current`
- **WHEN** the unified view buckets it
- **THEN** it is bucketed by its current workflow state, not as "deferred"

### Requirement: Per-Item Move Actions Mutate the Row In Place

The "mark complete" and "move to next week" actions SHALL mutate the existing item row
in place (same `Item.id`), never cloning it.

"mark complete" sets `workflowStatus`/`completed`; "move to next week" flips `type` from
`current` to `next`. Keeping the same `Item.id` preserves any C1 `RecordComment` anchors
by the edit-persist rule and avoids a duplicate row the carry-over engine would later
re-clone.

#### Scenario: Move to next week keeps the same item id

- **GIVEN** a current-week item carrying a reviewer comment
- **WHEN** the lead moves it to next week
- **THEN** the same `Item.id` flips `type` to `next`
- **AND** the reviewer comment is still anchored to it

### Requirement: Carry-Over Is Surfaced as a Head One-Click on Period Open

The existing head-manual `carryOver.execute` SHALL be surfaced as a one-click "Copy
forward unfinished" affordance when a new period opens, without coupling carry-over to
period creation and without this change altering the carry-over write path.

Carry-over is NOT automatic on period creation. This change depends on
`fix-carryover-persistence` hardening the write path; the copy-forward affordance MUST
NOT ship against the un-hardened path.

#### Scenario: Head copies forward unfinished work on period open

- **GIVEN** a head on a newly opened period with unfinished next-week items from the prior period
- **WHEN** the head clicks "Copy forward unfinished"
- **THEN** the existing `carryOver.execute` runs (no automatic trigger on period creation)
