## MODIFIED Requirements

### Requirement: A Server-Side Merge Gate MUST Exist Before The First Production Point

The repository MUST run CI for pull requests and pushes to `main`, and MUST have
required status checks on a protected `main` before the first production point.
During the pre-production MVP phase, active GitHub-hosted CI with an unprotected
`main` is an accepted, explicitly recorded gap; it MUST NOT be described as an
enforced merge gate. The local pre-push hook remains an additional developer
gate and MUST NOT be presented as server-side enforcement.

#### Scenario: CI runs while main remains unprotected in pre-production

- **WHEN** CI triggers on pull requests and pushes to `main` but the Branches API
  reports `main` as unprotected
- **THEN** the repository records that server-side checks run but do not block a
  direct or red update to `main`
- **AND** reports distinguish successful CI execution from merge enforcement
- **AND** the local pre-push gate remains active as defense in depth

#### Scenario: First production point is reached with no enforced checks

- **WHEN** the repository is about to reach its first production point
- **THEN** `main` MUST be protected by a branch rule or ruleset
- **AND** stable CI and security status checks MUST be required
- **AND** force-push, deletion, review, conversation-resolution, and bypass
  behavior MUST be explicitly verified and recorded

#### Scenario: Administrative settings cannot be read

- **WHEN** the current token or repository plan prevents a ruleset or branch
  protection query
- **THEN** the setting remains unverified
- **AND** the project MUST NOT infer enforcement from workflow files alone
