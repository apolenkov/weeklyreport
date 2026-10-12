## ADDED Requirements

### Requirement: Reopen reason eligibility uses the existing router metric

The reopen reason length guard SHALL measure the raw draft in Unicode code points, matching the existing router maximum. The numeric maximum, optional reason, trim-on-confirm, pending controls and success/failure dialog lifecycle SHALL remain unchanged.

#### Scenario: A boundary-valid non-BMP reopen reason

- **WHEN** a lead enters 500 non-BMP code points while the current request dialog is idle
- **THEN** Send is enabled and emits the existing trimmed reason

#### Scenario: An over-limit reopen reason

- **WHEN** a lead enters 501 non-BMP code points
- **THEN** neither button nor keyboard submit emits a request and the complete draft remains
