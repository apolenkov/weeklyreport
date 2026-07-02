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

### Requirement: Per-Item Move Actions Preserve the Record's Stable Identity

The "mark complete" and "move to next week" actions SHALL preserve the record's stable
identity (the durable lineage key — see `design.md`), never cloning the record into a new
one.

"mark complete" sets `workflowStatus`/`completed`; "move to next week" flips `type` from
`current` to `next`. Preserving the stable identity keeps any C1 `RecordComment` anchor
attached and avoids a duplicate row the carry-over engine would later re-clone. Note: the
current `saveSection` recreates rows with fresh DB-minted ids, so "preserve identity"
depends on the stable-record-identity prerequisite (`design.md`) — it is NOT satisfied by
the literal `Item.id` surviving a save, which it does not.

#### Scenario: Move to next week preserves the record's identity and its comment anchor

- **GIVEN** a current-week item carrying a reviewer comment
- **WHEN** the lead moves it to next week
- **THEN** the record's stable identity is preserved as its `type` flips to `next`
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

### Requirement: A Published Record Is Resolved or Carried, Never Silently Removed

A record that has been published SHALL NOT be silently removed — a позиция (item, risk,
or decision; see CONTEXT.md) that has appeared in a published report can only be marked
done (resolved) or carried forward. A record that has only ever existed in a
never-published draft MAY be deleted, since it is an uncommitted mistake (a typo,
duplicate, or wrong-product entry).

This is the behavioral invariant; the mechanism is an open design problem, not a spec
clause, because the current write path cannot identify a published-origin row. The
section save path deletes-and-recreates a section's rows with DB-minted ids
(`report-sections.prisma-repository.ts`), so a record has no identity that survives a
save — there is nothing stable to match against the published snapshot. Enforcing this
invariant therefore depends on first introducing a stable record identity / lineage that
survives saves and carry-over clones; the same stable identity is a prerequisite for C1
per-record review-comment anchors (`review-acknowledgement`) and the "move keeps the same
id" rule below. See `design.md` for the prerequisite and the candidate mechanisms. A
delete-locked record MUST carry a visible marker explaining that it can be resolved or
carried, not deleted.

#### Scenario: A never-published draft record is deleted

- **GIVEN** a record created this period in a report that has never been published
- **WHEN** the lead removes it from the form and saves
- **THEN** the record is deleted (it was an uncommitted draft)

#### Scenario: A published record cannot be silently removed

- **GIVEN** a record that was part of a published report, now in a reopened editable period
- **WHEN** the lead attempts to remove it
- **THEN** the removal is refused and the record is preserved — it can be marked done or carried instead

#### Scenario: A record added after reopen is still deletable until re-published

- **GIVEN** a reopened period where the lead adds a new record that has not yet been re-published
- **WHEN** the lead removes that new record and saves
- **THEN** it is deleted (it never reached a published report)

#### Scenario: A delete-locked record explains why

- **GIVEN** a published-origin record shown in an editable period
- **WHEN** the lead views it
- **THEN** a visible marker indicates it can be resolved or carried, not deleted

### Requirement: Only Done Closes a Record; Open Work Is Not Lost at the Period Boundary

A record SHALL be treated as closed only when it is done; every other state
(`in-progress` / `blocked` / `planned-next` / `deferred` for an item, an unresolved
risk, a pending decision) keeps it open. Carryable open work — next-week items and
unresolved decisions — SHALL NOT be lost silently across the period boundary. Risks are
re-raised each period rather than carried (restating a risk is a conscious act), so they
sit outside this carry guarantee by design.

Carry-over stays head-manual (the one-click "Copy forward unfinished" above — no
automatic trigger on period creation); nothing moves automatically. To prevent silent
loss, the system MUST surface open work that has not been carried forward at the point
carry-over is available (the newly opened period), so the head can carry or consciously
close it. `deferred` is a conscious park — still open, still carried — and MAY capture a
short reason without that reason being required (entry stays fast — the product north
star).

Implementation reality (resolved in `design.md`): `carryOver.execute` carries only
next-week items and unresolved decisions — **risks do not carry**, and that is the
conscious choice here (a risk is re-raised, not carried), so this rule is narrowed to
items + decisions. The publish/period response has no channel for an "open work" signal,
so surfacing it is a separate read-only contract: the `carryOver.uncarried` query plus
the head-only "Copy forward unfinished" banner on the newly opened period.

#### Scenario: A done record is not flagged as open work

- **GIVEN** a record marked done
- **WHEN** the period closes
- **THEN** it is closed and not flagged as open work to carry

#### Scenario: An open record continues into the next period

- **GIVEN** an open (e.g. blocked) record at period close
- **WHEN** the head copies forward unfinished work into the newly opened period
- **THEN** the open record continues into the new period

#### Scenario: Uncarried open work is surfaced, not lost

- **GIVEN** open work from the prior period that has not been carried forward
- **WHEN** the newly opened period is shown to the head
- **THEN** the uncarried open work is surfaced so the head can carry or consciously close it
- **AND** nothing has moved automatically
