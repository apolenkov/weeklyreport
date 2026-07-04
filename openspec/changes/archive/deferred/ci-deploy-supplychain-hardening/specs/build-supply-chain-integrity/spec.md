## ADDED Requirements

### Requirement: The web image installs with a frozen lockfile

The `Dockerfile.web` installer stage SHALL install dependencies with
`pnpm install --frozen-lockfile`, matching `Dockerfile.api`, so the production
frontend image can never resolve a dependency tree that diverges from the
committed `pnpm-lock.yaml`. Any drift the frozen install surfaces MUST be fixed
by updating the lockfile, not by reverting to `--no-frozen-lockfile`.

#### Scenario: Web image build honors the committed lockfile

- **GIVEN** the updated `Dockerfile.web`
- **WHEN** the web image is built
- **THEN** the installer stage runs `pnpm install --frozen-lockfile`, and the
  string `--no-frozen-lockfile` does not appear in `Dockerfile.web`

#### Scenario: Lockfile drift fails the build instead of being masked

- **GIVEN** a `package.json` change that was not reflected in `pnpm-lock.yaml`
- **WHEN** the web image build runs the frozen install
- **THEN** the install fails fast on the lockfile mismatch, and the resolution
  is to refresh and commit `pnpm-lock.yaml`, not to relax the frozen flag

### Requirement: CI install steps are explicitly frozen

Every dependency-install step in `.github/workflows/ci.yml` SHALL pass
`--frozen-lockfile` explicitly rather than relying on the implicit `CI=true`
frozen-install default, so install reproducibility does not depend on an
undeclared environment variable.

#### Scenario: All CI installs are explicitly frozen

- **GIVEN** the updated `.github/workflows/ci.yml`
- **WHEN** each `pnpm install` step across all jobs is inspected
- **THEN** every install step passes `--frozen-lockfile` explicitly, and none
  relies solely on the implicit `CI=true` default

### Requirement: Docker base images and the build toolchain are pinned

The Docker base images and the `turbo` build tool SHALL be pinned rather than
floating, so a base-image or toolchain change cannot silently alter a build.
`Dockerfile.web` and `Dockerfile.api` MUST reference their base images by
immutable digest (for example `node:25-alpine@sha256:...` and the Playwright
image by digest), and the `turbo` install in `Dockerfile.web` MUST pin the
version declared in the repository manifest instead of the floating `turbo@2`.

#### Scenario: Base images are digest-pinned

- **GIVEN** the updated `Dockerfile.web` and `Dockerfile.api`
- **WHEN** every `FROM` line is inspected
- **THEN** each base image is referenced by an immutable `@sha256:` digest, not
  by a floating tag alone

#### Scenario: turbo is pinned to the manifest version

- **GIVEN** the updated `Dockerfile.web`
- **WHEN** the global `turbo` install line is inspected
- **THEN** it installs the `turbo` version declared in the repository manifest,
  not the floating `turbo@2`
