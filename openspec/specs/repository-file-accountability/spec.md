# repository-file-accountability Specification

## Purpose

Give every tracked file an evidence-backed disposition once, without adding a permanent catalogue, campaign, or review platform to the repository.

## Requirements

### Requirement: Every tracked file receives one complete disposition

The one-off repository accountability registry for the acceptance SHA MUST contain every path returned by `git ls-files` exactly once and assign each path a role, owner, review lens, verdict, and evidence reference. Cohort totals MUST sum exactly to the tracked-file denominator; omissions, duplicates, and unproved delete verdicts MUST fail acceptance.

#### Scenario: A tracked file is omitted or duplicated

- **WHEN** the registry is reconciled with `git ls-files` at the acceptance SHA
- **THEN** any missing or duplicate path fails the accountability check

#### Scenario: A file is marked for deletion

- **WHEN** the registry verdict is `delete`
- **THEN** its evidence proves no live reference, source-of-truth duty, manager ownership, or required historical provenance remains

### Requirement: Accountability tooling is disposable

The one-off registry generator and browser inspection helpers MUST remain execution material outside the tracked repository. Curated conclusions MUST be allowed in current documentation, while raw session artifacts MUST remain in the external archive.

#### Scenario: Acceptance completes

- **WHEN** the final registry and review evidence are archived
- **THEN** no root E2E, UAT, browser, catalogue, campaign, or session harness is added to Git
