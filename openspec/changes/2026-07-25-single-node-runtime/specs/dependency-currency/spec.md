## MODIFIED Requirements

### Requirement: Node Type Definitions MUST Track The Runtime Major

The Node major that the shipped container images execute is the runtime major.
`.nvmrc`, the CI Node version, `engines.node`, and every `@types/node`
declaration MUST equal it — they follow the images rather than define them,
because a gate that passes on a major no container runs proves nothing about
the deployed code. When `@types/node` is declared in more than one workspace,
all declarations MUST share that same major.

The previous wording defined the runtime major as `.nvmrc` and CI. That is a
developer convenience, not a runtime: it let `.nvmrc` say 26 while the web
image ran 25 and the API image ran 24 — a major that appeared in no file in
the repository, inherited silently from a base image — with the requirement
formally satisfied throughout.

#### Scenario: Every declaration agrees with the images

- **WHEN** `scripts/check-runtime-node-sync.mjs` runs as part of `pnpm lint`
- **THEN** `.nvmrc`, `engines.node`, the `FROM node:<major>` tag in
  `Dockerfile.api`, the same tag in `Dockerfile.web`, and the `@types/node`
  major in every workspace that declares it all resolve to one major
- **AND** the guard exits non-zero naming each disagreeing source when they do
  not

#### Scenario: A base image is changed

- **WHEN** either Dockerfile's base image is changed to one carrying a
  different Node major
- **THEN** the change is incomplete until `.nvmrc`, `engines.node` and every
  `@types/node` declaration are moved with it in the same change
- **AND** a base image whose Node major is not visible in the `FROM` line is
  rejected, because it makes the runtime major unreadable from the repository

#### Scenario: A types bump is proposed ahead of the runtime

- **WHEN** an `@types/node` major bump is proposed that exceeds the major the
  images run
- **THEN** the bump is rejected unless the images move in the same change

#### Scenario: The runtime major reaches end of life

- **WHEN** the Node major in use reaches its end-of-life date in the
  nodejs/Release schedule
- **THEN** moving off it is treated as a defect to be scheduled, not a
  currency upgrade to be deferred

## REMOVED Requirements

### Requirement: The Playwright Base Image MUST Match The Resolved Playwright Version

**Reason**: The failure mode no longer exists. `Dockerfile.api` installed
Chromium by inheriting a Playwright base image whose baked browser revision
could diverge from the resolved `playwright` dependency — breaking PDF export
in the built image while every suite, which installs its own browsers, stayed
green. The API image now installs Chromium in its runner stage using the same
`playwright` package the API imports at runtime (a production dependency of
`apps/api`), so the browser revision is the dependency's own and the two
cannot disagree. `scripts/check-playwright-image-sync.mjs` is deleted rather
than rewritten; `scripts/check-runtime-node-sync.mjs` takes its slot in
`pnpm lint` and guards the runtime major instead.
