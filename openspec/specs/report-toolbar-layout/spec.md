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

At desktop width, period/archive controls MUST remain the left cluster and
Product/Leads scope, the Head fullscreen toggle in Slides mode, and view mode
MUST remain the right cluster of the single report context toolbar. Head MUST
NOT render a density control. The fullscreen toggle MUST be adjacent to the
scope controls and MUST use the shared fullscreen affordance.

#### Scenario: Head opens Slides

- **WHEN** the Head opens Slides mode
- **THEN** the context toolbar contains period/archive controls, Product/Leads,
  one fullscreen toggle, and the Edit/Slides view mode in one row
- **AND** no `Slide density` control is present
- **AND** the active deck does not render a second fullscreen toggle

#### Scenario: Head opens Leads presentation

- **WHEN** the Head selects Leads scope in Slides mode
- **THEN** period/archive, scope, fullscreen, and view controls remain in the
  single context toolbar
- **AND** the next deck row is the lead carousel rather than a second
  mode-control row

### Requirement: Lead slide context controls expose the working density choice

At desktop width, the Lead report context toolbar MUST keep period/archive controls in the left cluster and record visibility, labeled view mode, density, and fullscreen controls in the trailing cluster. The working Document/Presentation density choice MUST NOT render as a second hosted deck row, while standalone Lead decks MAY keep their local density toolbar.

#### Scenario: Lead opens hosted slides

- **WHEN** a Lead opens slides mode for the addressed report
- **THEN** the context toolbar exposes visible desktop `Report` and `Slides` labels
- **AND** exactly one Document/Presentation density control is present across the report context and deck
- **AND** the existing fullscreen control remains available

### Requirement: The document-action row uses an accent hierarchy with a single forward primary

The header line's document-action group MUST give at most one control the
resting solid brand-accent fill — the forward commit when one is available — and
MUST render the other document actions with a lesser accent (outline/ghost) so
they do not compete with that primary. The bordered context-control bar MUST NOT
give any control a solid brand-accent fill; its segmented toggles use a neutral
active-selection fill, not the brand accent.

1. When a forward commit is available (Submit for lead, Publish & lock
   for head) it MUST be the only control with the resting solid brand-accent
   fill; in states with no forward commit (submitted lead, published head) the
   header action group has no resting solid primary.
2. Reversal lifecycle actions (Request reopen, Revoke, Reopen) MUST NOT use the
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
- **THEN** the Request reopen control is rendered with a neutral/outline
  treatment, not the resting solid brand-accent fill

#### Scenario: the context bar uses no brand-accent fill

- **WHEN** the bordered context-control bar renders its segmented toggles
- **THEN** the active segment uses the neutral foreground fill, not the brand
  accent
- **AND** no control in the bar carries a solid brand-accent fill

### Requirement: Toolbar row composition adapts to role and period state without losing positional stability

The report surface MUST adjust which controls render by role and period state
while keeping the surviving controls in stable positions across the header action
group and the context bar.

1. For a lead read-only past period, the header action group MUST hide the real
   mutating document actions (Save, Submit, Fill from, whose accessible names
   are `Fill from most recent submitted period` and `Choose past report to fill
from`); the
   context-control bar MUST remain.
2. When a lead submits, Save MUST be hidden and the forward commit slot MUST
   switch to the reversal action without reordering the remaining controls.
3. Viewer and the lead preview render through the shared report page; neither
   header action group MUST contain any commit control (Save/Submit/Publish). For
   the viewer specifically, the navigation it adds (e.g. Back to Archive) MUST
   sit in the context-control bar, not the header action group. The lead preview
   keeps its own outer header; its outer-header navigation is outside the shared
   toolbar contract and remains in that outer header.
4. Status indicators (submitted count, autosave time, publish precondition hint,
   department label) MUST render on the header line as labels, NOT inside the
   document-action group or the context bar.

#### Scenario: a lead views a locked past period

- **WHEN** a lead opens a read-only past period
- **THEN** the header action group hides Save, Submit, and Fill from
- **AND** the context bar still allows navigating periods

#### Scenario: a viewer opens a published report

- **WHEN** a viewer opens a published report through the shared report page
- **THEN** the header action group shows only the PDF export with no
  Save/Submit/Publish
- **AND** the submitted-count badge renders outside the header action group

### Requirement: All toolbar controls stay reachable at narrow viewport widths

The header action group and the context-control bar MUST each keep every control
reachable at narrow widths; controls MUST NOT be clipped out of reach.
The report title and department context MUST wrap at narrow widths rather
than lose meaningful names to truncation.

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

#### Scenario: A mobile report has a long department name

- **WHEN** a report header renders at 375 CSS pixels with a long department context
- **THEN** the complete title and context remain readable without clipping the document actions

### Requirement: Document actions render on the page header line; the toolbar holds the context-control bar

The report surface MUST split its controls by one axis — operates on the report document vs changes which / how it is shown — placing the document actions on the page header line and the context controls in the single bordered toolbar bar below it. The Lead Save/Add/Submit cluster MAY hand off to the compact sticky action surface when its header leaves the viewport, as specified in `lead-completion-guidance`; both placements MUST share action state and handlers, and the context toolbar MUST NOT become a second action surface.

1. A control that creates, persists, commits, or exports report content (Save,
   Submit, Publish & lock, Fill from, PDF export, Archive) MUST
   render on the page header line, in a right-aligned action group beside the
   title/status block — NOT inside the bordered toolbar.
2. A control that changes which report is shown or how it is presented (period
   navigation, show-archived-periods filter, scope, view mode, and in slides
   the density and fullscreen controls) MUST render in
   the bordered toolbar bar, even when it persists a setting.
3. The bordered toolbar MUST render exactly one row (the context-control bar);
   it MUST NOT contain a document-action row.
4. The head archive surfaces split by this axis: the show-archived-periods
   filter is a context control (toolbar bar), while the published-period "Archive"
   lifecycle button (accessible name `Move this report to the archive`) is a document action (header line).

#### Scenario: the lead surface splits across the header and the toolbar

- **WHEN** a lead opens their report for an editable period that has archived
  periods in its history
- **THEN** the header line's action group shows Fill from, Save, and the Submit commit
- **AND** the bordered toolbar shows one row: period navigation, the
  show-archived-periods filter, Report chat, the Mine/Everyone scope, and the
  Report/Slides view mode; the Report overview has no collapse-all control

#### Scenario: the lead slides surface shows density and fullscreen in the trailing slot

- **WHEN** a lead opens their report in slides mode
- **THEN** the bordered toolbar's trailing utility slot shows the Document/Presentation
  density control and the fullscreen toggle

#### Scenario: the head surface splits across the header and the toolbar

- **WHEN** a head opens the review page for an open period
- **THEN** the header line's action group shows the PDF export and the Publish &
  lock commit
- **AND** the bordered toolbar shows one row: period navigation, the
  show-archived-periods filter, the Product/Leads scope, the Edit/Slides view
  mode

#### Scenario: a published head period offers move-to-archive as a document action

- **WHEN** a head views a published period that can be moved to the archive
- **THEN** the Archive control (accessible name `Move this report to the archive`) renders in the header line's action group,
  separate from the toolbar's show-archived-periods filter

### Requirement: The header action group and the context bar are accessible as labeled groups with a stable focus order

The report surface MUST expose the header action group and the context-control
bar as distinct accessible groups and MUST keep keyboard focus moving through the
header actions before the context controls.

1. The header line's document-action group MUST carry an accessible group name
   (e.g. `role="group" aria-label="Document actions"`) and the bordered toolbar
   MUST carry its own (e.g. `aria-label="Context controls"`), so the split is not
   conveyed by placement or colour alone.
2. Every icon-only control MUST expose its declared `aria-label` and tooltip.
3. Keyboard focus order MUST traverse the header action group, then the context
   bar — satisfied by the header preceding the toolbar in the DOM.

#### Scenario: a keyboard user tabs through the surface

- **WHEN** a keyboard user tabs into the report surface
- **THEN** focus visits the header document-action controls before the context
  bar controls
- **AND** the header action group and the context bar each expose an accessible
  group name

### Requirement: The lead document-action group holds no quick-add control

The lead document-action group MUST contain only Fill from, Save, and the
forward commit (Submit) or its reversal. Record creation MUST NOT use a header
quick-add control: it happens through each editable cell's `Add item` footer
(`lead-status-overview`) and the Risks & Blockers and Decisions sections. The
header group MUST keep the same controls in Report and Slides modes so
switching modes does not move them. On a read-only past period Save, Submit,
and Fill from MUST be hidden.

#### Scenario: switching Report to Slides keeps the document actions

- **WHEN** a lead toggles the view-mode control from Report to Slides on an
  editable section
- **THEN** the document-action group still shows Fill from, Save, and Submit in
  the same order
- **AND** no `+ Add item` control is present in the group

#### Scenario: a read-only past period hides the mutating actions

- **WHEN** a lead opens a read-only past period
- **THEN** Save, Submit, and Fill from are hidden

### Requirement: Report context controls preserve semantic clusters at every supported width

The lead, head, and viewer report context bars MUST keep controls that answer the same question in one visible cluster. Period navigation and its show-archived-periods filter MUST remain adjacent on desktop; view scope, mode, review, and trailing utility controls MUST remain a distinct trailing cluster. Responsive reflow MUST keep every control reachable without inserting unexplained empty space inside either cluster.

#### Scenario: archived periods exist on a wide lead report

- **WHEN** a lead opens a report with archived periods at a desktop width
- **THEN** the archive filter renders directly after the period navigator and its separator
- **AND** flexible space separates that complete period cluster from the trailing view controls

#### Scenario: context controls reflow at a compact width

- **WHEN** the same report context controls do not fit on one row
- **THEN** the clusters wrap without clipping any control or separating the archive filter from period navigation

### Requirement: Lead toolbar clusters reflow before controls collide

The Lead context toolbar MUST keep period navigation and archive controls as an
intrinsic leading cluster. Visibility, view mode, density and fullscreen MUST
share the remaining width as a trailing cluster and wrap within the same
bordered context bar before either cluster can overlap the other's interactive
area. Reflow MUST preserve DOM and keyboard order: period controls first, then
the trailing controls in their existing order.

#### Scenario: Hosted Lead Slides has constrained toolbar width

- **GIVEN** a long selected-period label and either Document or Presentation density
- **WHEN** the toolbar is rendered at 1024, 1440, 1728 or native 200% zoom
- **THEN** Next, Archive, Visibility, View, Density and Fullscreen targets do not overlap
- **AND** every target remains reachable in the same logical Tab order

### Requirement: Lead read-only state is stated in the header

When the lead report cannot be edited and the section is not submitted, the
header MUST show a "Read-only" badge in place of the autosave badge and the
subtitle "Read-only report and status context.". An editable report MUST keep
the autosave badge and the subtitle "Your report draft and status context.".
Mutating document actions MUST stay hidden while the report is read-only.

#### Scenario: a past period is opened

- **WHEN** a lead opens a report that is read-only and not submitted
- **THEN** the header shows the "Read-only" badge and the read-only subtitle
- **AND** no autosave badge or Fill from control is rendered

### Requirement: Reasons for unavailable toolbar controls are reachable by mouse, keyboard and touch

A toolbar control that is unavailable for a stated reason (Fill from segments
and Report chat) MUST use `aria-disabled` instead of `disabled`, so it stays
focusable. Its reason MUST be shown on hover, on focus, and on click or tap of
the control; activating the control MUST NOT run its action. The control MUST
reference the same reason text through `aria-describedby`.

#### Scenario: a blocked control is tapped

- **WHEN** a touch user taps an unavailable Fill from segment or Report chat
- **THEN** the reason is visible
- **AND** no confirmation dialog or chat sheet opens

#### Scenario: no past report can be filled from

- **WHEN** the lead has no submitted past report
- **THEN** the Fill from main segment is unavailable and focusing or clicking it shows "No submitted past report to fill from."

### Requirement: Lead preview navigation remains readable on mobile

The outer header at `/lead/report/[reportId]/preview` MUST stack its title and
description above the Back to form link below 640 CSS pixels. The link MUST
retain one unwrapped label, a minimum height of 44 CSS pixels, and its existing
form destination. At wider widths, the existing horizontal header MAY remain.

#### Scenario: A lead returns from mobile preview

- **WHEN** a Lead opens Section Preview at 375 CSS pixels
- **THEN** its header text and Back to form link fit without squeezing or overlap
- **AND** Back to form remains a single-line, reachable link to the addressed form
