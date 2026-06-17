## ADDED Requirements

### Requirement: Toolbar groups controls into a document-action row and a context-control row

The report toolbar MUST present its controls in two rows split by one axis: the top row holds controls that operate on the report document, the bottom row holds controls that only change which report is shown or how it is presented.

1. A control that creates, persists, commits, or exports report content (Save,
   Submit Section, Publish & Lock, Fill-From, PDF export, Move to archive) MUST
   appear in the top (Document action) row.
2. A control that changes which report is shown or how it is presented (period
   navigation, show-archived-periods filter, scope, view mode, expand-all,
   Agent review) MUST appear in the bottom (Context control) row, even when it
   persists a setting.
3. The head archive surfaces split by this axis: the show-archived-periods
   filter is a context control (bottom row), while the published-period "Move
   to archive" lifecycle button is a document action (top row).

#### Scenario: the lead toolbar renders both rows

- **WHEN** a lead opens their report for an editable period that has archived
  periods in its history
- **THEN** the top row shows Fill-From, Save, and the Submit Section commit
- **AND** the bottom row shows period navigation, the show-archived-periods
  filter, the Mine/Everyone scope, the Edit/Slides view mode, expand-all, and
  Agent review

#### Scenario: the lead has no archived periods

- **WHEN** a lead opens their report and their history has no archived periods
- **THEN** the bottom row omits the show-archived-periods filter (per
  `lead-report-controls-integrity`), and the remaining context controls keep
  their order

#### Scenario: the head toolbar renders both rows

- **WHEN** a head opens the review page for an open period
- **THEN** the top row shows the PDF export and the Publish & Lock commit
- **AND** the bottom row shows period navigation, the show-archived-periods
  filter, the Product/Leads scope, the Edit/Slides view mode, and Agent review

#### Scenario: a published head period offers move-to-archive as a document action

- **WHEN** a head views a published period that can be moved to the archive
- **THEN** the Move to archive control renders in the top Document action row,
  separate from the bottom-row show-archived-periods filter

### Requirement: The document-action row uses an accent hierarchy with a single forward primary

The top row MUST give at most one control the resting solid brand-accent fill — the forward commit when one is available — and MUST render the other document actions with a lesser accent (outline/ghost) so they do not compete with that primary.

1. When a forward commit is available (Submit Section for lead, Publish & Lock
   for head) it MUST be the only control with the resting solid brand-accent
   fill; in states with no forward commit (submitted lead, published head) the
   top row has no resting solid primary.
2. Reversal lifecycle actions (Request Reopen, Revoke, Reopen) MUST NOT use the
   resting solid brand-accent fill; they MUST take a neutral/outline treatment
   so the accent colour signals only a forward, safe-to-commit action.
3. The bottom (Context control) row MUST NOT give any control a brand-accent
   fill as a primary-action affordance; the segmented-control active-state
   selection indicator (scope and view-mode toggles, per
   `head-toolbar-semantics`) is exempt — it marks selection, not a commit.
4. A transient in-flight busy treatment is exempt from the single-primary rule:
   the Save control MAY show its accent busy state while saving (per
   `lead-report-controls-integrity`) without becoming a second resting primary.

#### Scenario: a published head period shows the reversal as non-accent

- **WHEN** a head views a published period whose primary action is now Reopen
- **THEN** the Reopen control is rendered with a neutral/outline treatment, not
  the resting solid brand-accent fill

#### Scenario: a submitted lead section shows the reversal as non-accent

- **WHEN** a lead has submitted their section and the commit becomes Request
  Reopen
- **THEN** the Request Reopen control is rendered with a neutral/outline
  treatment, not the resting solid brand-accent fill

#### Scenario: an open head period with no submitted content

- **WHEN** a head opens an open period that has zero submitted content
- **THEN** the top row still shows Publish & Lock in its slot, disabled, with
  its visible label, and the "No submitted content yet" hint renders outside
  both action rows

### Requirement: Inert coming-soon document actions reserve their top-row slot

A deferred document action that already exists as an inert Coming-soon control MUST occupy its top-row slot, so the row layout does not shift when the feature later activates.

1. The lead Version Coming-soon control and the lead PDF Coming-soon control
   MUST render in the top row as inert controls consistent in shape with their
   sibling document actions, wrapped in `ComingSoonBadge` per the
   deferred-feature pattern.
2. No new control MUST be introduced by this layout change; the Fill-From copy
   icon MUST NOT be surfaced as a separate "Copy" control.

#### Scenario: a lead draft reserves the inert document-action slots

- **WHEN** a lead opens their report for an editable period
- **THEN** the top row shows the inert Version Coming-soon and PDF Coming-soon
  controls in their slots, ordered before the real document actions, inert and
  not working exports

### Requirement: Toolbar row composition adapts to role and period state without losing positional stability

The toolbar MUST adjust which controls render by role and period state while keeping the surviving controls in stable positions.

1. For a lead read-only past period, the top row MUST hide the real mutating
   document actions (Save, Submit Section, Fill-From) while the inert
   Coming-soon controls remain visible per the deferred-feature pattern; the
   bottom (Context control) row MUST remain.
2. When a lead submits, Save MUST be hidden and the forward commit slot MUST
   switch to the reversal action without reordering the remaining controls.
3. Viewer and the lead preview render through the shared report page; neither
   top row MUST contain any commit control (Save/Submit/Publish). For the
   viewer specifically, the navigation it adds (e.g. Back to Archive) and the
   `AgentReviewComingSoon` placeholder MUST sit in the bottom Context control
   row, not the top row. The lead preview keeps its own outer header; its
   outer-header navigation and placeholder are outside the shared toolbar
   contract and are not relocated by this change.
4. Status indicators (submitted count, autosave time, publish precondition
   hint) MUST NOT render inside either action row.

#### Scenario: a lead views a locked past period

- **WHEN** a lead opens a read-only past period
- **THEN** the top row hides Save, Submit Section, and Fill-From
- **AND** the inert Coming-soon controls remain visible and the bottom row
  still allows navigating periods

#### Scenario: a viewer opens a published report

- **WHEN** a viewer opens a published report through the shared report page
- **THEN** the top row shows only the PDF export with no Save/Submit/Publish
- **AND** the submitted-count badge and the Agent review placeholder render
  outside the top action row

### Requirement: The two action rows are accessible as labeled groups with a stable focus order

The toolbar MUST expose the two rows as distinct accessible groups and MUST keep keyboard focus moving through the top row before the bottom row.

1. The Document action row and the Context control row MUST each carry an
   accessible group name (e.g. `aria-label="Document actions"` /
   `aria-label="Context controls"`) so the split is not conveyed by placement
   or colour alone.
2. Every icon-only control MUST keep its existing `aria-label`/tooltip contract
   after the move (no regression against `report-toolbar-parity`).
3. Keyboard focus order MUST traverse the top row, then the bottom row.

#### Scenario: a keyboard user tabs through the toolbar

- **WHEN** a keyboard user tabs into the report toolbar
- **THEN** focus visits the Document action controls before the Context control
  controls
- **AND** each row exposes an accessible group name

### Requirement: All toolbar controls stay reachable at narrow viewport widths

Each row MUST keep every control reachable at narrow widths; controls MUST NOT be clipped out of reach.

1. When a row's controls exceed the available width, the row MUST allow
   horizontal scrolling or wrapping so no control becomes unreachable; it MUST
   NOT clip controls with no way to reach them.

#### Scenario: the bottom row overflows on a narrow screen

- **WHEN** the Context control row has more controls than fit the viewport width
- **THEN** every control remains reachable via horizontal scroll or wrapping,
  none is clipped out of reach
