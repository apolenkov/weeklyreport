# Spec Delta

## Purpose

Keep prepare-time Git hook installation owned by the permanent checkout so disposable linked worktrees cannot redirect shared hooks.

## ADDED Requirements

### Requirement: Linked worktrees preserve shared hook installation

The root `package.json` prepare lifecycle MUST skip the hook installer successfully with a clear linked-worktree message when the absolute Git directory differs from the absolute common Git directory. It MUST NOT change shared hooks in this case.

#### Scenario: Dependency preparation in a linked worktree

- **WHEN** prepare runs in a linked worktree
- **THEN** it succeeds without invoking the hook installer
- **AND** it reports that installation was skipped for a linked worktree

### Requirement: Main checkout retains ordinary hook installation

The root prepare lifecycle MUST invoke the ordinary hook installer in the main checkout, including from its subdirectories, and preserve installer output and failure status.

#### Scenario: Main checkout installation succeeds

- **WHEN** prepare runs in the main checkout and the installer succeeds
- **THEN** the installer is invoked with `install` and prepare succeeds

#### Scenario: Main checkout installation fails

- **WHEN** prepare runs in the main checkout and the installer fails
- **THEN** its output remains visible and prepare returns its nonzero status

### Requirement: No-Git environments retain successful preparation

The root prepare lifecycle MUST succeed without invoking the hook installer when Git cannot identify a worktree, including source-only Docker build contexts.

#### Scenario: Source files without Git metadata

- **WHEN** prepare runs outside a Git worktree
- **THEN** it succeeds without invoking the hook installer
