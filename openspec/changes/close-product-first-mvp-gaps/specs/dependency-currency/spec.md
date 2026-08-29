## MODIFIED Requirements

### Requirement: The Node Major MUST Be The One The Images Run

The Node major that the shipped container images execute is the runtime major. `.nvmrc`, the CI Node version, `engines.node`, and every `@types/node` declaration MUST equal it — they follow the images rather than define them, because a gate that passes on a major no container runs proves nothing about the deployed code. When `@types/node` is declared in more than one workspace, all declarations MUST share that same major. The pnpm version in `packageManager` MUST also equal every explicit pnpm installation in Dockerfiles and Actions workflows; Node 26 execution surfaces MUST NOT depend on an unavailable bundled `corepack` binary.

#### Scenario: Every declaration agrees with the images

- **WHEN** `scripts/gates/environment/check-runtime-node-sync.ts` runs as part of `pnpm lint`
- **THEN** `.nvmrc`, `engines.node`, the `FROM node:<major>` tag in
  `Dockerfile.api`, the same tag in `Dockerfile.web`, and the `@types/node`
  major in the workspace catalog all resolve to one major
- **AND** `packageManager`, both Dockerfile pnpm installs, and every Actions `Setup pnpm` step resolve to one pnpm version
- **AND** the guard exits non-zero naming each unreadable or disagreeing source

#### Scenario: A base image is changed

- **WHEN** either Dockerfile's base image is changed to one carrying a
  different Node major
- **THEN** the change is incomplete until `.nvmrc`, `engines.node` and the
  `@types/node` declaration are moved with it in the same change
- **AND** a base image whose Node major is not visible in the `FROM` line is
  rejected, because it makes the runtime major unreadable from the repository

#### Scenario: A types bump is proposed ahead of the runtime

- **WHEN** an `@types/node` major bump is proposed that exceeds the major the
  images run
- **THEN** the bump is rejected unless the images move in the same change

#### Scenario: An Actions job uses corepack or a different pnpm version

- **WHEN** a workflow keeps a `Setup pnpm` step that does not install the exact `packageManager` version explicitly
- **THEN** the runtime-sync guard fails and names that setup step before CI can depend on unavailable or drifting package-manager behavior

#### Scenario: The runtime major reaches end of life

- **WHEN** the Node major in use reaches its end-of-life date in the
  nodejs/Release schedule
- **THEN** moving off it is treated as a defect to be scheduled, not a
  currency upgrade to be deferred

## REMOVED Requirements

### Requirement: A Repository Gate MUST Fail When the Image Tag and playwright Version Drift

**Reason**: `Dockerfile.api` no longer inherits a Playwright base image. Its runner installs Chromium through the same resolved production `playwright` package that launches the browser, so there is no independent image tag that can drift from the dependency.

**Migration**: Keep `playwright` as the API runtime owner of Chromium and use `scripts/gates/environment/check-runtime-node-sync.ts` to guard the Node and pnpm declarations that still exist across images and Actions workflows.
