## ADDED Requirements

### Requirement: The export button's success signal is gated on artifact delivery

The export button MUST open the result tab synchronously within the
triggering click handler (or via a held-open tab navigated once the
artifact is ready), never from an asynchronous status-poll callback, so
browser popup blockers do not silently discard the open request. This
governs `ExportPdfButton`
(`apps/web/src/features/pdf-export/ui/export-pdf-button.tsx`). The button
MUST NOT report success (`toast.success`) unless the artifact was actually
handed to the user — either the tab navigated to the artifact URL, or, when
`window.open` returns `null`, a visible fallback download link was
rendered.

#### Scenario: Ready job opens without a false-success toast under a popup blocker

- **GIVEN** a browser with default popup-blocker settings
- **WHEN** a user clicks Export PDF and the job reaches `ready`
- **THEN** either a new tab shows the PDF, or a visible download link
  appears in the page
- **AND** `toast.success` fires only in the branch that actually delivered
  the artifact to the user

### Requirement: Status-poll failure recovers the button to a clickable state

`ExportPdfButton`'s status-poll query MUST handle `isError` by clearing the
held `jobId` and surfacing an error toast, mirroring the existing
`requestMut.onError` / `"failed"` recovery path. The button MUST NOT remain
disabled/spinning indefinitely after the poll's retries are exhausted.

#### Scenario: Status endpoint fails after the job is enqueued

- **GIVEN** an export job has been enqueued and the status poll is running
- **WHEN** the status endpoint errors past the poll's retry budget
- **THEN** the button clears its generating state, becomes clickable again,
  and an error toast is shown
- **AND** no page reload is required to recover
