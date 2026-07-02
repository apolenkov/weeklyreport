## Why

> Captured from 2026-06-30 demo feedback (cluster C3), grilled + adversarially
> verified. See `docs/feedback/decisions-locked-2026-06-30.md`.

Besides Products (organized by SDLC stage), leads need to report weekly on a
**project activity** — a reporting unit that is like a product but carries **no SDLC
stage**. It may optionally link to a product, may reference one or more Jira accounts
(Jira is not integrated — a plain field), and is reported each week with a simple
status (on-track / risk / block). There is no such concept today, and no Jira/external
field anywhere.

## What Changes

- **New entity `ProjectActivity`** — admin-provisioned (like products): `name`, a
  required authoritative `groupId`, an optional `projectId` (label-only link), and
  `jiraAccounts String[]` (plain text, no integration). Admin CRUD via
  **`projectActivity.*`** procedures on the canonical admin chain (the `activity.*`
  namespace is already taken by the live-status feed — do NOT reuse it).
- **Many leads per activity** — a `ProjectActivityLead` M:M join records which leads
  report on an activity; each attached lead reports their own weekly status.
- **Per-period `ActivityStatus`** — a section child row `{ reportSectionId, activityId,
status TrafficLightStatus?, note? }`, unique `(reportSectionId, activityId)`, seeded
  `green` per attached activity when the lead's section is provisioned. Written through
  the existing lead section-save under the `ReportSection.version` optimistic lock — no
  new period-lifecycle writer.
- **Read/visibility** — the lead form lists only the activities the lead is attached
  to; the head/viewer see group-scoped activities with their status beside products,
  read through the section author (the same path as `ProjectStatus`). The
  `publishedSnapshot` includes activities, with the read path tolerating older
  snapshots lacking the field.
- **No product-health rollup, no portfolio/escalation contribution, not searchable in
  v1** — activity status is independent of the stage-driven product health.

## Capabilities

### New Capabilities

- `project-activity-reporting`: the Project Activity entity, its admin provisioning,
  its M:M lead attachment, and the per-period weekly status (no SDLC stage).

### Modified Capabilities

- (Implementation touch-points captured in `design.md` as required MODIFIED
  follow-ups — `period-dual-state` must append `activityStatus` to its "lead save
  writes these child rows only" enumeration; `head-report-visibility` must surface
  activities in the assembled report + the published snapshot. Authored at
  implementation with the exact requirement headers in hand.)

## Impact

- Schema: `ProjectActivity`, `ProjectActivityLead` (M:M), `ActivityStatus` (child of
  `ReportSection`). MVP DBs disposable — reshape + `migrate reset`.
- API: `projectActivity.*` admin procedures (canonical `adminProcedure`, no new Role);
  activity-status folded into the lead section-save payload; section provisioning seeds
  default statuses; the write path validates each `activityId` is attached/seeded for
  the section (closes the `saveSection` client-trust gap, same shape as C6).
- Web: lead-form activity-status entry; head/viewer activity display; a minimal slide
  status lane.
- Invariants: `period-dual-state` — `ActivityStatus` is a section child row, exempt
  from period writes (append it to the enumeration). `role-coverage-gate` — canonical
  builders only, no new Role.
- Out of scope: Jira integration; items/risks/decisions/stages on an activity;
  carry-over of status (seeded fresh each period); product-health rollup; per-record
  review comments on activities (C1 is locked to Item/Risk/Decision); rich slide
  layout; lead self-service activity creation.
