## Purpose

Define the durable control-integrity properties of the lead report and history
surfaces. This capability governs control behavior on those surfaces, not a
code module.

## Requirements

### Requirement: View-state transitions never open dialogs

A view-state transition MUST NOT open any dialog on the lead report page —
this covers a server section `version` refresh, read-only flips, and period
switches. Dialogs open only from a direct user action
in the current view. Imperative "open" signals (the four add-signal
counters in `lead-form.tsx`: current-week, next-week, risks, decisions)
MUST NOT be re-interpreted by effects reacting to unrelated prop
transitions, and all four MUST be reset when the surface enters a
read-only view. This applies to every section dialog on the surface:
Add Item, Add Risk, and Add Decision alike.

#### Scenario: returning from a snapshot

- **WHEN** the lead clicks "Back to current" after previously using
  "+ Add Item" in the session
- **THEN** the snapshot banner closes and the editable form renders
- **AND** no Add Item dialog opens

#### Scenario: returning from a snapshot after "+ Add Risk" or "+ Add Decision"

- **WHEN** the lead clicks "+ Add Risk" (or "+ Add Decision"), cancels
  the dialog, views a snapshot version, and clicks "Back to current"
- **THEN** the editable form renders
- **AND** no Risk or Decision create dialog opens

### Requirement: Controls with no effect are not rendered

A control MUST NOT render when its action can have no visible effect in
the current data state (preferred), or it MUST carry an explicit
empty-state explanation. Specifically, the archive toggle on the lead
report page renders only when archived periods exist for this lead;
when rendered, it shows how many ("N archived") and toggling visibly
changes the period list. Archived entries MUST be marked with a
neutral "Archived" badge — a muted pill, never a status hue and never
raw bracketed text — in both the period selector and the Fill From
list; the period selector is a keyboard-accessible custom listbox so
the badge can render inside options.

#### Scenario: a lead with no archived periods

- **WHEN** the lead report page renders for a lead whose history has
  no archived periods
- **THEN** the archive toggle is absent

#### Scenario: a lead with archived periods toggles the archive

- **WHEN** the lead enables the archive toggle
- **THEN** archived periods appear in the period selector carrying the
  neutral "Archived" badge and the prev/next arrows navigate the
  expanded set

#### Scenario: archived rows in the Fill From list

- **WHEN** the Fill From list contains archived periods
- **THEN** those rows carry the same neutral "Archived" badge instead
  of any text prefix

### Requirement: Summary aggregates use a single population

Each metric block on the lead history surface MUST compute all its
aggregates over one declared population. The "My History Summary" card
computes risk totals, item averages, and traffic-light totals over
SUBMITTED entries only — consistent with its Submissions ratio — and
notes excluded drafts.

#### Scenario: a draft period exists

- **WHEN** the history list contains submitted periods and one draft
- **THEN** Total risks, Avg items/week, and traffic-light totals reflect
  only the submitted periods
- **AND** the card notes that the draft is not included

### Requirement: Popovers escape clipping containers

A dropdown/popover MUST render fully visible when opened from a control
inside a scroll- or clip-container (such as the report toolbar's
overflow wrapper) — portaled to `document.body` with rect-based
positioning, as the established stage-chip/fill-confirm pattern does. A
popover MUST NOT be silently clipped by an ancestor.

#### Scenario: the Fill From dropdown opens inside the toolbar

- **WHEN** the lead opens the Fill From dropdown
- **THEN** the full panel is visible regardless of toolbar overflow
- **AND** it tracks the trigger position on scroll and resize

### Requirement: The product card separates live health from own-input completeness

The lead edit-view product card MUST derive its left-edge health live from
the highest covering risk or blocker severity contributed by any stage owner
(blocked > at-risk > on-track). The left edge MUST remain a solid health
signal and MUST NOT read the persisted traffic-light value, so the health
edge and visible risk-derived chips cannot contradict. The current lead's
own-input completeness MUST remain a separate neutral affordance: an exact
N/M counter with a dashed ring while incomplete, with the ring removed or
non-dashed when complete. Head dashboards and slides keep consuming the
persisted traffic light unchanged.

#### Scenario: a fresh week with no own statuses set

- **WHEN** the product card renders and the persisted traffic light is
  amber, no covering risk or blocker makes the product amber or blocked,
  and every own stage is unset
- **THEN** the left health edge follows the live risk-derived health and
  remains solid rather than inheriting amber from persisted data
- **AND** the separate completeness affordance shows the incomplete N/M
  state with its dashed ring

#### Scenario: a covering blocker changes product health

- **WHEN** a covering blocker is present for any stage of the product,
  including a stage owned by another lead
- **THEN** the left health edge immediately renders the blocked severity
- **AND** the current lead's own-input completeness remains independent and
  changes only when that lead's own stage input changes

### Requirement: In-flight control actions show a visible busy state

A lead report toolbar control MUST visibly indicate work in progress and MUST block repeat activation while its asynchronous action is running.
Specifically, the icon-only save-now button
(`apps/web/src/shared/ui/report-shell/save-now-button.tsx`): while
the `saveDraft` mutation is in flight (`AutosaveSnapshot.isInFlight`),
the button MUST replace the idle glyph with a spinner, MUST set
`aria-busy="true"`, MUST be disabled, and MUST render the primary
accent fill (`var(--color-starbucks-accent)`) with a white icon at
full opacity — never the dimmed disabled washout. The busy treatment
MUST revert to the idle styling when the mutation settles, on success
and on error alike.

#### Scenario: a save mutation is in flight

- **WHEN** the lead triggers a manual save and the `saveDraft`
  mutation has not yet settled
- **THEN** the button shows a white spinner on the accent green fill,
  carries `aria-busy="true"`, and is disabled
- **AND** clicking it again does not trigger another save

#### Scenario: the mutation settles successfully

- **WHEN** the in-flight save completes
- **THEN** the accent fill reverts to the idle styling and
  `aria-busy` is `"false"`
- **AND** the existing success check flash behaves unchanged

#### Scenario: the mutation settles with an error

- **WHEN** the in-flight save fails
- **THEN** the accent fill reverts, `aria-busy` is `"false"`, and the
  alert icon renders with the button enabled for retry

### Requirement: Snapshot view renders empty when the payload is absent

The snapshot view MUST render empty item, risk, and decision lists when
the snapshot payload is null in snapshot mode (still loading, or no data
for the selected version) — it never falls back to the current draft.
The snapshot-mode projection seam MUST encode this rule: with a
null payload all four snapshot projections return `[]`. The snapshot
view never misrepresents historical state.

#### Scenario: snapshot payload not yet loaded

- **WHEN** the lead opens a snapshot version and the version payload has
  not loaded yet (or holds no data for that version)
- **THEN** the items, risks, and decisions sections render empty
- **AND** the current draft content is never shown inside the snapshot
  view
