# Proposal

## Why

C3647: nothing validates period order on the snapshot restore path. Published
and archived rows are exempt from the live range exclusion that keeps open and
scheduled periods ordered, and `assertEndNotBeforeStart` guards only the
administrator write path. A snapshot with `periodEnd` before `periodStart`
therefore restores and is stored as an inverted published period.

## What Changes

- A new restore input schema, `adminSnapshotRestoreSchema`, extends
  `adminSnapshotSchema` and rejects a period row or a `publishedSnapshot`
  whose `periodEnd` is earlier than `periodStart`; equal dates stay valid.
  `saveSnapshot` validates with it before the restore transaction starts,
  including a reopened report's retained publication envelope.
- Read paths are unchanged: `publishedReportSnapshotSchema`,
  `reportPeriodSchema`, the history output schemas and the admin export keep
  accepting an already stored inverted period (owner decision 2026-10-13).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `admin-snapshot-restore`: period order is part of restore input validation.

## Impact

`report-admin.schema.ts`, one shared predicate in
`report-primitives.schema.ts`, and `saveSnapshot` in the API. C3685 (inverted
period in the open work register) is closed by this write-side admission and
a test that pins the read to stay valid.

## Non-goals

- No database CHECK constraint; it needs a migration and native proof and is a
  separate decision.
- No data scan: stored data is not rejected on read.
