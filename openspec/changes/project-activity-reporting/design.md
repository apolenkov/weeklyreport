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

## Cross-capability deltas — disposition (resolved 2026-06-30)

Discriminator applied: author an external MODIFIED delta only where the existing
capability requirement, read in isolation after this change ships, becomes
**contradictory** — not merely incomplete. Where this change's OWN spec already owns
the behavior, the single-home is the more exemplary outcome (two specs asserting the
same rule is its own drift hazard).

- `period-dual-state` — **AUTHORED** (`specs/period-dual-state/spec.md`). Its
  "Atomic Dual-State Write" scenario lists the child rows a lead save writes
  ("…`projectStatus` / `stageStatus` rows **only**") — "only" is exhaustive, so adding
  `activityStatus` makes that list affirmatively wrong without the delta. The delta
  appends `activityStatus` to the enumeration.
- `head-report-visibility` — **SKIPPED (subsumed).** This change's own requirement
  "Activities Are Visible to the Head/Viewer but Do Not Roll Up" already owns
  head/viewer visibility + "published snapshot includes activities" + "read path
  tolerates older snapshots". The existing `head-report-visibility` requirement ("the
  head sees every section's content") does not become contradictory — activities are
  section content. A MODIFY of that requirement would also collide with C1
  (`review-acknowledgement`), which modifies the same requirement for the
  submitted-only default. Implementation note: wire `weeklyReportReadModelSchema` to a
  `.default([])` activities field — code change, no spec delta needed.
- `status-slide-rendering` — **SKIPPED (not locked / out of scope).** A slide
  activity-pill lane is not in `decisions-locked` and this change's "Out of scope"
  excludes rich slide layout. Author a minimal lane delta only if Саша locks
  activity-on-slide rendering as in-scope.

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
