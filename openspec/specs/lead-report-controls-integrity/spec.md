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
Add item, Add risk, and Add decision alike.

#### Scenario: returning from a snapshot

- **WHEN** the lead clicks "Back to current" after previously using
  "+ Add item" in the session
- **THEN** the snapshot banner closes and the editable form renders
- **AND** no Add item dialog opens

#### Scenario: returning from a snapshot after "+ Add risk" or "+ Add decision"

- **WHEN** the lead clicks "+ Add risk" (or "+ Add decision"), cancels
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
notes the excluded weeks.

#### Scenario: a draft period exists

- **WHEN** the history list contains submitted periods and one draft
- **THEN** Total risks, Avg items/week, and traffic-light totals reflect
  only the submitted periods
- **AND** the card notes that the excluded week is not included

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

Lead report asynchronous controls MUST visibly show work in progress and block repeat activation. A rendered save/retry control MUST retain its DOM identity while saving, show a full-opacity accent spinner, set `aria-busy=true`, and be disabled. On settlement it MUST restore non-busy styling and expose the existing success or retry state.

#### Scenario: a save mutation is in flight

- **WHEN** the lead triggers an available save/retry action and the mutation has not settled
- **THEN** the same button shows a white spinner on accent fill, has `aria-busy=true`, and is disabled
- **AND** another activation cannot trigger a duplicate save

#### Scenario: the mutation settles successfully

- **WHEN** the in-flight save succeeds
- **THEN** the button returns to non-busy styling with `aria-busy=false`
- **AND** the existing Saved check flash is retained before the retry-only control disappears

#### Scenario: the mutation settles with an error

- **WHEN** the in-flight save fails
- **THEN** accent busy styling ends, `aria-busy=false`, and Retry is enabled with an alert icon
- **AND** a focused Retry remains the same focused DOM node

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

### Requirement: Lead completion MUST expose Retry instead of a permanent Save action

Editable Lead Report completion actions MUST rely on autosave and omit a permanent manual Save control. Autosave error MUST expose `Retry saving draft` using the canonical force-save handler. An active Retry MUST remain mounted during in-flight work and the Saved flash, then disappear after success. This MUST NOT remove Save buttons inside explicit inline/editor submissions.

#### Scenario: Autosave needs no recovery

- **WHEN** completion actions render outside an active recovery attempt without an autosave error
- **THEN** no manual Save or Retry button is shown
- **AND** autosave status remains available without requiring another click

#### Scenario: Retry traverses busy and Saved states

- **WHEN** the lead activates Retry after autosave failure
- **THEN** the canonical handler runs once and the same button remains mounted through in-flight pending/saving/error observations and the Saved flash
- **AND** it stays disabled with `aria-busy=true` throughout in-flight work
- **AND** after success its `aria-busy` becomes false and the Saved flash lasts 1500 ms before removal

### Requirement: Retry removal MUST preserve completion focus without stealing it

When a successful completion Retry disappears, focus MUST move only if that button still owns focus: to enabled Submit, otherwise to the completion group. If the user has moved focus elsewhere, removal MUST leave it there. A repeated failure MUST retain the same enabled Retry and its focus rather than dropping focus to the document.

#### Scenario: Focused Retry finishes successfully

- **WHEN** the Saved flash ends while Retry still owns focus
- **THEN** enabled Submit receives focus, or the completion group receives focus if Submit is blocked
- **AND** removal does not leave focus on the document body

#### Scenario: The lead leaves Retry before its flash ends

- **WHEN** the lead focuses another control before successful Retry disappears
- **THEN** removal preserves that control's focus and does not focus Submit

#### Scenario: Retry fails again

- **WHEN** the active attempt ends with another save error
- **THEN** the same Retry remains enabled, non-busy, and focused if it owned focus

### Requirement: Saving feedback respects reduced motion

The Lead report saving control MUST keep its progress indicator stationary when the browser requests reduced motion. Its visible saving label, busy state and repeat-activation guard MUST remain available independently of animation. With no reduced-motion preference, the existing animated progress indication MUST remain available.

#### Scenario: Saving with reduced motion

- **GIVEN** the Lead report has an in-flight canonical save
- **WHEN** the browser requests reduced motion
- **THEN** the saving indicator does not rotate over successive rendered frames
- **AND** the saving control remains visibly busy and disabled
- **AND** changing the motion preference does not trigger another save

#### Scenario: Saving with no motion preference

- **GIVEN** the same in-flight save with no reduced-motion preference
- **WHEN** the saving control is observed over successive rendered frames
- **THEN** its animated progress indication remains available
- **AND** it retains the same busy and repeat-activation protections

### Requirement: A failed autosave MUST NOT present as Saved in any commit

When autosave fails, the Retry control MUST present `Retry saving draft` in the
commit that carries the error. The Saved flash MUST NOT outrank an error state,
including in the commit that follows a successful save inside the flash window.

#### Scenario: Autosave fails while the Saved flash is showing

- **GIVEN** the Save control shows the Saved flash after a successful save
- **WHEN** autosave leaves the saved state for the error state
- **THEN** the commit that carries the error presents `Retry saving draft`
- **AND** no commit presents `Draft saved` for the error state
