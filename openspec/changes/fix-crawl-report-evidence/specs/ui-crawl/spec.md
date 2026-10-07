## ADDED Requirements

### Requirement: Video references represent successful recording

Crawler video references MUST be null when disabled or when recording start/stop fails. A path MUST represent a started and successfully finished recording. Recording failures MUST be explicit, and merged JSON and Markdown reports MUST preserve unavailable evidence without inventing links.

#### Scenario: Recording is disabled or fails

- **WHEN** video is disabled or recording start/stop fails
- **THEN** the run has null video and the report has no video link
- **AND** failed commands produce recording diagnostics

#### Scenario: Recording succeeds

- **WHEN** recording starts and finishes successfully
- **THEN** the run retains the generated relative video path

### Requirement: Response statistics distinguish measurements from absence

Crawler reports MUST calculate p95 using nearest rank and display its measured sample count. Null response times MUST be excluded, actual zero MUST remain a measurement, and empty observations MUST be reported as not measured.

#### Scenario: Twenty measured responses

- **WHEN** responses are the integers 1 through 20 milliseconds
- **THEN** p95 is 19 milliseconds and the sample count is 20

#### Scenario: No data or an actual zero

- **WHEN** no non-null responses exist or the only measured response is zero
- **THEN** the report distinguishes not measured with zero samples from zero milliseconds with one sample
