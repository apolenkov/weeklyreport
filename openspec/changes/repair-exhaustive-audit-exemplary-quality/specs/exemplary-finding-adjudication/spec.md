## ADDED Requirements

### Requirement: Adjudication covers every current maintained file

The exemplary campaign MUST perform source-grounded semantic, structural, test,
documentation, and comment adjudication for every maintained file in the final
worktree, including files with no starting flag. The ledger surface is the concrete
consumer of this requirement and MUST record `file -> reviewer/checks -> verdict`
for each path.

#### Scenario: A file had no historical flag

- **WHEN** a maintained current file was absent from the historical campaign or had
  no recorded finding
- **THEN** it still receives a final-source review and explicit verdict
- **AND** absence from the older finding set is not evidence of quality

#### Scenario: A remediation changes an already reviewed file

- **WHEN** implementing any finding changes the reviewed content of another file
- **THEN** the affected file's adjudication returns to pending
- **AND** its final verdict is based on the changed source rather than the prior pass

### Requirement: Review evidence matches the claim's scope

Every adjudication verdict MUST cite evidence capable of proving that verdict. A
repository-wide absence claim MUST use a repository-wide inventory or search over the
applicable final scope; a behavior claim MUST use direct source reasoning and an
exercising test where executable; a comment verdict MUST inspect the actual comment
and its claimed owner or durable rationale.

#### Scenario: A broad absence is inferred from a sample

- **WHEN** a reviewer cites a subset of files to claim that no instances remain in
  the repository
- **THEN** the adjudication is invalid
- **AND** the reviewer MUST gather evidence over the complete applicable inventory
