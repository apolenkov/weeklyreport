# head-dashboard-clarity Specification

## Purpose

Keep the head dashboard focused on triage and action through one live activity feed, compact period summaries, actionable reminder states, and deduplicated product-grouped risks.

## Requirements

### Requirement: The live activity feed renders exactly once on the dashboard

The head dashboard (`/head/dashboard`, `DashboardPage`) MUST represent lead
submission/edit freshness exactly once in the canonical Period Summary queue. A
standalone per-lead activity roster or any second card that re-renders the same
lead activity feed MUST NOT appear. Non-lead operational events MAY remain in a
collapsed event feed only when they are not another lead roster.

#### Scenario: the head opens the dashboard

- **WHEN** the head opens `/head/dashboard` with an active period
- **THEN** each lead's latest submission/edit freshness appears in that lead's Period Summary queue row/detail
- **AND** no separate Submission Activity lead roster appears

### Requirement: The Period Summary table fits its container without horizontal scroll

The `LeadSummaryTable` surface labeled "Period Summary" MUST become a vertical
expandable per-lead action queue, not a ruled multi-column table, and MUST fit
its card container without horizontal scrolling. Each collapsed row MUST carry
identity, role, submission/review state, freshness, compact content/attention
summary, and the currently primary contextual action. Expanding a row MUST
reveal product/activity content counts, recent edit/submission detail, review
state, and all currently valid secondary actions without rendering the full
report body. Rows MUST order by action need, with a stable name tie-break, and
controls MUST never be clipped.

#### Scenario: the queue prioritizes work needing action

- **WHEN** the period contains a requested-changes row, a reviewable submission, a stale draft, an active draft, and an approved/completed row
- **THEN** the action-needed rows sort ahead of active and completed rows according to the documented queue priority
- **AND** equal-priority rows remain name-stable

#### Scenario: a lead row expands

- **WHEN** the head activates a row's expansion control
- **THEN** the control exposes accurate `aria-expanded` and `aria-controls`
- **AND** freshness, content detail, review state, and valid secondary actions become reachable without navigating away

#### Scenario: the queue fits standard and narrow widths

- **WHEN** the Period Summary renders at standard desktop, tablet, or phone width
- **THEN** it uses stacked/compact responsive rows with no horizontal scrollbar
- **AND** action controls remain fully visible and keyboard reachable

### Requirement: Every content-bearing Period Summary row drills into the focused report

The head dashboard Period Summary queue MUST expose its current Open or Review
action for every row with report content, whether the section is draft or
submitted. The action MUST target that lead's focused live report. A row with no
content MUST NOT expose an Open action.

#### Scenario: Draft content opens the focused live report

- **WHEN** a draft activity row has at least one item, risk, decision, or priority
- **THEN** the row links to `/head/report/[reportId]?authorId=[leadId]`
- **AND** its draft status remains visibly labeled

#### Scenario: Submitted content remains linked

- **WHEN** a submitted activity row has report content
- **THEN** the row links to the same focused live-report target
- **AND** it exposes the standard keyboard focus and link affordances

#### Scenario: Truly empty row is inert

- **WHEN** an activity row has zero items, risks, decisions, and priorities
- **THEN** the row renders no report link
- **AND** it communicates that the lead has no report content yet

### Requirement: Period Summary is the single canonical per-lead action queue

The head dashboard MUST render each period lead exactly once in Period Summary
and MUST NOT render a separate Section Review roster or another submission roster
after their unique signals and actions are represented in the queue.

#### Scenario: Review and activity data exist for one lead

- **WHEN** a lead has content freshness, a submitted section, and a review verdict/action
- **THEN** one Period Summary row combines those signals
- **AND** the lead's name is not repeated in standalone Submission Activity or Review rosters

### Requirement: Queue actions are contextual and reuse existing gates

Each Period Summary row MUST offer only actions valid for its current state and
server-provided capabilities: Open for content-bearing drafts/submissions, Remind
only when an active reminder rule permits it, Review and Request Changes only
when review capability permits, and Revoke only for a submitted section in a
non-published period.

#### Scenario: A draft lead has content

- **WHEN** a draft row has content and reminders are enabled
- **THEN** Open and Remind are available
- **AND** Review, Request Changes, and Revoke are not presented as valid actions

#### Scenario: A submitted section is reviewable

- **WHEN** a submitted row has `canReview` in a non-published period
- **THEN** Review and Request Changes are available through the existing review flow
- **AND** Revoke remains a distinct explicit rollback action

#### Scenario: A period is published

- **WHEN** the queue displays a published period
- **THEN** mutation actions that require an editable period are absent or disabled according to existing server capability fields

### Requirement: Revoke All is secondary to per-lead queue actions

The dashboard MUST place Revoke All in a secondary bulk/destructive action area
rather than the primary page-header action slot, while preserving its
confirmation, count, authorization, and mutation behavior.

#### Scenario: Submitted leads exist

- **WHEN** Revoke All is available
- **THEN** normal per-lead queue actions remain visually primary
- **AND** invoking the secondary bulk action still requires the existing destructive confirmation

### Requirement: The per-lead Remind button is gated by an active reminder rule

The per-lead `RemindLeadButton` inside `LeadSummaryTable` MUST be offered only
when the weekly report exposes an exact `activeDeadlineReminderRuleId` — the
same non-null `ruleId` predicate the `AlertBar` honors. When no current
sendable deadline rule covers the period, the table MUST NOT offer a Remind
action that would dispatch nothing. An escalation rule alone never enables
this control.

#### Scenario: no active reminder rule

- **WHEN** the head opens `/head/dashboard` and
  `activeDeadlineReminderRuleId` is null
- **THEN** the Period Summary table offers no per-lead Remind action

#### Scenario: an active reminder rule covers the period

- **WHEN** the head opens `/head/dashboard`, an exact
  `activeDeadlineReminderRuleId` is present, and a lead row is in draft
- **THEN** that row offers a Remind action
- **AND** the mutation submits that exact rule id
- **AND** activating it dispatches at least one reminder (not
  `reason: "no-active-rule"`)

### Requirement: The Blocked & At Risk dashboard block is collapsed by default

The `BlockedAtRiskTable` block on the head dashboard MUST start collapsed, since
the same blocked / at-risk content is reachable in the report below; it stays an
on-demand fast-triage peek the head expands rather than a permanently expanded
block claiming vertical space. It MUST remain expandable when it has issues.

#### Scenario: the head opens the dashboard with blocked/at-risk issues present

- **WHEN** the head opens `/head/dashboard` and there are blocked or at-risk items
- **THEN** the Blocked & At Risk block renders collapsed (its trigger reports
  `aria-expanded="false"`)
- **AND** activating the trigger expands it to reveal the issue rows

### Requirement: The Blocked & At Risk issues are grouped into per-product cards

The expanded `BlockedAtRiskTable` MUST cluster its issues into one card per
product, in the report `ProductAccordion` idiom, so a product carrying several
issues shows its name once instead of repeating it on every row. Each product
card header MUST carry an avatar, the product name, a worst-severity status dot
(blocked / at-risk), and the line of contributing assignees. Each issue row MUST
show a left status rail (red for blocked, amber for at-risk), a
stage-over-assignee gutter, the issue description, and a Blocked / At risk badge
— the same row vocabulary the report accordion uses. Product cards MUST preserve
the first-appearance order of the source data, and the trigger's issue count
MUST remain the total across all cards.

#### Scenario: a product with several issues shows its name once

- **WHEN** the head expands the Blocked & At Risk block and one product has more
  than one blocked or at-risk issue
- **THEN** that product name appears once in a single product-card header above
  its issue rows
- **AND** each issue row under it shows its own stage, assignee, and description
  without repeating the product name

#### Scenario: each product card reads in the report accordion idiom

- **WHEN** the head views an expanded product card
- **THEN** its header shows an avatar, the product name, a status dot, and the
  contributing assignees
- **AND** each issue row shows a status rail, a stage-over-assignee gutter, the
  description, and a Blocked / At risk badge

### Requirement: The product-level red roll-up does not duplicate stage rows

The dashboard Blocked & At Risk list MUST suppress the product-level "flagged
red" roll-up from a product's rows whenever that product already has a concrete
blocked or unresolved-risk stage row. Blocked and at-risk issues in this list are
stage-keyed (each names the SDLC stage it belongs to); the "flagged red"
escalation is a stage-less product roll-up whose status the product card header's
dot already conveys, so a duplicate row is noise. It MUST still surface when it
is the product's only signal (a red product with no concrete blocker or risk),
where its row MUST be labeled "Flagged" rather than "No stage set".

#### Scenario: a redundant product roll-up is suppressed

- **WHEN** a product has a concrete blocked or at-risk stage row AND a
  product-level "flagged red" roll-up
- **THEN** the dashboard Blocked & At Risk list omits the roll-up row
- **AND** the product card header's status dot conveys the red status instead

#### Scenario: a lone product roll-up is kept and labeled Flagged

- **WHEN** a product is flagged red but has no concrete blocked or at-risk stage
  row
- **THEN** the roll-up surfaces as the product's single row
- **AND** that row's stage reads "Flagged", never "No stage set"

### Requirement: Dashboard surfaces MUST NOT present placeholder state as live data

The head dashboard SHALL only render loading affordances and KPI values that
correspond to real, currently-queryable state; any client-side script or
component that relies on a DOM marker MUST query a marker that some
component actually renders, and any metric with no backing data source MUST
be omitted rather than presented as a fabricated number or a constant
placeholder.

#### Scenario: bfcache-recovery script detects a real loading marker

- **WHEN** the head dashboard is restored from the browser back-forward
  cache while a panel (kpi, leads, or blocked) is still loading
- **THEN** the dashboard root renders a DOM marker reflecting that loading
  state
- **AND** the bfcache-recovery script's selector matches that marker and
  triggers a reload

#### Scenario: bfcache-recovery script is a no-op once loading completes

- **WHEN** the head dashboard is restored from the browser back-forward
  cache after all panels have finished loading
- **THEN** no loading marker is present in the DOM
- **AND** the bfcache-recovery script does not reload the page

#### Scenario: no last-week submission comparison without backing data

- **WHEN** the dashboard KPI strip is built from a `WeeklyReportReadModel`
  that has no prior-period submission data
- **THEN** the KPI card does not render a numeric "Last week 0/0" comparison
- **AND** it renders no last-week text at all, neither a number nor a
  placeholder constant
