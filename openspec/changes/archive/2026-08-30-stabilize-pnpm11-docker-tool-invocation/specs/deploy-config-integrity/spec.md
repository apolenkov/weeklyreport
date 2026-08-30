## ADDED Requirements

### Requirement: Production container tools MUST NOT reconcile dependencies after the frozen install

The production API and Web Docker build paths MUST acquire dependencies only through their explicit frozen install steps. After those steps, Prisma generation, API and Web compilation, Chromium installation, and migration startup MUST use the installed toolchain without invoking a package-manager dependency preflight that can start another install or contact the registry. Turbo's strict task environment MUST propagate the builder-scoped preflight setting to workspace scripts without applying it to the development installer targets. The production configuration gate MUST reject a missing or leaked propagation setting, a Compose migration override that invokes the package manager, or a Dockerfile that restores a late package-manager wrapper for one of those consumers.

#### Scenario: Build tools run after the source overlay changes file metadata

- **WHEN** the pruned full source has been copied over the dependency-install layer and the API or Web image runs Prisma or Turbo
- **THEN** the installed tool executes without starting dependency reconciliation
- **AND** Turbo-proxied workspace scripts inherit the builder-scoped preflight setting
- **AND** no second registry-dependent install occurs after the explicit frozen install

#### Scenario: The migration image starts

- **WHEN** the migration container executes its Prisma migrate command
- **THEN** it uses the Prisma tool already present in the image
- **AND** Compose does not replace that command with a package-manager wrapper
- **AND** startup does not invoke Pnpm or attempt to resolve dependencies

#### Scenario: A late package-manager wrapper is reintroduced

- **WHEN** either production Dockerfile wraps Prisma, Turbo, or Playwright in a Pnpm `exec` or `run` after dependency installation
- **THEN** the production configuration gate exits non-zero and identifies the non-deterministic tool invocation
