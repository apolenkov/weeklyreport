# Spec Delta

## Purpose

Ensures WeeklyReport installs and executes published dependency artifacts without carrying repository-local rewrites of third-party package contents.

## ADDED Requirements

### Requirement: Repository installations MUST use unmodified published packages

The pnpm workspace MUST NOT declare `patchedDependencies` or retain package patch artifacts that alter installed third-party code. Compatibility MUST be achieved through supported published versions, public APIs, or package configuration.

#### Scenario: Frozen installation resolves the dependency graph

- **WHEN** a clean checkout runs `pnpm install --frozen-lockfile`
- **THEN** installation succeeds without applying repository-local package patches

#### Scenario: Repository policy scans dependency configuration

- **WHEN** repository safety checks inspect dependency manifests and tracked patch artifacts
- **THEN** they find no `patchedDependencies` configuration or third-party package patch files
