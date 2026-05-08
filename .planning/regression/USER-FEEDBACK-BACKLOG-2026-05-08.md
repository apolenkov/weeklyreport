# User Feedback Backlog - 2026-05-08

Purpose: preserve the current-session UAT findings as executable work, so the
next regression pass does not rediscover the same gaps from chat/screenshots.

## Priority Map

```text
▲ P0
  UFB-001 admin product stage reassignment does not replace assignee
  UFB-002 reporting scope must use StageAssignment, not Product.owner
  UFB-003 submit validation must ignore products/stages not assigned to author
  UFB-004 unauthenticated pages must redirect to landing/login, not skeleton hang

  P1
  UFB-010 empty products muted/collapsed/non-expandable in weekly report
  UFB-011 weekly/head layouts need top spacing; no header/content merging
  UFB-012 remove misleading Collapse/Toggle controls when content is empty
  UFB-013 Activity This Period vs Lead Reports duplicated semantics
  UFB-014 current/next/risk/decision/priority items need optional multi-SDLC stages
  UFB-015 author/owner fields in modals must be read-only/defaulted
  UFB-016 admin settings must model reporting groups cleanly
  UFB-017 all list forms need search
  UFB-018 reminders tab must expose real configuration, not only queue/status
  UFB-019 Action Log must be understandable and useful for support/debug
  UFB-020 logs must capture Unexpected error with cause/correlation id

▼ P2
  UFB-030 base wipe mode for manual UAT
  UFB-031 Grafana/Prometheus/logging onboarding docs and dashboard links
  UFB-032 richer background/surface tokens and UI review batch
```

## Items

### UFB-001 - Admin stage reassignment

Status: done

User signal:

```text
/admin?tab=products
DevOps-инструменты
Testing: changing Igor -> Maria does not update
Check logs and Action Log
```

Implementation:

```text
StageAssignment unique key:
old: userId + stageId + projectId
new: stageId + projectId

saveStageAssignment:
replace userId for existing project/stage row
```

Regression:

```text
apps/web/e2e/regression/admin-stage-reassignment.spec.ts
.planning/regression/evidence/2026-05-08-admin-stage-reassignment/README.md
.planning/regression/evidence/2026-05-08-admin-groups-stage-reassignment/README.md
```

### UFB-002 - Reporting scope source of truth

Status: verify_existing

Rule:

```text
Report forms and submit validation use StageAssignment.
Product owner is metadata/future notification target only.
```

Regression needed:

```text
lead author sees only products/stages assigned by StageAssignment
owner-only product is not required for submit
head report can show owner metadata without expanding author scope
```

### UFB-003 - Submit validation by assigned stage only

Status: open

Bug class:

```text
User with no assigned stages on a product should not be blocked by that product.
At-risk/blocked validation applies only to assigned stages in author scope.
```

Regression needed:

```text
lead with DevOps stages only submits without Security Gateway content
stage status/risk validation ignores unassigned products
```

### UFB-004 - Auth/no-cookie redirect

Status: open

Bug class:

```text
/head/dashboard without valid cookie can hang on skeleton.
Expected: landing/login/dev-login flow, not infinite loading.
```

Regression needed:

```text
empty browser context -> /head/dashboard -> redirected or actionable auth state
no long-lived skeleton after request failure
```

### UFB-010 - Empty products visual behavior

Status: partially_done_needs_live_verification

Rule:

```text
No content product:
muted grey card
collapsed by default
not expandable
no hover jump under section header
```

Regression needed:

```text
weekly report portfolio overview with empty products
assert no expand affordance / disabled state
assert stable bounding boxes on hover
```

### UFB-011 - Layout top spacing

Status: open

Screens/user signal:

```text
Content sticks to header/top in head/report and weekly report views.
Cards/sections need consistent top offset.
```

Regression needed:

```text
visual bounding-box assertions:
section top >= header bottom + token spacing
modal/content controls do not overlap
```

### UFB-012 - Collapse/Toggle controls

Status: open

Rule:

```text
Do not show Collapse all / Toggle all when there is nothing meaningful to expand.
If all products are empty, control is hidden or disabled with clear semantics.
```

### UFB-013 - Dashboard sections semantics

Status: open

Decision needed:

```text
Activity This Period -> Submission Activity
Lead Reports -> Reports With Content
Avoid two sections linking to the same empty form.
```

### UFB-014 - SDLC stage selection on report items

Status: open

Rule:

```text
Current Week, Next Week, Risks, Decisions, Priorities:
stage selection optional
if omitted -> applies to all relevant stages
if selected -> allow multi-select and display selected stage chips
```

### UFB-015 - Modal author/owner fields

Status: open

Rule:

```text
Owner/author is derived from current user or directory.
Do not free-text edit author fields in item/risk/decision modals.
```

### UFB-016 - Admin reporting groups/departments

Status: done

Rule:

```text
Use product term: groups.
Admin must have a Groups form/list to create and maintain groups.
Users must choose from existing groups; no free-text department input.
Head is scoped to one group unless multi-group access is explicitly added later.
Settings should not hard-code CustomReport copy.
```

Implementation/evidence:

```text
Prisma model: ReportingGroup
Admin tab: /admin?tab=groups
Users tab: group select from existing groups, no free-text department field
Settings tab: report header defaults only
Regression: apps/web/e2e/regression/admin-groups.spec.ts
Evidence: .planning/regression/evidence/2026-05-08-admin-groups-stage-reassignment/README.md
```

### UFB-017 - Search everywhere lists exist

Status: partially_done

Known:

```text
Products had search.
Users/reminders/jobs/actions were updated recently.
Need verify all current and future list surfaces.
```

### UFB-018 - Reminders config

Status: partially_done

Bug class:

```text
/admin?tab=reminders showed no real configuration.
Dashboard reminder action complained: No active reminder rule for this period.
```

Regression needed:

```text
create active reminder rule
dispatch reminder for current period
queue row / action log visible
no misleading empty config
```

Current:

```text
/admin?tab=reminders now exposes Add Rule form, report period selector, type, fireAt, timezone, active/paused rules, search.
Remaining gap: full dispatch/queue/action-log regression for dashboard Send Reminder.
```

### UFB-019 - Action Log clarity

Status: partially_done

Rule:

```text
Show user actions with procedure/status/reference.
Hide internal proof calls.
Make labels understandable for support.
```

Regression needed:

```text
admin.saveStageAssignment mutation appears after stage change
admin.updateSettings appears after settings save
manual-action-log-proof rows hidden
```

### UFB-020 - Log coverage for Unexpected error

Status: partially_done_needs_audit

Rule:

```text
Frontend error toast/log must carry correlation id.
Backend tRPC error logs must include cause code/meta without leaking payloads.
```

Regression needed:

```text
force weeklyReport.get failure
assert UI reference id
assert backend log has procedure + cause + correlationId
```

### UFB-030 - Base wipe mode

Status: done

Rule:

```text
Manual UAT wipe preserves:
users, roles, products, stages, group/settings

Manual UAT wipe clears:
reports, report sections, content items, risks, decisions, priorities,
and possibly StageAssignment depending on chosen demo/base variant
```

Decision:

```text
base-empty should clear StageAssignment
demo-ready can keep StageAssignment
User decision 2026-05-08: base-empty clears StageAssignment.
```

Implementation:

```text
prisma/wipe-manual-uat.ts deletes stageAssignments and preserves users/products/stages/settings.
```

### UFB-031 - Observability docs

Status: in_progress

Rule:

```text
README/onboarding must explain:
Grafana login/password
dashboard URLs
Prometheus metrics URL
logs location
how to debug failed weekly report load
```

### UFB-032 - UI background/surface tokens

Status: open

Rule:

```text
Make background calmer but richer than flat beige.
Use surface tokens, not ad-hoc one-off colors.
Run design review against screenshots and domain workflows.
```

Skill/review sources:

```text
.planning/regression/UI-REVIEW-2026-05-07.md
.planning/reports/UI-REVIEW-2026-05-07.md
.planning/phases/17-ui-redesign/17-UI-REVIEW.md
.planning/phases/39-performance/39-UI-REVIEW.md
.planning/regression/UI-UX-FULL-REVIEW-PLAN-2026-05-08.md
requested skills:
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
```

Current review lanes:

```text
.planning/regression/review-lanes/2026-05-08-ui-design-lane.md
.planning/regression/review-lanes/2026-05-08-ui-styling-typography-lane.md
.planning/regression/review-lanes/2026-05-08-security-accessibility-lane.md
```
