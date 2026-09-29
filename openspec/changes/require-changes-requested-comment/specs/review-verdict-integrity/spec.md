## ADDED Requirements

### Requirement: Requesting changes carries a mandatory reason

A `changes_requested` verdict SHALL include a non-empty comment no longer than the review comment limit. An `approved` verdict SHALL NOT carry a comment. The comment SHALL be stored with the verdict in the same transaction as the verdict and any un-submit, and SHALL NOT change the section or period lifecycle.

#### Scenario: Head requests changes with a reason

- **WHEN** a reviewer sends `changes_requested` with a valid comment for a submitted section
- **THEN** the verdict, the comment and the return to draft are committed together
- **AND** the owning Lead's section read model lists that review with the comment

#### Scenario: Reason is missing or invalid

- **WHEN** `changes_requested` arrives with no comment, only whitespace, or text over the limit
- **THEN** the request is rejected and no verdict, comment or transition is written

#### Scenario: Later approval clears the reason

- **GIVEN** a stored `changes_requested` review with a comment
- **WHEN** the same reviewer approves the section
- **THEN** the review's comment is empty

### Requirement: The Lead sees the reason on the returned section

The Lead's "Reviewer feedback" panel SHALL show the current `changes_requested` comment with the reviewer's name. Verdicts recorded before the comment existed SHALL display no comment and no placeholder.

#### Scenario: Lead opens a returned section

- **WHEN** the Lead opens a section returned with a comment
- **THEN** the panel shows the reviewer name and the comment text as plain text

### Requirement: Request changes asks for the reason before mutating

Both Request changes entry points (review panel and dashboard queue) SHALL open a comment dialog and SHALL send the mutation only on submit with valid text. The dialog SHALL move focus into the field, show an inline error for empty input, disable submit while pending and keep the text if the server rejects the request.

#### Scenario: Empty submit

- **WHEN** the Head submits the dialog with no text
- **THEN** an inline error is shown and no mutation is sent
