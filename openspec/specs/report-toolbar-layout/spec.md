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

Report document-action groups MUST reserve resting solid brand accent for at most one available forward commit. Other actions and reversal controls MUST use lesser neutral/outline treatment. Context controls MUST have no solid brand-accent fill. A rendered in-flight save/retry control MAY use transient accent busy styling without becoming another resting primary.

#### Scenario: a published head period shows the reversal as non-accent

- **WHEN** a head views a published period whose primary action is Reopen
- **THEN** Reopen uses neutral/outline treatment rather than resting solid brand accent

#### Scenario: a submitted lead section shows the reversal as non-accent

- **WHEN** a submitted lead section offers Request reopen
- **THEN** it uses neutral/outline treatment rather than resting solid brand accent

#### Scenario: the context bar uses no brand-accent fill

- **WHEN** the context bar renders segmented toggles
- **THEN** its active segment uses neutral foreground fill
- **AND** no context control uses solid brand accent

#### Scenario: Retry is busy while Submit remains the forward commit

- **WHEN** a visible completion Retry is saving
- **THEN** its accent spinner treatment is temporary and full opacity
- **AND** Submit remains the sole resting forward primary

### Requirement: Toolbar row composition adapts to role and period state without losing positional stability

Report controls MUST adapt to role and lifecycle eligibility while surviving controls retain stable positions. Read-only Lead periods MUST hide mutating actions; submission MUST replace the forward slot with its reversal. Viewer and Lead preview MUST expose no commit control. Status indicators MUST remain header labels outside action/context groups. Lead save recovery MUST follow Retry-only completion rules.

#### Scenario: a lead views a locked past period

- **WHEN** a lead opens a read-only past period
- **THEN** Save/Retry, Submit, and Fill from are absent
- **AND** the context bar still allows period navigation

#### Scenario: a viewer opens a published report

- **WHEN** a viewer opens a published report through the shared page
- **THEN** its action group shows only PDF export without Save, Retry, Submit, or Publish
- **AND** submitted-count status remains outside the action group
- **AND** viewer Back to Archive navigation remains in the context bar

#### Scenario: submission and preview retain their role boundaries

- **WHEN** a lead submits or opens the read-only preview
- **THEN** submission hides Retry and replaces Submit with the eligible reversal without reordering survivors
- **AND** preview has no commit control and keeps its existing outer-header navigation outside the shared toolbar
- **AND** autosave time, submitted count, publish preconditions, and department labels stay outside document/context action groups

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

Report document actions MUST occupy the header action group and context controls one bordered toolbar row. Lead completion actions MAY hand off between the header and a separate non-overlay rail while sharing state and handlers. The rail MUST use Retry-only autosave recovery, not a permanent Save/Add cluster. The context toolbar MUST NOT become a second document-action surface.

#### Scenario: the lead surface splits across the header and the toolbar

- **WHEN** a lead opens an editable report with archived history
- **THEN** the header offers Fill from and eligible completion actions, with Retry only during autosave recovery
- **AND** the single context row holds period navigation, archived filter, Report chat, Mine/Everyone scope, and Report/Slides mode
- **AND** Report Overview has no collapse-all control and no permanent manual Save

#### Scenario: the lead slides surface shows density and fullscreen in the trailing slot

- **WHEN** a lead opens Slides
- **THEN** the context toolbar trailing slot shows Document/Presentation density and fullscreen

#### Scenario: the head surface splits across the header and the toolbar

- **WHEN** a head opens review for an open period
- **THEN** PDF export and Publish & lock occupy the header action group
- **AND** period navigation, archived filter, Product/Leads scope, and Edit/Slides mode occupy the single context row

#### Scenario: a published head period offers move-to-archive as a document action

- **WHEN** a head views a period eligible for Move this report to the archive
- **THEN** Archive remains a header document action separate from the context archive filter

#### Scenario: document and presentation controls follow the same split

- **WHEN** report controls are composed
- **THEN** Submit, Publish & lock, Fill from, PDF export, Archive, and any eligible save/retry action stay outside the context bar
- **AND** period, archived filter, scope, mode, density, and fullscreen stay in that bar even if a setting is persisted

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

The Lead document-action group MUST contain Fill from and eligible Submit/reversal actions, plus Retry only for autosave recovery. Record creation MUST stay with reporting-unit/header or contextual Current/Next entry points and the Risks/Decisions sections, not a report-header quick-add. Report/Slides switching MUST retain action order; read-only past periods MUST hide mutating actions.

#### Scenario: switching Report to Slides keeps the document actions

- **WHEN** a lead switches Report to Slides on an editable section
- **THEN** Fill from, any eligible Retry, and Submit keep their relative order and shared state
- **AND** no report-header `+ Add item` control or permanent Save appears

#### Scenario: a read-only past period hides the mutating actions

- **WHEN** the lead opens a read-only past period
- **THEN** Save/Retry, Submit, and Fill from are hidden

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
A Submitted or Read-only badge MUST outrank the "Unsaved update" badge of an
open update, so a locked section never reads as editable.

#### Scenario: a past period is opened

- **WHEN** a lead opens a report that is read-only and not submitted
- **THEN** the header shows the "Read-only" badge and the read-only subtitle
- **AND** no autosave badge or Fill from control is rendered

#### Scenario: an open update outlives a locked section

- **GIVEN** an update is open in Overview
- **WHEN** the section becomes submitted or read-only
- **THEN** the header shows "Submitted" or "Read-only" respectively
- **AND** it does not show "Unsaved update"

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

### Requirement: Lead completion handoff MUST share canonical action state

Lead header and rail completion presentations MUST share canonical autosave, Submit, eligibility, and review state without duplicate handlers. Visibility handoff MUST use the latest header visibility observation; observer absence MUST leave header actions usable. Neither presentation MUST add a global quick-add control. Retry focus recovery MUST follow `lead-report-controls-integrity`.

#### Scenario: Header visibility observations are coalesced

- **WHEN** one observer batch includes multiple visibility changes for the header sentinel
- **THEN** the last observation determines the active completion presentation
- **AND** both presentations consume the same eligibility, review count, and canonical handlers

#### Scenario: Header observation is unavailable

- **WHEN** no header sentinel or IntersectionObserver is available
- **THEN** header actions remain usable instead of disappearing
