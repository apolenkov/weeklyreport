## Purpose

The 2026-06-10 lead-surface walk-through
(`fix-lead-surface-snapshot-and-fillfrom`, 7-agent audit
`memos/lead-surface-audit-verdict.md`) confirmed seven bugs and three
design gaps on the lead report and history pages: leaving snapshot view
reopened the Add Item modal, the Show-archived toggle was a visible
no-op, the History Summary mixed draft and submitted populations, and
the Fill From dropdown was clipped by the toolbar overflow. This
capability fixes the durable control-integrity properties of the lead
report/history surface so these classes of defect do not regrow. It
governs control behavior on that surface, not a code module.

## Requirements

### Requirement: View-state transitions never open dialogs

A view-state transition MUST NOT open any dialog on the lead report
page — this covers snapshot view via `viewedSnapshotVersion`, read-only
flips, and period switches. Dialogs open only from a direct user action
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

A control MUST NOT render when its action can have no visible effect
in the current data state — or it MUST carry an explicit empty-state
explanation (not rendering is preferred). Specifically, the archive toggle on the lead report page
renders only when archived periods exist for this lead; when rendered,
it shows how many ("N archived") and toggling visibly changes the period
list, with archived entries marked in the period combo and in the Fill From list.

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

A dropdown/popover MUST render fully visible when opened from a control
inside a scroll- or clip-container (such as the report toolbar's
overflow wrapper) — portaled to `document.body` with rect-based
positioning, as the established stage-chip/fill-confirm pattern does. A
popover MUST NOT be silently clipped by an ancestor.

#### Scenario: the Fill From dropdown opens inside the toolbar

- **WHEN** the lead opens the Fill From dropdown
- **THEN** the full panel is visible regardless of toolbar overflow
- **AND** it tracks the trigger position on scroll and resize

### Requirement: Incomplete own-stages show on the product card stripe

The lead edit-view product card MUST keep the lead-set traffic light as
the stripe COLOR, and MUST render the stripe DASHED while any stage
owned by the current lead has no status. Solid stripe = own stages filled; color =
the lead's health call. The dashed style MUST NOT alter the color and
MUST clear as soon as all own stages carry a status.

#### Scenario: an own stage is unfilled

- **WHEN** the product card renders with a green traffic light and one
  of the lead's own stages unset
- **THEN** the stripe is green and dashed
- **AND** filling the last own stage makes it solid without changing hue

### Requirement: Snapshot view renders empty when the payload is absent

The snapshot view MUST render empty item, risk, and decision lists when
the snapshot payload is null in snapshot mode (still loading, or no data
for the selected version) — it never falls back to the current draft.
The extracted snapshot mappers
(`apps/web/src/lib/mappers/lead-snapshot.ts`) encode this rule: with a
null payload all four snapshot projections return `[]`. The snapshot
view never misrepresents historical state.

#### Scenario: snapshot payload not yet loaded

- **WHEN** the lead opens a snapshot version and the version payload has
  not loaded yet (or holds no data for that version)
- **THEN** the items, risks, and decisions sections render empty
- **AND** the current draft content is never shown inside the snapshot
  view
