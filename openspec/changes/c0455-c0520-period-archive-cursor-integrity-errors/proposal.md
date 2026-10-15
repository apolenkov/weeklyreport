# Proposal

## Why

TASK-503.31 (frozen clauses C0455 and C0520). Source report:
`task-503/wave7/011-503.31/REPORT.md` (external evidence archive). Decisions:
008 and Root, 2026-10-15 — C0455 option A (cursor for the archive), C0520 keep
the not-found masking and report broken invariants as internal errors.

C0455: `admin.listPeriodsByState` returns at most `limit` rows (default 50,
maximum 200) with no continuation. The Periods tab calls it without a limit, so
the archive section shows only the 50 newest archived periods. Auto-archive adds
about one period per published week, so older archived periods become invisible
and cannot be unarchived from the UI after roughly a year of use. The source
proves the truncation; the production archive size was not observed.

C0520: the broad `PdfExportDomainError` and `LeadFormDomainError` rows map to
`NOT_FOUND`. Every traced public producer of these classes is a missing or
deliberately masked resource, which stays `NOT_FOUND`. Four branches instead
report a broken stored invariant and would reach the client as a row-removed
404:

- `getPublishedReportForJob`: the job's snapshot names another report or
  publication time;
- `advanceGeneration` and `markRecoveryRequired`: the guarded update misses
  under the row lock after the caller's eligibility check;
- item outcome: the resolved source has no `stableId`.

No producer was found for any of them: the callers check eligibility under the
same lock, the source resolver guards `stableId`, and the column is non-null.

## What Changes

- `admin.listPeriodsByState` takes an optional `cursor` `{periodStart, id}` and
  returns `{periods, nextCursor}`, ordered by `periodStart` then `id`
  descending. The archive section loads further pages on request.
- The four invariant branches throw `PdfExportIntegrityError` and
  `LeadFormIntegrityError`. Neither class is in the domain error table, so the
  client gets the masked `INTERNAL_SERVER_ERROR` ("Unexpected error"). The
  original error stays the logged cause. This follows the module's existing
  `UnsupportedPdfExportStatusError`.

## Out of scope and source limits

- The active bucket keeps its first page only. Published periods leave it
  through auto-archive, so its size is bounded by the auto-archive horizon; no
  UI paging is added for it.
- Other `PdfExportDomainError` throws are unchanged:
  - not-found and masking throws stay `NOT_FOUND`;
  - the completion assertions run only in the worker, not behind tRPC;
  - token signing depends on a secret the env schema validates at startup;
  - the unpublished branch in `requestPdfExport` is unreachable, because the
    repository returns only published rows.
- No blanket catch or status rewrite: the mapper table and its fallback are
  unchanged.
