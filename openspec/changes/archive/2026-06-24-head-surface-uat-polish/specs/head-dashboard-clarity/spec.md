# head-dashboard-clarity Specification

## MODIFIED Requirements

### Requirement: The Period Summary table fits its container without horizontal scroll

The `LeadSummaryTable` ("Period Summary") on the head dashboard MUST render as a
vertical list of per-lead cards (rounded `rounded-lg` cards on a soft surface,
separated by gaps rather than ruled table borders) — NOT as a multi-column ruled
`<table>` — and MUST fit within its card container at standard dashboard width so
no horizontal-scroll affordance appears. Each lead card MUST carry the lead
identity (avatar, name, role) and
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

### Requirement: The Blocked & At Risk issues are grouped into per-product cards

The expanded `BlockedAtRiskTable` MUST cluster its issues into one card per
product, in the report `ProductAccordion` idiom, so a product carrying several
issues shows its name once instead of repeating it on every row. Each product
card header MUST carry an avatar, the product name, a worst-severity status dot
(blocked / at-risk), and the line of contributing assignees. Each issue row MUST
show a left status rail (red for blocked, amber for at-risk), a
stage-over-assignee gutter, the issue description, and a Blocked / At Risk badge
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
  description, and a Blocked / At Risk badge

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
