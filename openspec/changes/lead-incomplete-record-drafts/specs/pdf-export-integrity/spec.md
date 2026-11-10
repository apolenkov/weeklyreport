## ADDED Requirements

### Requirement: Printed publication discloses scoped incomplete-record omissions

The job-bound PDF and print template MUST disclose frozen omission metadata about incomplete risks and decisions for the job's authorized scope, separate from pending section counts, without draft text. It MUST NOT present omitted records as complete or imply an all-clear. If legacy snapshot omission metadata is absent, the omission state MUST stay unknown rather than zero in the data, and the printed document MUST NOT carry an omission warning: incomplete records could not be stored before the metadata existed, so such a publication left nothing out.

#### Scenario: Scoped omission is printed without private text

- **GIVEN** a frozen publication has incomplete-record omissions in groups A and B
- **WHEN** a requester scoped only to A exports the publication
- **THEN** the print and PDF disclose A's scoped omission count and that the report may be incomplete
- **AND** neither B's omission count nor omitted draft text is exposed
- **AND** complete frozen records retain their existing print behavior

#### Scenario: Legacy publication has unknown omissions

- **GIVEN** the job-bound snapshot predates omission metadata
- **WHEN** the print template renders it
- **THEN** its omission state is unknown, not zero, and no omission warning is printed

#### Scenario: Queued disclosure remains bound to its publication

- **GIVEN** a job freezes publication P1 and its scoped omission metadata
- **WHEN** the report is reopened and republished as P2 before printing
- **THEN** the job prints P1's scoped disclosure, not P2's or live draft content
