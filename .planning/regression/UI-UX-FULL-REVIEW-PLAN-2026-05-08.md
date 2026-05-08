---
date: 2026-05-08
status: working-plan
scope: full-ui-ux-review
---

# Full UI/UX Review Plan

Purpose: preserve the requested skill-based review strategy and turn current
manual feedback into executable batches. This is not a PASS report.

## Skill Lenses Used

```text
frontend-design
bencium-controlled-ux-designer
ui-ux-pro-max:ckm:design
ui-ux-pro-max:ckm:ui-styling
design-audit
gsd-ui-review
security-audit
typography:ui-typography
ui-ux-pro-max:ui-ux-pro-max
web-design-guidelines
Demo-design
Demo-review
```

Fresh `web-design-guidelines` were fetched from:

```text
https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
```

## Review Factory

```text
[route inventory]
  -> [domain model inventory]
  -> [deterministic grep scanners]
  -> [skill review lanes]
  -> [file:line findings]
  -> [dedupe]
  -> [P0/P1 fix batches]
  -> [Playwright/API evidence]
```

Parallel lane attempt:

```text
ui_review_design_lane
ui_review_styling_lane
ui_review_security_lane
```

These agents ended without writing their assigned lane files, so their results
are not counted as evidence. The next run should use a CSV/job harness with
required `report_agent_job_result` or a stricter output-file guard.

## Current Verified Fixes

```text
UFB-001 admin stage reassignment: PASS
UFB-016 reporting groups/users: PASS
UFB-030 base-empty wipe clears StageAssignment: implemented
```

Evidence:

```text
.planning/regression/evidence/2026-05-08-admin-groups-stage-reassignment/README.md
.planning/regression/agent-c-test-results/results.json
```

## Findings

▲ P0

- No active P0 in the verified admin groups/stage slice after the latest
  Playwright run.

▲ P1

- `apps/web/src/components/admin/reminders-tab.tsx:93` - `Send Now` is visual-only; it does not call the backend dispatch path. Needs a real mutation or removal until wired.
- `apps/web/src/components/admin/reminders-tab.tsx:157` - reminder config now exists, but there is no live regression proving Dashboard reminder dispatch -> queue/action-log.
- `apps/web/src/components/admin/action-log-tab.tsx:81` - UI still renders raw backend error text. Needs stable support reference/correlation-id UX.
- `apps/web/src/components/admin/action-log-tab.tsx:117`, `apps/web/src/components/admin/groups-tab.tsx:167` - repeated hardcoded hover surface `#f8f6f2`; move to shared surface token batch.
- `apps/web/src/components/admin/groups-tab.tsx:215`, `apps/web/src/components/admin/reminders-tab.tsx:240` - repeated empty-state `#fafaf7`; move to shared empty-surface token.
- `apps/web/src/components/admin/groups-tab.tsx:191`, `apps/web/src/components/admin/groups-tab.tsx:200` - ad-hoc rgba borders/colors; token batch should define button border/hover variants.
- `apps/web/src/components/admin/settings-tab.tsx:53` - Settings copy is now generic, but product decision remains: group membership lives in Groups; settings must stay report-defaults only.

▼ P2

- Search placeholders in admin were normalized to `…` in the current slice; keep this as a regression rule for all future list forms.
- Decorative SVGs in new admin groups/reminders controls were marked `aria-hidden`; extend this sweep across older admin buttons.
- Full background/surface direction remains open: use richer operational surfaces, not decorative gradients/orbs.

## Background Direction

Recommended: `Operational Ledger`.

```text
canvas       | calm cool off-white / green-gray
work-band    | subtle full-width route section surface
card         | white / near-white, one-level only
empty-card   | muted gray-green, disabled semantics
state color  | green/gold/red + SDLC accents only
texture      | optional ruled-paper/grid at very low contrast
```

Rejected for this product:

```text
marketing hero
decorative gradient mesh
orbs/bokeh blobs
nested cards
one-note beige-only theme
```

## Regression Expansion

```text
roles:
  lead, head, admin, viewer

domains:
  groups, users, products, stageAssignments, periods,
  leadReports, weeklyReport, currentItems, nextItems,
  risks, decisions, priorities, reminders, pdf, archive,
  activity, actionLog, observability

checks per scenario:
  route -> role -> state -> mutation -> reload -> actionLog -> screenshot
```

## Next Batches

```text
Batch A: reminder dispatch proof
  - wire or remove Send Now in admin reminders
  - regression: create rule -> dashboard send -> queue/action log

Batch B: error/correlation-id UX
  - force failed weekly report load
  - UI shows reference id
  - backend log has procedure + cause + correlationId

Batch C: surface token system
  - replace #f8f6f2 / #fafaf7 / rgba button borders
  - screenshot diff desktop+mobile

Batch D: full role-domain matrix
  - separate browser contexts by role
  - wipe mode before each group
  - screenshot + console/network capture
```
