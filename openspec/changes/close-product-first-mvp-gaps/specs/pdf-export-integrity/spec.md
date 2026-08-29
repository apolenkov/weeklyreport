## ADDED Requirements

### Requirement: Successful PDF delivery creates no blank browser tab

The PDF export React action in `ExportPdfButton`
(`apps/web/src/features/pdf-export/ui/export-pdf-button.tsx`) MUST remain in
the current page and MUST NOT create a temporary browser tab. After a
completed owned job returns a valid artifact URL, it MUST attempt one
same-origin attachment download and MUST expose a persistent fallback
download link. The artifact link MUST use the canonical relative
`/pdfs/{jobId}.pdf` path and resolve to the current page's origin. Re-running
the completion effect for the same job MUST NOT attempt a second download. The
generating spinner MUST use a CSS animation with a reduced-motion override and
MUST NOT use inline animation. Failed jobs MUST return the export control to a
retryable error state without creating a tab.

#### Scenario: Completed artifact is delivered in the current page

- **WHEN** a completed owned PDF job returns a valid artifact URL
- **THEN** one attachment download is attempted, no browser tab is opened,
  and the visible fallback link exposes the same artifact URL

#### Scenario: Automatic download is suppressed

- **WHEN** browser policy suppresses the automatic attachment download
- **THEN** the user can still activate the visible fallback download link
  without restarting the export job

#### Scenario: Export fails

- **WHEN** job creation or status polling reaches a terminal error
- **THEN** no browser tab exists and the export control returns to a retryable
  error state
