## 1. Analytics — exclude reopened periods from the published floor

- [ ] 1.1 `apps/api/src/modules/analytics/analytics.prisma-repository.ts:31`:
      change `PUBLISHED_FLOOR` from `{ status: 'published' as const }` to
      `{ status: 'published' as const, periodStatus: 'published' as const }`
      so a reopened report (legacy `status` still `'published'`, but
      `periodStatus: 'reopened'`) no longer qualifies for `trafficLightHistory`
      (query at `analytics.prisma-repository.ts:57-77`, section filter at
      `:54`), `leadVelocity` (query at `:110-128`), or `periodComparison`
      (query at `:163-181`, section include at `:174`)
- [ ] 1.2 `apps/api/src/modules/analytics/analytics.prisma-repository.ts:27-29`:
      fix the stale comment ("identical to `ArchivePrismaRepository.PUBLISHED_FLOOR`")
      — state the actual relationship: archive's floor
      (`archive.prisma-repository.ts:42`) additionally requires
      `archived: true` and reads only the frozen snapshot; analytics reads
      live sections and now additionally requires `periodStatus: 'published'`
- [ ] 1.3 `apps/api/src/modules/analytics/analytics.prisma-repository.test.ts`:
      add a case per method — seed a report with `status: 'published'`,
      `periodStatus: 'reopened'`, and a section edited after reopen; assert
      `trafficLightHistory`, `leadVelocity`, and `periodComparison` each
      exclude that report/period entirely while reopened, and that the same
      report reappears once `periodStatus` is set back to `'published'`

## 2. PDF export — exclude reopened periods from export eligibility

- [ ] 2.1 `apps/api/src/modules/pdf-export/pdf-export.prisma-repository.ts:49`:
      change `getPublishedReport`'s `where` clause from
      `{ id: reportId, status: 'published' }` to
      `{ id: reportId, status: 'published', periodStatus: 'published' }`, so a
      reopened report resolves to `null` (mirrors the same guard
      `weekly-report.prisma-repository.ts:84-86` already uses to gate the
      snapshot read)
- [ ] 2.2 `apps/api/src/modules/pdf-export/pdf-export.prisma-repository.test.ts`:
      add a case — a report with `status: 'published'`,
      `periodStatus: 'reopened'` makes `getPublishedReport` return `null`
- [ ] 2.3 `apps/api/src/modules/pdf-export/pdf-export.service.ts:94`: confirm
      (via test, no code change expected) that `requestPdfExport` throws
      `PdfExportDomainError("PDF export requires a published report.")` and
      enqueues no job when `getPublishedReport` returns `null` for a
      reopened report
- [ ] 2.4 `apps/api/src/modules/pdf-export/pdf-export.service.test.ts`: add
      the case from 2.3
- [ ] 2.5 `apps/web/src/features/pdf-export/ui/use-pdf-export-job.ts:116-117`:
      change `isExportable` from
      `periodStatus === 'published' || periodStatus === 'reopened'` to
      `periodStatus === 'published'`, so the Export PDF control is disabled
      (not enabled-then-erroring) while a period is reopened
- [ ] 2.6 Add/extend a web unit test (`use-pdf-export-job.test.ts` or the
      existing `export-pdf-button` test) asserting the export control is
      `disabled` when `periodStatus === 'reopened'`

## 3. Spec deltas

- [ ] 3.1 `openspec/specs/analytics-query-correctness/spec.md`: ADD a
      requirement that published-floor analytics queries exclude reopened
      periods
- [ ] 3.2 `openspec/specs/pdf-export-integrity/spec.md`: ADD a requirement
      that PDF export eligibility (backend read model + `requestPdfExport` +
      the web `isExportable` gate) excludes reopened periods

## 4. Gates and verification

- [ ] 4.1 `pnpm --filter @customreport/api db:generate`
- [ ] 4.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 4.3 `openspec validate fix-reopen-legacy-status-read-model-leak --strict`
