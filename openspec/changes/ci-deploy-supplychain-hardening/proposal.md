## Why

The repository's automated quality and deployment seams are dormant or
misconfigured, so the documented gates do not actually protect `main` or the
production edge. Four independent findings from the 2026-06-28 repo-excellence
review share one root theme — a gate that is declared but not enforced:

- **CI is dormant and unenforceable** (`BL-CI-CD-GATES`): `.github/workflows/ci.yml`
  is `workflow_dispatch`-only with zero runners, the local `pre-push` hook never
  runs a TypeScript typecheck (and masks an early gate failure for lack of
  `set -e`), and the CI visual-regression job calls a non-existent
  `pnpm db:seed:simple` script (the real scripts are `db:seed:small` /
  `db:seed:middle` / `db:seed:huge`), so the job would fail on its own seed step
  if a runner ever picked it up.
- **Supply-chain integrity is partial** (`BL-SUPPLY-CHAIN`): `Dockerfile.web`
  installs with `--no-frozen-lockfile`, so the production frontend can ship a
  dependency tree that diverges from the committed `pnpm-lock.yaml`; CI installs
  rely on the implicit `CI=true` frozen default; base images and `turbo` use
  floating tags rather than digests/pins.
- **Deploy seams are misaligned** (`BL-DEPLOY-SEAM-MISC`): `Dockerfile.api`
  `EXPOSE`s and bakes a `HEALTHCHECK` on port `3002` while the API binds `3001`
  at runtime, and the `api` service is still host-published
  (`${API_PORT:-3001}:3001`) while `web` was deliberately moved to expose-only
  behind Caddy, leaving the API reachable without TLS/edge controls.
- **CSP is never enforced** (`BL-SECURITY-HEADERS-CSP`): the Caddy edge sends
  `Content-Security-Policy-Report-Only` with no report sink, so the policy never
  blocks and violations are not even collected — production effectively ships
  without an active CSP.

## What Changes

### CI is an enforced gate (`ci-pipeline-enforcement`)

- Fix the broken seed reference in `.github/workflows/ci.yml`: replace the
  visual-regression job's `pnpm db:seed:simple` with the deterministic-fixture
  script that actually exists (`pnpm db:seed:middle`, which runs
  `prisma/seed-simple.ts`), and grep-confirm `db:seed:simple` is gone from the
  whole workflow.
- Bring the local `.husky/pre-push` hook to parity with the cheap deterministic
  CI jobs: add `pnpm turbo typecheck` (and `pnpm lint` + `pnpm format:check`)
  ahead of the existing `catalog:check` + `pnpm test`, and add `set -e` so any
  failing gate aborts the push, so a type- or lint-broken tree is caught before
  it leaves the machine.
- Document and (when a runner exists) restore the server-side gate: assign a
  runner, restore `push` / `pull_request` triggers, and enable required status
  checks; until then, record that `main` has no enforced server-side protection.
- Verify a deliberately red commit fails a run before declaring the server-side
  gate live.

### Supply-chain build integrity (`build-supply-chain-integrity`)

- Change `Dockerfile.web` from `pnpm install --no-frozen-lockfile` to
  `--frozen-lockfile`, matching `Dockerfile.api`, and fix any lockfile drift it
  surfaces rather than masking it.
- Make every CI install step explicit `pnpm install --frozen-lockfile` instead
  of relying on the implicit `CI=true` default.
- Digest-pin the Docker base images (`node:25-alpine`, the Playwright image) and
  pin `turbo` to the manifest version instead of the floating `turbo@2`.

### Deploy edge topology (`deploy-edge-topology`)

- Align `Dockerfile.api` `EXPOSE` and the baked `HEALTHCHECK` with the runtime
  port the API actually binds (`3001`), or parameterize both via the `PORT` env
  using the same default, so a plain `docker run` / baked-healthcheck
  orchestrator does not report the container permanently unhealthy.
- Switch the `api` service in `docker-compose.prod.yml` from host-published
  `ports: ["${API_PORT:-3001}:3001"]` to `expose: ["3001"]` (or a localhost
  bind), so all external traffic flows through the Caddy edge, matching the
  expose-only posture already applied to `web`.

### Enforce CSP (`production-csp-enforcement`)

- Validate the existing policy against the Next.js production bundle (script
  nonce/inline needs in particular).
- Switch both `deploy/caddy/Caddyfile` and `deploy/caddy/Caddyfile.staging`
  from the `Content-Security-Policy-Report-Only` header to the enforcing
  `Content-Security-Policy` header once validated; optionally wire a
  `report-uri`/`report-to` sink for monitoring.

## Capabilities

### New Capabilities

- `ci-pipeline-enforcement`: The automated quality gate (CI workflow + local
  pre-push hook) MUST be correct and enforced, not dormant — CI references only
  real scripts, pre-push mirrors the cheap deterministic CI jobs, and the
  server-side gate is restored with required status checks once a runner exists.
- `build-supply-chain-integrity`: Production and CI builds MUST install from the
  committed lockfile with integrity (`--frozen-lockfile` everywhere) and pin
  their base images and build toolchain so builds are reproducible and
  verifiable.
- `deploy-edge-topology`: The API container's declared port/healthcheck MUST
  match its runtime port, and the API MUST be reachable only through the Caddy
  edge (expose-only), not host-published.
- `production-csp-enforcement`: The production edge MUST serve an enforcing
  Content-Security-Policy (not Report-Only), validated against the application
  bundle, so the XSS defense-in-depth layer actually blocks.

### Modified Capabilities

_(none — no existing spec governs CI enforcement, build supply-chain integrity,
the Docker/Caddy deploy topology, or the production CSP header. `uat-quality-gates`
defines the gate command set and manual UAT sweeps but not CI automation or
server-side enforcement; `dependency-currency` governs npm package version pins
but not Docker base-image digests or lockfile-frozen installs;
`lint-toolchain-ownership` governs which tool owns which lint check.)_

## Impact

- `.github/workflows/ci.yml` — fix the visual-regression job's `db:seed:simple`
  reference; make installs explicit `--frozen-lockfile`; digest-pin base images;
  (deferred until a runner exists) restore `push`/`pull_request` triggers and
  required checks.
- `.husky/pre-push` — add typecheck + lint + format:check ahead of the existing
  catalog/test steps, and add `set -e` so any failing gate aborts the push.
- `Dockerfile.web` — `--no-frozen-lockfile` → `--frozen-lockfile`; digest-pin
  `node:25-alpine`; pin `turbo`.
- `Dockerfile.api` — digest-pin base image; align `EXPOSE`/`HEALTHCHECK` to the
  runtime port (`3001` or `PORT`).
- `docker-compose.prod.yml` — `api` service `ports:` → `expose:` (or localhost
  bind).
- `deploy/caddy/Caddyfile`, `deploy/caddy/Caddyfile.staging` — CSP header
  Report-Only → enforcing after validation; optional report sink.
- No schema change, no migration, no application source change.
- Cross-change dependency: closing the API host port (this change's
  `deploy-edge-topology`) is the hard prerequisite the separate
  `set-express-trust-proxy` change cites as `BL-DEPLOY-SEAM-MISC` for safely
  enabling `trust proxy` in production.
- Out of scope (owned by other changes): routing `/pdfs` at the edge
  (`route-pdfs-and-authz`) and removing `/metrics` from the public matcher
  (`protect-metrics-endpoint`); this change does not touch the Caddy `@api`
  path matcher.
