# PDF recovery notice retention

## MODIFIED Requirements

### Requirement: The export UI presents recovery quarantine as a terminal state

When the status query returns `recovery_required`, the export control MUST
exit its generating state, surface the exact message `Recovery required —
export outcome unknown`, and remain retryable for a new export request. The
client MUST NOT retry, re-render, or resurrect the quarantined job itself. The
admin recovery surface MUST present the same quarantined state with the
generation to retry.

A replacement request from ExportPdfButton MUST retain the recovery-required notice while pending or if it fails before a new job ID is acknowledged; the notice MUST clear only when a replacement job is acknowledged.

#### Scenario: The requester sees the quarantine state

- **WHEN** the observed export status becomes `recovery_required`
- **THEN** the control stops polling and exits the generating state
- **AND** the `Recovery required — export outcome unknown` message is shown

#### Scenario: The Head sees an actionable recovery row

- **WHEN** a Head opens the admin recovery list
- **THEN** each quarantined export shows its identity and current generation
- **AND** the retry action submits `{jobId, expectedGeneration}`

#### Scenario: A failed replacement retains the quarantine notice until a later acknowledgement

- **GIVEN** the current report displays the recovery-required notice and the quarantined job is no longer active
- **WHEN** the requester starts a replacement export
- **THEN** the notice remains visible while the replacement request is pending
- **AND** if the request fails before acknowledging a new job ID, the notice remains and the control is idle and retryable
- **WHEN** a later explicit replacement request acknowledges a new job ID
- **THEN** the notice clears and the new job ID becomes the stored active job for the current report
- **AND** the client never automatically requests or resurrects the quarantined job
