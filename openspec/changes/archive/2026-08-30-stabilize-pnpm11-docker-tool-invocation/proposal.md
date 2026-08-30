## Why

A production image build can fail after its frozen dependency install has already succeeded because Pnpm 11 rechecks dependencies before a later `exec` or `run`, starts a second uncached install, and times out on the registry. The repeated failures are visible in the production Docker gate and arise from the late Pnpm wrappers in `Dockerfile.api` and `Dockerfile.web`.

## What Changes

- Run Prisma, Turbo, and Playwright through the local binaries installed by the explicit frozen install instead of invoking them through Pnpm again.
- Disable Pnpm's run-time dependency reconciliation only inside each production builder stage, and declare that setting in Turbo's strict environment allowlist so its workspace scripts inherit it without changing the dev installer targets.
- Make the migration image and both Compose entrypoints execute their installed Prisma binary directly at runtime.
- Extend `scripts/gates/operations/prod-compose-gate.test.ts` so later Dockerfile edits cannot reintroduce a dependency-reconciling Pnpm wrapper after the install layer.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `deploy-config-integrity`: Production Docker builds and migration startup must use the already-installed toolchain without an implicit network-dependent dependency reconciliation.

## Non-goals

- Changing dependency versions, the lockfile, Pnpm's default behavior outside the explicit Docker build environment, or runtime application behavior.
- Hiding registry failures during the one explicit frozen install.
- Adding a persistent browser, E2E, or UAT harness.

## Impact

The change is limited to `Dockerfile.api`, `Dockerfile.web`, `docker-compose.yml`, `docker-compose.prod.yml`, `turbo.json`, the existing production-compose gate test, and the durable deployment-integrity specification. Container entrypoints remain functionally equivalent, but production builds become deterministic after the explicit cached install.
