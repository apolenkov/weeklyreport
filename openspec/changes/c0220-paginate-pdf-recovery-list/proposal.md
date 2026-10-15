# Proposal

## Why

C0220: `admin.jobs.listPdfRecovery` reads every `failed` and `recovery_required`
PDF export row with an unbounded `findMany` and returns the whole set in one
response. Export rows are never pruned, so the set only grows with failed
exports, and the service signature has no way to pass a limit or a cursor —
unlike the DLQ list, which pages at 50 rows (maximum 200). A bare `take` would
hide actionable rows, which the recovery requirement forbids, so the list needs
a page contract with a continuation.

Backlog: TASK-503 (implementation queue 008, C0220). Source report:
`task-503/wave3/claude-D-C0220/REPORT.md` (external evidence archive).

## What Changes

- `admin.jobs.listPdfRecovery` takes an optional `{cursor, limit}` input and
  returns `{jobs, nextCursor}`. Default page 50 rows, maximum 200, ordered by
  `createdAt` then `jobId` ascending. The cursor is the last row's
  `{createdAt, jobId}`; the next page starts strictly after it, so a row that
  leaves the set (for example after a retry) does not shift later pages.
- The Head recovery panel loads pages on demand ("Load more") and shows a total
  only once every page is loaded.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pdf-export-integrity`: the DB-backed recovery list is paginated with a
  continuation cursor.

## Impact

`packages/shared/src/schemas/admin/report-admin.schema.ts`,
`apps/api/src/bootstrap/jobs-service.ts`,
`apps/api/src/modules/admin/jobs.service.ts`,
`apps/api/src/infrastructure/trpc/routers/admin/ops.procedures.ts`,
`apps/web/src/features/pdf-export/ui/pdf-recovery-section.tsx` and their
colocated tests.

## Non-goals

- Retention or deletion of old `PdfExportJob` rows: a separate task awaiting a
  retention policy; nothing is deleted here.
- Retry input/outcomes, Head-only authorization and the listed item fields stay
  unchanged.
