## ADDED Requirements

### Requirement: Integration Test Global Setup MUST Resolve The Repo Root Robustly

The integration test suite's `globalSetup` MUST derive the repository root by
walking up from its own file location to the nearest ancestor directory that
contains `package.json`, rather than a hardcoded directory-depth literal
(e.g. a fixed count of `..` segments). If no such ancestor exists, setup MUST
throw a descriptive error instead of silently continuing with an
out-of-workspace path.

#### Scenario: Repo root resolves correctly from the current suite location

- **WHEN** `globalSetup` runs from `e2e/integration/global-setup.ts`
- **THEN** the resolved repo root is the directory containing the top-level
  `package.json`
- **AND** `execSync("pnpm exec prisma migrate reset --force", { cwd: repoRoot, ... })`
  runs inside the pnpm workspace instead of throwing

#### Scenario: A future relocation of the e2e suite does not silently break setup

- **WHEN** the e2e suite directory is moved to a different depth relative to
  the repo root
- **THEN** the walk-up resolution still finds the correct repo root without
  any code change to a hardcoded depth constant

#### Scenario: No ancestor package.json is found

- **WHEN** `globalSetup` walks up from its file location and finds no
  ancestor directory containing `package.json`
- **THEN** `globalSetup` throws a descriptive error identifying the starting
  directory
- **AND** it does NOT fall back to a guessed or out-of-workspace path
