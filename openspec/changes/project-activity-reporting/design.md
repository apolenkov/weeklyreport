# Design — project-activity-reporting

MVP. A stage-less reporting unit beside Products. Grilled + adversarially verified
(2026-06-30). Locked forks: admin-provisioned; **M:M** lead attachment; **no**
product-health rollup.

## Data model

- `ProjectActivity { id, name, groupId (req, authoritative), projectId? (label-only),
jiraAccounts String[], archived }`.
- `ProjectActivityLead { activityId, leadId }` — M:M attachment (unique pair).
- `ActivityStatus { id, reportSectionId, activityId, status TrafficLightStatus?, note? }`,
  unique `(reportSectionId, activityId)`. Mirrors `ProjectStatus`; child of
  `ReportSection`.
- FK naming follows Item/Risk/ProjectStatus (`projectId`), NOT Decision's `productId`
  outlier.

## Why a new entity, not reused Item/Risk

Item/Risk write schemas require ≥1 SDLC stage (`enforce-item-decision-stage-schema`,
`require-risk-stage`). Reuse would force softening a load-bearing invariant and add
null-stage branching across every stage-driven read path. A minimal own entity is
cleaner. **ADR-worthy.**

## Namespace + scope (adversarial-caught)

- `activity.*` is ALREADY the live-status feed (`trpc.router.ts:2503`) — admin CRUD
  uses **`projectActivity.*`**.
- `ActivityStatus` is a pure section child row read through the section author — do NOT
  add a separate `activity.groupId` read filter (the `repository-scope-guard` is keyed
  on `productIds`, which an activity has none of). Constrain attachment to the group at
  write; validate each written `activityId` is attached/seeded for the section (the
  `saveSection` delete-recreate currently trusts client ids — same gap as C6).
- Seed `green` (mirror `ProjectStatus`'s `DEFAULT_PROJECT_STATUS`), not null.

## Required MODIFIED follow-ups (author at implementation, exact headers in hand)

- `period-dual-state` — append `activityStatus` to the scenario enumerating the child
  rows a lead save writes ("…item / risk / decision / projectStatus / stageStatus
  rows only"), so the new write is not read as a dual-state violation.
- `head-report-visibility` — the assembled report + the `publishedSnapshot` builder
  include activities (snapshot read tolerant of older rows). This is the one non-trivial
  integration; the `weeklyReportReadModelSchema` gets a `.default([])` activities field.
- `status-slide-rendering` — a minimal activity status-pill lane (reference
  `slide-capacity-signals`/`head-slide-density` for many-activities overflow).

## ADRs (next free = 0011)

- Project Activity gets its own minimal status entity, not reused Item/Risk.
- (No-rollup is now a locked decision) activity status is independent of linked-product
  health — record so a future reader doesn't expect worst-of.
- M:M lead attachment (the chosen cardinality) — many leads report one activity.

## Out of scope

Jira integration; items/risks/decisions/stages on an activity; carry-over of status
(seeded fresh); product-health rollup; portfolio/escalation contribution; per-record
review comments on activities (C1 locked to Item/Risk/Decision — C1's per-section
verdict still covers a section incl. its activities); rich slide layout; lead
self-service creation; activity search.
