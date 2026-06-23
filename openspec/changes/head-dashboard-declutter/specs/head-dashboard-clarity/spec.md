## ADDED Requirements

### Requirement: The live activity feed renders exactly once on the dashboard

The head dashboard (`/head/dashboard`, `DashboardPage`) MUST render the
`activity.live` feed exactly once, via `ActivityLivePanel`. A second card that
re-renders the same `activity.live` feed (the removed `Activity24hCard`) MUST
NOT appear on the dashboard.

#### Scenario: the head opens the dashboard

- **WHEN** the head opens `/head/dashboard` with an active period
- **THEN** the live activity feed renders once via `ActivityLivePanel`
- **AND** no second card re-renders the same `activity.live` feed

### Requirement: The Period Summary table fits its container without horizontal scroll

The `LeadSummaryTable` ("Period Summary") on the head dashboard MUST fit within
its card container at standard dashboard width, so no horizontal-scroll
affordance appears. Its rows MUST follow the rounded card idiom of the other
dashboard cards rather than a square-ruled table treatment.

#### Scenario: the head views the Period Summary at standard width

- **WHEN** the head opens `/head/dashboard` at a standard desktop width
- **THEN** the Period Summary table fits inside its card with no horizontal
  scrollbar
- **AND** its rows read as part of the rounded card idiom of the surrounding
  dashboard cards

### Requirement: The per-lead Remind button is gated by an active reminder rule

The per-lead `RemindLeadButton` inside `LeadSummaryTable` MUST be offered only
when `hasActiveReminderRule` is true — the same `canSendReminder` gate the
`AlertBar` already honors. When no active reminder rule covers the period, the
table MUST NOT offer a Remind action that would dispatch nothing.

#### Scenario: no active reminder rule

- **WHEN** the head opens `/head/dashboard` and `hasActiveReminderRule` is false
- **THEN** the Period Summary table offers no per-lead Remind action

#### Scenario: an active reminder rule covers the period

- **WHEN** the head opens `/head/dashboard`, `hasActiveReminderRule` is true,
  and a lead row is in draft
- **THEN** that row offers a Remind action
- **AND** activating it dispatches at least one reminder (not
  `reason: "no-active-rule"`)
