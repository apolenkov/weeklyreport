# pdf-export-client-status Specification

## Purpose

Defines how the export button recovers from status-query errors, keeps polling to a terminal result, survives a control remount and opens no blank tab.

## Requirements

### Requirement: A deterministic status-query error recovers the button to a clickable state

`ExportPdfButton`'s status-poll query MUST treat a deterministic client error
(for example, a stored job that no longer exists) as a terminal outcome: it
MUST clear the held `jobId`, remove the tab-scoped stored ID, and surface the
existing error message, mirroring the `requestMut.onError` / `"failed"`
recovery path, so the control returns to a clickable idle state without a page
reload. A transport failure is not a terminal observation: the control keeps
the held job and polling continues until the API answers with a job status or
a deterministic client error.

#### Scenario: The status endpoint declines the job deterministically

- **GIVEN** an export job has been enqueued and the status poll is running
- **WHEN** a status check fails with a deterministic client error
- **THEN** the button clears its generating state, becomes clickable again,
  and an error toast is shown
- **AND** the tab-scoped stored job ID is removed
- **AND** no page reload is required to recover

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

### Requirement: PDF export status polling continues until a terminal result

The web PDF export action MUST keep its status query scheduled while no status has arrived or while the observed job state is non-terminal. Polling MUST stop only after the canonical terminal status `completed`, `failed`, or `recovery_required` is observed. A cold worker that takes longer than one polling interval MUST therefore still deliver its completed artifact or surface its terminal failure without a page reload.

#### Scenario: A cold export remains queued across multiple checks

- **GIVEN** a PDF export has started and the worker has not recorded a terminal result
- **WHEN** the status query initially has no data or returns `queued` on successive checks
- **THEN** the client keeps the existing two-second polling interval
- **AND** the export control remains busy without losing the pending job identity

#### Scenario: The worker completes after more than one interval

- **GIVEN** the client has already observed a non-terminal export status
- **WHEN** a later status check returns `completed` with its artifact URL
- **THEN** polling stops
- **AND** the current-page download and persistent fallback link are delivered exactly once

#### Scenario: The worker reaches terminal failure

- **WHEN** a status check returns `failed`
- **THEN** polling stops
- **AND** the existing retryable error recovery clears the busy state

#### Scenario: The row is quarantined for recovery

- **WHEN** a status check returns `recovery_required`
- **THEN** polling stops
- **AND** the export control exits its generating state and surfaces the
  recovery-required message

### Requirement: An active PDF export survives an in-tab control remount

After a successful enqueue, the web PDF export action MUST preserve the opaque active job ID in browser-tab-scoped storage under the current report identity. If the control remounts or the page reloads before a terminal result, the new instance MUST restore that exact job ID and resume the ownership-bound status query. The stored ID MUST be removed before the client clears its active state on completion, terminal failure, recovery quarantine, or a deterministic status-query error. A transient status-query failure MUST retain the ID and continue polling. A sustained transport outage MUST NOT be treated as terminal either: polling continues until the API answers with a job status or a deterministic client error. No artifact content, bearer credential, or user identity may be stored.

#### Scenario: The export control remounts while the worker is running

- **GIVEN** enqueue succeeded and the active job ID was preserved for the current report and tab
- **WHEN** the export control unmounts and mounts again before the worker reaches a terminal state
- **THEN** the new instance restores the same job ID
- **AND** status polling resumes without starting a duplicate export

#### Scenario: The restored job completes

- **WHEN** the restored status query returns `completed` with its artifact URL
- **THEN** the current-page delivery and persistent fallback link are produced exactly once
- **AND** the stored active job ID is removed

#### Scenario: A restored job cannot be read or has failed

- **WHEN** the restored status query returns a deterministic client error or returns `failed` or
  `recovery_required`
- **THEN** the stored active job ID is removed
- **AND** the control returns to retryable idle, surfacing the
  recovery-required message for `recovery_required` and the existing clear
  error message for `failed` or the deterministic query error

#### Scenario: A restored job's status query fails transiently

- **WHEN** the status query fails because the API is temporarily unavailable
- **THEN** the stored active job ID remains and polling continues
- **AND** a later `completed` status delivers the same job's artifact once without another enqueue
