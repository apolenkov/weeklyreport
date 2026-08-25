## ADDED Requirements

### Requirement: Lead form exposes terminal section-load recovery

The lead report form at `/lead/report/[reportId]` MUST replace its loading
skeleton with a visible terminal error state when `leadForm.byPeriod` fails.
The state MUST explain that the report could not be loaded, MUST expose a
`Retry` action, and MUST NOT render stale editable draft content while the
failed query remains in an error state. The existing centralized client-error
policy MUST continue to report the failure.

#### Scenario: Primary section read fails

- **WHEN** `leadForm.byPeriod` reaches a terminal error for the addressed report
- **THEN** the lead form shows a visible load-failure title and recovery guidance
- **AND** it shows a `Retry` action instead of a perpetual loading skeleton
- **AND** no editable draft controls or stale report records are rendered

#### Scenario: Retry recovers the lead form

- **WHEN** a lead activates `Retry` and the next `leadForm.byPeriod` request succeeds
- **THEN** the terminal error state is replaced by the loaded lead form
- **AND** the form is derived from the successful response

#### Scenario: Retry remains failed

- **WHEN** a lead activates `Retry` and `leadForm.byPeriod` fails again
- **THEN** the terminal error state remains visible
- **AND** the `Retry` action remains available after the request settles
