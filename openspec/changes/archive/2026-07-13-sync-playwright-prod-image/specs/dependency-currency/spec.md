## ADDED Requirements

### Requirement: The Playwright Base Image Tag MUST Track the Resolved playwright Dependency

The `Dockerfile.api` base image tag MUST name the same version as the
`playwright` package resolved in `pnpm-lock.yaml` (the tag has the form
`mcr.microsoft.com/playwright:v<x.y.z>-noble`), because the image runs
with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` and the bundled Chromium revision is
coupled to the Playwright version. A mismatch means the workspace Playwright
looks up a browser revision the image does not ship, and PDF export fails at
`chromium.launch()` in the built image while unit and E2E suites — which run
their own `playwright install` — stay green and hide the break.

#### Scenario: The image tag matches the resolved dependency

- **WHEN** `Dockerfile.api` and `pnpm-lock.yaml` are inspected after the change
- **THEN** the `FROM mcr.microsoft.com/playwright:v<x.y.z>-noble` base tag names
  the same version (`1.61.0`) as the resolved `playwright` and `playwright-core`
  lines in `pnpm-lock.yaml`
- **AND** no `v1.59.1-noble` reference remains anywhere in `Dockerfile.api`,
  including the `# TODO: pin @sha256` note

#### Scenario: PDF export can launch Chromium in the built image

- **WHEN** the production API image is built from `Dockerfile.api` and a
  PDF-export job invokes `chromium.launch({ headless: true })` from
  `apps/api/src/infrastructure/bullmq/pdf-export.processor.ts`
- **THEN** Chromium launches against the revision baked into the base image
  rather than throwing "Executable doesn't exist"

### Requirement: A Repository Gate MUST Fail When the Image Tag and playwright Version Drift

A repository gate MUST detect drift between the `Dockerfile.api` Playwright base
image tag and the resolved `playwright` version and fail loudly, so the two pins
cannot diverge silently again. The guard MUST run inside `pnpm lint`, and
therefore inside the `.husky/pre-push` gate, alongside the existing
`lint:prisma:typecheck` and `lint:status-literal-unions` checks.

#### Scenario: The guard passes when the pins are in lockstep

- **WHEN** `pnpm lint` runs with the `Dockerfile.api` tag and the resolved
  `playwright` version naming the same version
- **THEN** the `lint:playwright-image` step exits 0 and the lint chain completes

#### Scenario: The guard fails when the pins drift

- **WHEN** the `Dockerfile.api` base image tag names a version different from the
  `playwright` version resolved in `pnpm-lock.yaml`
- **THEN** `node scripts/check-playwright-image-sync.mjs` exits non-zero, naming
  both the image tag and the resolved dependency version
- **AND** `pnpm lint` fails as a result, blocking the push
