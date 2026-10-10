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
directories outside `.git`. Installed dependencies, generated build output,
local secrets and explicitly owned local artifact classes MAY be allowed.
Historical handoffs, session artifacts, ignored tool installations and
unexplained residue MUST fail. Local allowance MUST NOT authorize committing
runtime or generated artifacts.

#### Scenario: Unexplained residue remains

- **WHEN** the cleanliness gate finds an untracked or disallowed ignored entry, a forbidden historical artifact, or an unexplained empty directory
- **THEN** acceptance fails with the exact path

#### Scenario: Supported local artifacts remain

- **WHEN** the inventory contains ignored root worktrees or package stores, logs, generated Next variants, CI reports, API export storage, declared native agent state or regenerated OpenSpec adapters
- **THEN** these explicitly identified local classes are allowed and their internal empty directories do not fail acceptance
- **AND** unrelated ignored paths and committable Pi configuration remain subject to normal inventory

#### Scenario: Generated artifacts are forced into Git

- **WHEN** generated dependency/build/cache paths, TypeScript build metadata, or reserved worktree/store/log/CI/export paths are force-added to Git
- **THEN** the gate fails with exact tracked diagnostics
- **AND** source, documentation, public environment examples and similar legitimate path names remain allowed

### Requirement: Accountability tooling is disposable

The one-off registry generator and review helpers MUST remain execution material
outside the tracked repository. Curated conclusions MAY live in current
documentation, while raw session artifacts remain in the external archive.

#### Scenario: Acceptance completes

- **WHEN** the final registry and review evidence are archived
- **THEN** no root E2E, UAT, browser, catalogue, campaign, or session harness is added to Git

### Requirement: Artifact documentation identifies delivery and export ownership

The repository documentation MUST distinguish source, allowed local state,
container payloads, CI evidence and report exports, naming their producers,
consumers, storage and cleanup authority. Source-derived declarations MUST NOT
be presented as deployment or browser acceptance.

#### Scenario: A developer locates an output

- **WHEN** the developer follows the repository or documentation index
- **THEN** one current artifact guide identifies the relevant Git/build/CI/image/PDF contract and its owning source
- **AND** unresolved completed-PDF retention and browser filename behavior are explicit, without inventing deletion or runtime results
