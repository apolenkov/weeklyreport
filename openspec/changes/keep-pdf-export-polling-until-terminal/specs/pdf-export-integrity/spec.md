## ADDED Requirements

### Requirement: PDF export status polling continues until a terminal result

The web PDF export action MUST keep its status query scheduled while no status has arrived or while the observed job state is non-terminal. Polling MUST stop only after the canonical terminal status `completed` or `failed` is observed. A cold worker that takes longer than one polling interval MUST therefore still deliver its completed artifact or surface its terminal failure without a page reload.

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

### Requirement: An active PDF export survives an in-tab control remount

After a successful enqueue, the web PDF export action MUST preserve the opaque active job ID in browser-tab-scoped storage under the current report identity. If the control remounts or the page reloads before a terminal result, the new instance MUST restore that exact job ID and resume the ownership-bound status query. The stored ID MUST be removed before the client clears its active state on completion, terminal failure, or status-query error, so a stale job cannot keep a later instance busy. No artifact content, bearer credential, or user identity may be stored.

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

- **WHEN** the restored status query errors or returns `failed`
- **THEN** the stored active job ID is removed
- **AND** the control returns to retryable idle with the existing clear error message
