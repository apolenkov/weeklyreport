## Why

When an admin in a non-UTC timezone edits an existing reporting period in the
Period management tab (Admin → Periods), the deadline silently drifts. The
create/edit dialog displays the stored UTC deadline in a `datetime-local`
field using UTC wall-clock (`toISOString().slice(0,16)`), but re-parses the
same field on submit with `new Date(deadline)`, which the browser interprets
as **local** time. A UTC+N admin who re-saves an unchanged deadline shifts it
by -N hours on every round-trip. The skew cascades into late-submission
gating and reminder scheduling, which key off the deadline.

## What Changes

- Fix the deadline submit parse in
  `apps/web/src/components/admin/periods-tab-dialog.tsx` to read the
  `datetime-local` value as UTC (append `:00.000Z`), mirroring the
  already-correct `periodStart` / `periodEnd` date parses.
- Fix the second occurrence of the same bug in the in-dialog deadline range
  validation, which parses `new Date(deadline)` as local while comparing it
  against UTC-parsed `periodStart` / `periodEnd` bounds.
- Correct the misleading code comment that claims the round-trip is "stable
  for the typical European admin" — it is stable only at UTC.
- Add a unit test asserting the display→parse round-trip is stable under a
  non-UTC offset.

## Capabilities

### New Capabilities

- `period-management-datetime`: timezone-correct serialization of date and
  datetime inputs in the Period management create/edit dialog. All three
  fields (`periodStart`, `periodEnd`, `deadline`) MUST round-trip as UTC
  wall-clock regardless of the admin's local timezone.

### Modified Capabilities

<!-- None. period-lifecycle-ui governs only the publish/reopen action controls
     and status-enum display; it says nothing about the create/edit form,
     datetime parsing, or the deadline field, so no existing requirement
     changes. -->

## Impact

- Affected code: `apps/web/src/components/admin/periods-tab-dialog.tsx`
  (deadline submit parse + deadline range validation + comment).
- Downstream behavior: deadline-driven late-submission gating and reminder
  scheduling stop drifting for non-UTC admins.
- No schema, API, or shared-contract change; web-only fix.
