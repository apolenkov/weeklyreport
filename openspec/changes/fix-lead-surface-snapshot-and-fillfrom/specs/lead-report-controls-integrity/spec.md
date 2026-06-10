## ADDED Requirements

### Requirement: View-state transitions never open dialogs

Leaving or entering a derived view state on the lead report page
(snapshot view via `viewedSnapshotVersion`, read-only flips, period
switches) MUST NOT open any dialog. Dialogs open only from a direct user
action in the current view. Imperative "open" signals (such as the
add-item counters in `lead-form.tsx`) MUST NOT be re-interpreted by
effects reacting to unrelated prop transitions, and MUST be reset when
the surface enters a read-only view.

#### Scenario: returning from a snapshot

- **WHEN** the lead clicks "Back to current" after previously using
  "+ Add Item" in the session
- **THEN** the snapshot banner closes and the editable form renders
- **AND** no Add Item dialog opens

### Requirement: Controls with no effect are not rendered

A control whose action can have no visible effect in the current data
state MUST NOT render (preferred) or MUST carry an explicit empty-state
explanation. Specifically, the archive toggle on the lead report page
renders only when archived periods exist for this lead; when rendered,
it shows how many ("N archived") and toggling visibly changes the period
list, with archived entries marked in the period combo.

#### Scenario: a lead with no archived periods

- **WHEN** the lead report page renders for a lead whose history has no
  archived periods
- **THEN** the archive toggle is absent

#### Scenario: a lead with archived periods toggles the archive

- **WHEN** the lead enables the archive toggle
- **THEN** archived periods appear in the period combo with an archived
  marker and the prev/next arrows navigate the expanded set

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

A dropdown/popover opened from a control inside a scroll- or
clip-container (such as the report toolbar's overflow wrapper) MUST
render fully visible — portaled to `document.body` with rect-based
positioning, as the established stage-chip/fill-confirm pattern does. A
popover MUST NOT be silently clipped by an ancestor.

#### Scenario: the Fill From dropdown opens inside the toolbar

- **WHEN** the lead opens the Fill From dropdown
- **THEN** the full panel is visible regardless of toolbar overflow
- **AND** it tracks the trigger position on scroll and resize

### Requirement: Incomplete own-stages show on the product card stripe

The lead edit-view product card keeps the lead-set traffic light as the
stripe COLOR, and renders the stripe DASHED while any stage owned by the
current lead has no status. Solid stripe = own stages filled; color =
the lead's health call. The dashed style MUST NOT alter the color and
MUST clear as soon as all own stages carry a status.

#### Scenario: an own stage is unfilled

- **WHEN** the product card renders with a green traffic light and one
  of the lead's own stages unset
- **THEN** the stripe is green and dashed
- **AND** filling the last own stage makes it solid without changing hue
