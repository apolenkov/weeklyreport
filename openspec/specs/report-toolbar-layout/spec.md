# report-toolbar-layout Specification

## Purpose

Organize report header actions and context controls into stable, accessible groups that remain reachable across roles, view modes, period states, and narrow widths.

## Requirements

### Requirement: Head desktop headers keep document actions right-aligned

The Head form and slides headers MUST use a stable desktop title/action layout in which the title, status, and department context occupy the flexible left column while `Document actions` occupy the intrinsic right column. A long context label MUST NOT wrap the complete action group onto a new left-aligned row.

#### Scenario: Publish is unavailable for the active report

- **WHEN** the Head report has no submitted section and the department context is long
- **THEN** Acknowledge and the disabled `Nothing to publish` control remain right-aligned in the document-action column
- **AND** the disabled primary continues to expose its publish precondition

### Requirement: Head slide context controls occupy one compact toolbar row

At desktop width, period/archive controls MUST remain the left cluster and Agent review, scope, view, and density controls MUST remain the right cluster of the single report context toolbar. The working Document/Presentation density choice MUST NOT render as a separate deck row.

#### Scenario: Head opens Leads presentation

- **WHEN** the Head selects Leads scope in slides mode
- **THEN** period/archive and all view controls remain in the single context toolbar
- **AND** the next deck row is the lead carousel rather than a second mode-control row

### Requirement: Lead slide context controls expose the working density choice

At desktop width, the Lead report context toolbar MUST keep period/archive controls in the left cluster and Agent review, record visibility, labeled view mode, density, and fullscreen controls in the trailing cluster. The working Document/Presentation density choice MUST NOT render as a second hosted deck row, while standalone Lead decks MAY keep their local density toolbar.

#### Scenario: Lead opens hosted slides

- **WHEN** a Lead opens slides mode for the addressed report
- **THEN** the context toolbar exposes visible desktop `Edit` and `Slides` labels
- **AND** exactly one Document/Presentation density control is present across the report context and deck
- **AND** the existing fullscreen control remains available

### Requirement: The document-action row uses an accent hierarchy with a single forward primary

The header line's document-action group MUST give at most one control the
resting solid brand-accent fill — the forward commit when one is available — and
MUST render the other document actions with a lesser accent (outline/ghost) so
they do not compete with that primary. The bordered context-control bar MUST NOT
give any control a solid brand-accent fill; its segmented toggles use a neutral
active-selection fill, not the brand accent (see `head-toolbar-semantics`).

1. When a forward commit is available (Submit Section for lead, Publish & Lock
   for head) it MUST be the only control with the resting solid brand-accent
   fill; in states with no forward commit (submitted lead, published head) the
   header action group has no resting solid primary.
2. Reversal lifecycle actions (Request Reopen, Revoke, Reopen) MUST NOT use the
   resting solid brand-accent fill; they MUST take a neutral/outline treatment
   so the accent colour signals only a forward, safe-to-commit action.
3. The bordered context-control bar MUST NOT give any control a brand-accent
   fill, including the segmented-toggle active state: the toggle active segment
   uses the neutral foreground fill, so brand green is reserved for header-line
   actions only.
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

#### Scenario: the context bar uses no brand-accent fill

- **WHEN** the bordered context-control bar renders its segmented toggles
- **THEN** the active segment uses the neutral foreground fill, not the brand
  accent
- **AND** no control in the bar carries a solid brand-accent fill

### Requirement: Inert coming-soon document actions reserve their top-row slot

An inert Coming-soon document action MUST occupy its slot in the header line's
document-action group, so the layout does not shift when the deferred feature
later activates.

1. The lead Version Coming-soon control and the lead PDF Coming-soon control
   MUST render in the header action group as inert controls consistent in shape
   with their sibling document actions, wrapped in `ComingSoonBadge` per the
   deferred-feature pattern.
2. No new control MUST be introduced by this layout change; the Fill-From copy
   icon MUST NOT be surfaced as a separate "Copy" control.

#### Scenario: a lead draft reserves the inert document-action slots

- **WHEN** a lead opens their report for an editable period
- **THEN** the header action group shows the inert Version Coming-soon and PDF
  Coming-soon controls in their slots, ordered before the real document actions,
  inert and not working exports

### Requirement: Toolbar row composition adapts to role and period state without losing positional stability

The report surface MUST adjust which controls render by role and period state
while keeping the surviving controls in stable positions across the header action
group and the context bar.

1. For a lead read-only past period, the header action group MUST hide the real
   mutating document actions (Save, Submit Section, Fill-From) while the inert
   Coming-soon controls remain visible per the deferred-feature pattern; the
   context-control bar MUST remain.
2. When a lead submits, Save MUST be hidden and the forward commit slot MUST
   switch to the reversal action without reordering the remaining controls.
3. Viewer and the lead preview render through the shared report page; neither
   header action group MUST contain any commit control (Save/Submit/Publish). For
   the viewer specifically, the navigation it adds (e.g. Back to Archive) and the
   `AgentReviewComingSoon` placeholder MUST sit in the context-control bar, not
   the header action group. The lead preview keeps its own outer header; its
   outer-header navigation and placeholder are outside the shared toolbar contract
   and are not relocated by this change.
4. Status indicators (submitted count, autosave time, publish precondition hint,
   department label) MUST render on the header line as labels, NOT inside the
   document-action group or the context bar.

#### Scenario: a lead views a locked past period

- **WHEN** a lead opens a read-only past period
- **THEN** the header action group hides Save, Submit Section, and Fill-From
- **AND** the inert Coming-soon controls remain visible and the context bar still
  allows navigating periods

#### Scenario: a viewer opens a published report

- **WHEN** a viewer opens a published report through the shared report page
- **THEN** the header action group shows only the PDF export with no
  Save/Submit/Publish
- **AND** the submitted-count badge and the Agent review placeholder render
  outside the header action group

### Requirement: All toolbar controls stay reachable at narrow viewport widths

The header action group and the context-control bar MUST each keep every control
reachable at narrow widths; controls MUST NOT be clipped out of reach.

1. When the header action group's controls exceed the available width, the header
   line MUST wrap so no document action becomes unreachable.
2. When the context bar's controls exceed the available width, the bar MUST allow
   horizontal scrolling or wrapping so no context control becomes unreachable; it
   MUST NOT clip controls with no way to reach them.

#### Scenario: the context bar overflows on a narrow screen

- **WHEN** the context-control bar has more controls than fit the viewport width
- **THEN** every control remains reachable via horizontal scroll or wrapping,
  none is clipped out of reach

#### Scenario: the header action group overflows on a narrow screen

- **WHEN** the header line's action group has more controls than fit beside the
  title block
- **THEN** the header line wraps so every document action remains reachable

### Requirement: Document actions render on the page header line; the toolbar holds the context-control bar

The report surface MUST split its controls by one axis — operates on the report document vs changes which / how it is shown — placing the document actions on the page header line and the context controls in the single bordered toolbar bar below it.

1. A control that creates, persists, commits, or exports report content (Save,
   Submit Section, Publish & Lock, Fill-From, PDF export, Move to archive) MUST
   render on the page header line, in a right-aligned action group beside the
   title/status block — NOT inside the bordered toolbar.
2. A control that changes which report is shown or how it is presented (period
   navigation, show-archived-periods filter, scope, view mode, the mode-adaptive
   collapse-all (edit) / fullscreen (slides) control, Agent review) MUST render in
   the bordered toolbar bar, even when it persists a setting.
3. The bordered toolbar MUST render exactly one row (the context-control bar);
   it MUST NOT contain a document-action row.
4. The head archive surfaces split by this axis: the show-archived-periods
   filter is a context control (toolbar bar), while the published-period "Move
   to archive" lifecycle button is a document action (header line).

#### Scenario: the lead surface splits across the header and the toolbar

- **WHEN** a lead opens their report for an editable period that has archived
  periods in its history
- **THEN** the header line's action group shows Fill-From, Save, and the Submit
  Section commit
- **AND** the bordered toolbar shows one row: period navigation, the
  show-archived-periods filter, the Mine/Everyone scope, the Edit/Slides view
  mode, the collapse-all control, and Agent review

#### Scenario: the lead slides surface shows fullscreen in the collapse-all slot

- **WHEN** a lead opens their report in slides mode
- **THEN** the bordered toolbar's trailing utility slot shows the fullscreen
  toggle (not a collapse-all/expand control), in the same position the collapse
  control occupies in edit mode

#### Scenario: the head surface splits across the header and the toolbar

- **WHEN** a head opens the review page for an open period
- **THEN** the header line's action group shows the PDF export and the Publish &
  Lock commit
- **AND** the bordered toolbar shows one row: period navigation, the
  show-archived-periods filter, the Product/Leads scope, the Edit/Slides view
  mode, and Agent review

#### Scenario: a published head period offers move-to-archive as a document action

- **WHEN** a head views a published period that can be moved to the archive
- **THEN** the Move to archive control renders in the header line's action group,
  separate from the toolbar's show-archived-periods filter

### Requirement: The header action group and the context bar are accessible as labeled groups with a stable focus order

The report surface MUST expose the header action group and the context-control
bar as distinct accessible groups and MUST keep keyboard focus moving through the
header actions before the context controls.

1. The header line's document-action group MUST carry an accessible group name
   (e.g. `role="group" aria-label="Document actions"`) and the bordered toolbar
   MUST carry its own (e.g. `aria-label="Context controls"`), so the split is not
   conveyed by placement or colour alone.
2. Every icon-only control MUST keep its existing `aria-label`/tooltip contract
   after the move (no regression against `report-toolbar-parity`).
3. Keyboard focus order MUST traverse the header action group, then the context
   bar — satisfied by the header preceding the toolbar in the DOM.

#### Scenario: a keyboard user tabs through the surface

- **WHEN** a keyboard user tabs into the report surface
- **THEN** focus visits the header document-action controls before the context
  bar controls
- **AND** the header action group and the context bar each expose an accessible
  group name

### Requirement: The lead quick-add control holds a stable document-action slot across view modes

The lead "+ Add" quick-add control MUST render in both edit and slides modes for
an editable (non-read-only) section, so it does not disappear when the lead
switches to slides — today it is gated `!isSlidesMode` and vanishes (annotations
C2). The control is `apps/web/src/components/lead/quick-add-button.tsx`, rendered
by `apps/web/src/components/lead/lead-form.tsx` inside the header line's
`DocumentActionGroup`. Within
the document-action group it MUST sit immediately before the forward commit (the
Submit Section primary) — after Save and Fill-From (annotations C1) — so the
single-forward-primary accent hierarchy is preserved: "+ Add" takes the
neutral/outline treatment and MUST NOT carry a resting solid brand-accent fill,
which stays reserved for the Submit Section commit. On a read-only past period
"+ Add" MUST be hidden together with the other mutating document actions (Save,
Submit Section, Fill-From), and it MUST stay disabled when the lead owns no
product (there is no valid per-type dialog target).

#### Scenario: switching edit to slides keeps + Add present

- **WHEN** a lead toggles the view-mode control from edit to slides on an
  editable section
- **THEN** the "+ Add" control remains present in the document-action group
- **AND** it does not disappear or change position

#### Scenario: + Add sits immediately before the Submit primary

- **WHEN** a lead opens their editable, not-yet-submitted report
- **THEN** the "+ Add" control renders after Save and Fill-From and immediately
  before the Submit Section commit
- **AND** "+ Add" carries a neutral/outline treatment, not the resting solid
  brand-accent fill

#### Scenario: a read-only past period hides + Add

- **WHEN** a lead opens a read-only past period
- **THEN** the "+ Add" control is hidden alongside Save, Submit Section, and
  Fill-From

#### Scenario: a lead with no products cannot quick-add

- **WHEN** the lead owns no product
- **THEN** the "+ Add" control renders but is disabled

### Requirement: Report context controls preserve semantic clusters at every supported width

The lead, head, and viewer report context bars MUST keep controls that answer the same question in one visible cluster. Period navigation and its show-archived-periods filter MUST remain adjacent on desktop; view scope, mode, review, and trailing utility controls MUST remain a distinct trailing cluster. Responsive reflow MUST keep every control reachable without inserting unexplained empty space inside either cluster.

#### Scenario: archived periods exist on a wide lead report

- **WHEN** a lead opens a report with archived periods at a desktop width
- **THEN** the archive filter renders directly after the period navigator and its separator
- **AND** flexible space separates that complete period cluster from the trailing view controls

#### Scenario: context controls reflow at a compact width

- **WHEN** the same report context controls do not fit on one row
- **THEN** the clusters wrap without clipping any control or separating the archive filter from period navigation

### Requirement: Visual acceptance uses clean role and viewport evidence

Report UI changes MUST be accepted against clean browser screenshots for lead, head, admin, and viewer roles at desktop and compact widths. The evidence MUST include report edit and slides where the role supports them, MUST identify the tested source SHA, and MUST NOT classify browser inspector overlays or browser chrome as product rendering.

The capture runtime MUST suppress the Next.js on-screen development indicator and application inspection tools while retaining compile and runtime error reporting. The application navigation MUST expose exactly one stable product-owned accent landmark for visual evidence.

#### Scenario: a suspected navigation stripe is reviewed

- **WHEN** a screenshot contains a line or highlight not reproduced in a clean browser capture at the same route and viewport
- **THEN** the highlight is recorded as capture tooling or browser state rather than fixed as application CSS

#### Scenario: a report layout change is accepted

- **WHEN** a change affects shared report chrome or slide presentation
- **THEN** the review set contains source-bound screenshots for every affected role, mode, and required viewport before the change is accepted

#### Scenario: development capture distinguishes product chrome from tooling

- **WHEN** the source-bound capture runs against a development server
- **THEN** the Next.js development indicator and application inspection tools are absent
- **AND** exactly one application-owned navigation accent landmark remains visible
- **AND** compile and runtime errors remain enabled
