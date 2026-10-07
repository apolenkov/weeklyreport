## ADDED Requirements

### Requirement: Screenshot references represent confirmed evidence

Crawler page and step screenshots MUST be null when unavailable. A filename MUST be returned only after successful capture. Aborted pages, worker output and merged reports MUST preserve null rather than linking a directory. Capture failures MUST remain explicit, and required restoration of a changed surface MUST still be attempted after a failed capture.

#### Scenario: Step screenshot fails

- **WHEN** screenshot capture after a changed press fails
- **THEN** the step has null screenshot and an explicit capture diagnostic
- **AND** surface restoration is still attempted

#### Scenario: Page aborts or its screenshot fails

- **WHEN** a page has no confirmed screenshot
- **THEN** direct, relativized and merged records preserve null

#### Scenario: Capture succeeds

- **WHEN** screenshot capture succeeds
- **THEN** the generated relative filename remains available in the record
