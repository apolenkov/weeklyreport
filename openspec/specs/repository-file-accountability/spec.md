# repository-file-accountability Specification

## Purpose

Keep only files that serve the current product while leaving no permanent
catalogue, campaign, or browser-review harness in the repository.

## Requirements

### Requirement: Every tracked file receives one complete disposition

The one-off repository accountability registry for the acceptance SHA MUST
contain every path returned by `git ls-files` exactly once. Each retained path
MUST record its current role, owner or layer, live consumer or source-of-truth
duty, replaceability, necessity score, verdict, and evidence reference. A KEEP
verdict requires 1000/1000 necessity; omissions, duplicates, lower-scored
retained files, and unproved delete verdicts fail acceptance.

#### Scenario: A tracked file is omitted or duplicated

- **WHEN** the registry is reconciled with `git ls-files` at the acceptance SHA
- **THEN** any missing or duplicate path fails the accountability check

#### Scenario: A file is marked for deletion

- **WHEN** the registry verdict is DELETE
- **THEN** its evidence proves no live consumer, source-of-truth duty, manager ownership, or current production/recovery contract remains

### Requirement: The whole worktree is clean

Acceptance MUST inventory tracked, untracked, and ignored entries plus empty
directories outside `.git`. Installed dependencies, generated build output, and
local environment secrets MAY be explicitly allowed; historical handoffs,
session artifacts, ignored tool installations, and unexplained residue MUST fail.

#### Scenario: Unexplained residue remains

- **WHEN** the cleanliness gate finds an untracked or disallowed ignored entry, a forbidden historical artifact, or an empty directory
- **THEN** acceptance fails with the exact path

### Requirement: Accountability tooling is disposable

The one-off registry generator and review helpers MUST remain execution material
outside the tracked repository. Curated conclusions MAY live in current
documentation, while raw session artifacts remain in the external archive.

#### Scenario: Acceptance completes

- **WHEN** the final registry and review evidence are archived
- **THEN** no root E2E, UAT, browser, catalogue, campaign, or session harness is added to Git
