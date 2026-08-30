# Project Activities attach to many leads

**Status:** accepted and implemented.

Activity-to-lead attachment is many-to-many through
`ProjectActivityLead { activityId, leadId }` with a unique pair. Each attached
lead writes an independent `ActivityStatus` through the lead's own
`ReportSection`. A lead sees and can write only activities attached to that
lead; the server validates attachment and never trusts the client payload.

The `(reportSectionId, activityId)` uniqueness constraint prevents duplicate
statuses. Changing staffing changes attachments, not the activity's
authoritative group.
