# head-dashboard-clarity Specification

## MODIFIED Requirements

### Requirement: The Period Summary table fits its container without horizontal scroll

The `LeadSummaryTable` ("Period Summary") on the head dashboard MUST render as a
vertical list of per-lead cards in the `BlockedAtRiskTable` row idiom (rounded
`rounded-lg` cards on a soft surface, separated by gaps rather than ruled
table borders) — NOT as a multi-column ruled `<table>` — and MUST fit within its
card container at standard dashboard width so no horizontal-scroll affordance
appears. Each lead card MUST carry the lead identity (avatar, name, role) and
submission status on its lead line, the per-section counts (products, current,
next, risks, decisions, priorities) as compact labeled values, and the per-lead
action (Remind or Revoke) gated exactly as before. The per-lead counts MUST sit
on shared column rails (a CSS subgrid track template owned by the list) so the
same count aligns vertically across every lead row regardless of value width;
the status, submitted-date, and action columns MUST size to their content so
their controls are never clipped.

#### Scenario: the per-lead counts align on shared column rails

- **WHEN** the head views the Period Summary with several leads of differing
  counts
- **THEN** each count column (products, current, next, risks, decisions,
  priorities) lines up vertically across all lead rows
- **AND** the Remind / Revoke action renders fully without being clipped at the
  card edge

#### Scenario: the head views the Period Summary at standard width

- **WHEN** the head opens `/head/dashboard` at a standard desktop width
- **THEN** the Period Summary fits inside its card with no horizontal scrollbar
- **AND** its rows read as rounded cards in the idiom of the surrounding
  dashboard cards, not a square-ruled table

#### Scenario: the Period Summary matches the Blocked & At Risk treatment

- **WHEN** the head views the Period Summary and the Blocked & At Risk list on
  the same dashboard
- **THEN** the Period Summary rows use the same rounded-card row treatment as the
  Blocked & At Risk rows (rounded surface, soft border, gap-separated)
- **AND** each lead's status, counts, and action stay legible without a
  horizontal table

#### Scenario: per-lead action gating is preserved

- **WHEN** a lead card renders for a draft lead with `canSendReminder` true
- **THEN** the card offers the Remind action
- **AND** a submitted lead card offers Revoke, and a row with neither shows a
  neutral placeholder — the same gating the prior table applied

## ADDED Requirements

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
