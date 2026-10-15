# Proposal

## Why

The lead status overview and the lead-form editor it composes both
subscribe to `reports.getActive` and each registers the shared query-error
handler for it. One failed active-report load therefore produced two toasts
and two client-error log entries (C4909, 008 BATCH07B). The shared handler
only deduplicates within one hook instance.

## What Changes

- A page that composes several owners of the same query reports one failure
  of that query once. The status overview stops registering its own
  `reports.getActive` handler; the editor's handler stays the owner.
- Query roles, data and retry behaviour are unchanged.

## Capabilities

### client-error-policy

ADDED: one query failure is reported once per page surface.

## Impact

`apps/web/src/features/report-pages/ui/lead/shell/lead-status-overview.tsx`
and a new colocated test.
