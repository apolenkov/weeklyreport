# A Project Activity attaches to many leads, each reporting their own status

**Status:** accepted (locked via the demo-feedback grill on 2026-06-30;
implemented — see `openspec/changes/archive/2026-07-02-project-activity-reporting`)

## Context

A Project Activity (ADR 0012) needs an attachment model: who reports its weekly
status? A single owner is the simplest, but cross-cutting work in this department
is routinely shared — Products already support multiple co-owning leads, and the
demo feedback described activities the same way (several leads each speaking to
the same activity from their own angle in the same week).

A one-lead-per-activity model would force the shared case into a single lead's
voice, losing the per-lead picture, or into duplicated activities (one per lead)
that then drift.

## Decision

Activity-to-lead attachment is **many-to-many**:

- A `ProjectActivityLead { activityId, leadId }` join (unique pair) attaches any
  number of leads to an activity.
- Each attached lead reports their **own** `ActivityStatus`, written through their
  own `ReportSection` — exactly like `ProjectStatus`, where each lead's status on
  a shared product is independent.
- A lead's report surface lists **only** the activities they are attached to. The
  write path validates that each written `activityId` is one the section author is
  attached to and seeded for, never trusting the client payload (the same
  client-trust gap C6 closes for stages).

## Consequences

- One activity can carry several independent statuses in a single period, one per
  attached lead — the head/viewer read the full multi-lead picture.
- Attachment is admin-provisioned alongside the activity (ADR 0012); lead rotation
  changes attachments, not the activity's authoritative `groupId`.
- The unique `(reportSectionId, activityId)` constraint keeps one status per lead
  per activity per period; a second write upserts, it does not duplicate.
- Because each status is a section child row, the per-lead independence and the
  group-scoped read both fall out of the existing `ReportSection` ownership model —
  no new scope dimension is introduced.
