## ADDED Requirements

### Requirement: PDF export eligibility excludes reopened periods

`PdfExportPrismaRepository.getPublishedReport` MUST require both the legacy
`status: 'published'` field AND `periodStatus: 'published'` in its `where`
clause, so a report that is legacy-`published` but currently `periodStatus:
'reopened'` (editable again) resolves to `null`. `PdfExportService.requestPdfExport`
MUST reject the request (`PdfExportDomainError`, no job enqueued) whenever
`getPublishedReport` returns `null`, which now includes the reopened case.
The web export control's `isExportable` check MUST agree with this gate —
`true` only when `periodStatus === 'published'`, never when
`periodStatus === 'reopened'` — so the control is disabled during a reopen
window instead of enqueuing a request the backend will reject.

#### Scenario: requestPdfExport rejects a reopened report

- **GIVEN** a report with legacy `status: 'published'` and
  `periodStatus: 'reopened'`
- **WHEN** `requestPdfExport` is called for that report
- **THEN** it throws `PdfExportDomainError`
- **AND** no export job is enqueued

#### Scenario: A PDF already requires the live/frozen boundary the viewer enforces

- **GIVEN** the same report id
- **WHEN** `weeklyReport.get` would serve the live (non-snapshot) branch
  because `periodStatus !== 'published'`
- **THEN** `PdfExportPrismaRepository.getPublishedReport` for that same
  report id also returns `null`, so the PDF export surface and the viewer
  surface agree on whether the period counts as published

#### Scenario: The web export control is disabled while a period is reopened

- **GIVEN** a report whose `periodStatus` is `'reopened'`
- **WHEN** the Export PDF control renders for that report
- **THEN** `isExportable` evaluates `false`
- **AND** the control is disabled rather than triggering a request the
  backend will reject

#### Scenario: A genuinely published (never reopened, or re-published) report remains exportable

- **GIVEN** a report with `status: 'published'` and `periodStatus: 'published'`
- **WHEN** `requestPdfExport` is called for that report
- **THEN** the request proceeds (subject to the existing group-scope check)
