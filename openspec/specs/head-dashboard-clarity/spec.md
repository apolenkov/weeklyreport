# head-dashboard-clarity Specification

## Purpose

TBD - created by archiving change head-dashboard-declutter. Update Purpose after archive.

## Requirements

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

### Requirement: A submitted lead row is never marked 24h-inactive

A `submitted` lead row in `LeadSummaryTable` MUST NOT be marked 24h-inactive (the `lead-row-inactive-24h` dim/nudge treatment), even when its `submittedAt`-derived `lastActivity` is a date-only value that parses to more than 24 hours ago. The 24h-inactive styling applies only to leads with open work (draft or pending). A submitted lead is done, not stale, so the row stays at full prominence for the Revoke affordance.

#### Scenario: a lead submitted earlier in the period

- **WHEN** the head opens the dashboard and a lead row is `submitted` with a
  date-only `lastActivity` more than 24 hours ago
- **THEN** that row is not dimmed and carries no `lead-row-inactive-24h` marker
- **AND** its Revoke action reads at full prominence

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
