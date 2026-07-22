## Why

From the 2026-07-22 mass review (`review-data.json` → `confirmedMajors`,
group "Period reopen leaks live content through legacy-status read models",
`final-backlog.json`).

Root cause: `buildTransition("reopen", ...)`
(`apps/api/src/modules/period/domain/period-transition.ts:162-173`) is an
intentionally asymmetric transition — it flips `periodState` back to `open`
(editable again) and stamps `periodStatus: 'reopened'`, but deliberately
leaves the legacy `status` field at `'published'` (the comment at :163-166
calls this out explicitly). That asymmetry is correct for the writers that
already know about `periodStatus` (e.g. `weekly-report.prisma-repository.ts:84-103`,
which only serves the frozen `publishedSnapshot` when
`periodStatus === 'published'` and otherwise falls through to the live,
mutable read path).

Two other read models never learned that lesson: they still floor on the
legacy `status === 'published'` field alone, so a reopened report — legacy
`status` still `'published'`, but editable — passes their "is this
published" check and serves LIVE mutable content instead of the frozen
snapshot:

- **Analytics** (`apps/api/src/modules/analytics/analytics.prisma-repository.ts:31`):
  `PUBLISHED_FLOOR = { status: 'published' }` has no `periodStatus` guard and
  reads live `include: sections` (not `publishedSnapshot`). `trafficLightHistory`
  (query built at :57-77, section filter assembled at :54) and `periodComparison`
  (query at :163-181, section include at :174) apply no section-status filter
  either, so during (or after an abandoned) reopen window, in-progress edits to
  a period's sections retroactively alter its historical "published" analytics
  — trend charts and cross-period comparisons for an already-published period
  can change while nobody re-publishes anything. The repository's own comment
  at :27-29 ("identical to `ArchivePrismaRepository.PUBLISHED_FLOOR`") is
  factually wrong: the archive floor (`archive.prisma-repository.ts:42`) also
  requires `archived: true` and only ever reads the snapshot, so it does not
  share this leak.
- **PDF export** (`apps/api/src/modules/pdf-export/pdf-export.prisma-repository.ts:49`):
  `getPublishedReport` gates on `where: { status: 'published' }` and
  `pdf-export.service.ts:94`'s `requestPdfExport` only re-checks
  `report.status !== 'published'`, so a reopened report still passes. The web
  eligibility check compounds it: `use-pdf-export-job.ts:116-117`'s
  `isExportable` explicitly treats `'reopened'` as exportable. The repository
  then assembles the PDF from live sections (`reportFullInclude` at :38-41,
  the same live-join shape `weeklyReport.get` uses on its non-snapshot
  branch) — never `publishedSnapshot`. Net effect: a head can generate and
  download a PDF stamped as the published record of a period while it
  contains live, possibly-unfinished edits made during the reopen window,
  and that PDF's content can silently diverge from what the viewer surface
  serves for the same report id once `periodStatus` flips back to
  `'published'` on re-publish.

Both violate the same invariant: **a published report's externally-visible
read models must reflect the frozen `publishedSnapshot`, not live mutable
state, for as long as `periodStatus !== 'published'`.** Same seam
(period dual-state), same shape of fix, so tracked as one change.

## What Changes

- **Analytics** — `PUBLISHED_FLOOR` in `analytics.prisma-repository.ts` gains
  a `periodStatus: 'published'` guard alongside the existing legacy
  `status: 'published'` floor, so a reopened report's reports/sections drop
  out of `trafficLightHistory`, `leadVelocity`, and `periodComparison` for the
  duration of the reopen window (they reappear once the head re-publishes and
  `periodStatus` returns to `'published'`). The stale "identical to
  `ArchivePrismaRepository.PUBLISHED_FLOOR`" comment is corrected to state the
  actual difference (archive additionally requires `archived: true` and reads
  the frozen snapshot; analytics reads live sections and now additionally
  requires `periodStatus: 'published'`).
- **PDF export** — `getPublishedReport`'s `where` clause in
  `pdf-export.prisma-repository.ts` gains the same `periodStatus: 'published'`
  guard, so a reopened report is treated as not-yet-published for export
  purposes (mirrors `weeklyReport.get`'s snapshot gate exactly). `requestPdfExport`
  in `pdf-export.service.ts` continues to throw `PdfExportDomainError` when
  the repository returns nothing — no new backend branch needed, the existing
  null-check now also catches reopened reports. The web `isExportable` check
  in `use-pdf-export-job.ts` drops `'reopened'` so the Export PDF control is
  disabled (not silently 500-erroring) while a period is under a reopen.

Neither slice restructures the two modules to consume `publishedSnapshot`
directly — that would be a larger, separately-scoped rework (see Non-goals).
The fix chosen here is the minimal one that stops the leak: withhold a
reopened period from both read models until it is genuinely re-published
again, exactly matching the trust boundary `weekly-report.prisma-repository.ts`
already enforces.

## Non-goals

- Not rewriting `analytics.prisma-repository.ts` or
  `pdf-export.prisma-repository.ts` to read `publishedSnapshot` instead of
  live sections for the steady-state (non-reopened) published case — today's
  live-read is safe once a period is genuinely immutable (`periodStatus ===
'published'` and no edit path is open), so switching the data source is an
  unrelated, larger consistency project, not required to close this leak.
- Not adding a section-level status filter to `trafficLightHistory`'s or
  `periodComparison`'s `include.sections.where` (parity with `leadVelocity`'s
  `status: 'submitted'` filter) — moot once `PUBLISHED_FLOOR` excludes
  reopened reports, since no editable report reaches that include block
  anymore.
- Not changing what a head sees while actively on the reopen screen (the
  live/editable surface itself) — this change only affects the read-only
  historical/export surfaces (analytics trends, PDF export) that are supposed
  to reflect the frozen published record.
- Not touching the `reopen` transition itself
  (`period-transition.ts:162-173`) — its asymmetry (legacy `status` left at
  `'published'`) is intentional and documented; the bug is downstream readers
  trusting that stale field alone.

## File manifest

- `apps/api/src/modules/analytics/analytics.prisma-repository.ts` —
  `PUBLISHED_FLOOR` (line 31) + stale comment (lines 27-29)
- `apps/api/src/modules/analytics/analytics.prisma-repository.test.ts` —
  new cases per finding
- `apps/api/src/modules/pdf-export/pdf-export.prisma-repository.ts` —
  `getPublishedReport` `where` clause (line 49)
- `apps/api/src/modules/pdf-export/pdf-export.prisma-repository.test.ts` —
  new case
- `apps/api/src/modules/pdf-export/pdf-export.service.ts` — no code change
  expected (existing null-check at :94 already handles the now-excluded
  reopened case); confirm via test
- `apps/api/src/modules/pdf-export/pdf-export.service.test.ts` — new case
- `apps/web/src/features/pdf-export/ui/use-pdf-export-job.ts` — `isExportable`
  (lines 116-117)
- `apps/web/src/features/pdf-export/ui/use-pdf-export-job.test.ts` (or
  equivalent existing export-button test) — new case
- `openspec/specs/analytics-query-correctness/spec.md` — ADDED requirement
- `openspec/specs/pdf-export-integrity/spec.md` — ADDED requirement

## Verification

- `pnpm --filter @customreport/api db:generate && pnpm typecheck && pnpm lint && pnpm test`
- `openspec validate fix-reopen-legacy-status-read-model-leak --strict`
- Manual/targeted:
  - Seed a published report, reopen it, edit a section's content, then call
    `trafficLightHistory` / `leadVelocity` / `periodComparison` for that
    period — assert none of the newly-edited content appears while
    `periodStatus === 'reopened'`.
  - Seed a published report, reopen it, call `requestPdfExport` for it —
    assert `PdfExportDomainError` ("PDF export requires a published report.")
    is thrown and no job is enqueued.
  - Load the Export PDF control for a reopened period in the UI — assert it
    renders disabled, not enabled-then-erroring.

## Sequencing

Standalone. No dependency on the other six 2026-07-22 mass-review groups —
this fix touches only `analytics.prisma-repository.ts`,
`pdf-export.prisma-repository.ts`/`.service.ts`, and `use-pdf-export-job.ts`,
none of which the other groups (Fill From locking, archive visibility,
portfolio snapshot miscounts, admin snapshot restore, product-code defects,
test-quality hardening) touch.
