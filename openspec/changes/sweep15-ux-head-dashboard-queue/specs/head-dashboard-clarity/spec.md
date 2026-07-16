## MODIFIED Requirements

### Requirement: The live activity feed renders exactly once on the dashboard

The head dashboard (`/head/dashboard`, `DashboardPage`) MUST represent lead submission/edit freshness exactly once in the canonical Period Summary queue. A standalone `ActivityLivePanel` per-lead roster or any second card that re-renders the same lead activity feed MUST NOT appear. Non-lead operational events MAY remain in a collapsed event feed only when they are not another lead roster.

#### Scenario: the head opens the dashboard

- **WHEN** the head opens `/head/dashboard` with an active period
- **THEN** each lead's latest submission/edit freshness appears in that lead's Period Summary queue row/detail
- **AND** no separate Submission Activity lead roster appears

### Requirement: The Period Summary table fits its container without horizontal scroll

The `LeadSummaryTable` surface labeled "Period Summary" MUST become a vertical expandable per-lead action queue, not a ruled multi-column table, and MUST fit its card container without horizontal scrolling. Each collapsed row MUST carry identity, role, submission/review state, freshness, compact content/attention summary, and the currently primary contextual action. Expanding a row MUST reveal product/activity content counts, recent edit/submission detail, review state, and all currently valid secondary actions without rendering the full report body. Rows MUST order by action need, with a stable name tie-break, and controls MUST never be clipped.

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

## ADDED Requirements

### Requirement: Period Summary is the single canonical per-lead action queue

The head dashboard MUST render each period lead exactly once in Period Summary and MUST NOT render a separate Section Review roster or another submission roster after their unique signals and actions are represented in the queue.

#### Scenario: Review and activity data exist for one lead

- **WHEN** a lead has content freshness, a submitted section, and a review verdict/action
- **THEN** one Period Summary row combines those signals
- **AND** the lead's name is not repeated in standalone Submission Activity or Review rosters

### Requirement: Queue actions are contextual and reuse existing gates

Each Period Summary row MUST offer only actions valid for its current state and server-provided capabilities: Open for content-bearing drafts/submissions, Remind only when an active reminder rule permits it, Review and Request Changes only when review capability permits, and Revoke only for a submitted section in a non-published period.

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

The dashboard MUST place Revoke All in a secondary bulk/destructive action area rather than the primary page-header action slot, while preserving its confirmation, count, authorization, and mutation behavior.

#### Scenario: Submitted leads exist

- **WHEN** Revoke All is available
- **THEN** normal per-lead queue actions remain visually primary
- **AND** invoking the secondary bulk action still requires the existing destructive confirmation
