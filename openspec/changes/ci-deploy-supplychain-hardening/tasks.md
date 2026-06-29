# Tasks

## 1. CI pipeline enforcement

- [ ] 1.1 In `.github/workflows/ci.yml`, replace the visual-regression
      (`visual-baseline`) job's `run: pnpm db:seed:simple` with
      `run: pnpm db:seed:middle` — this is the only `db:seed:simple` occurrence;
      the E2E job seeds via `pnpm exec tsx prisma/seed.ts` and is unaffected.
      Confirm against the visual baselines' expected dataset; fall back to
      `db:seed:small` only if the suite needs the demo dataset.
- [ ] 1.2 Grep the whole workflow for any other `pnpm <script>` reference and
      confirm each resolves to a script defined in the root `package.json`.
- [ ] 1.3 In `.husky/pre-push`, add `pnpm turbo typecheck`, `pnpm lint`, and
      `pnpm format:check` ahead of the existing `pnpm catalog:check` and
      `pnpm test` steps; keep the `CI=true` / `SKIP_PREPUSH=1` skip block intact.
      Also add `set -e` immediately after the skip block (or chain every gate
      with `&&`): the current hook runs unchained sequential commands, so only
      the last command's exit status reaches `git` and a failed early gate is
      masked by a later passing one — `set -e` makes any non-zero gate abort.
- [ ] 1.4 Verify pre-push locally: a tree with a type error aborts the push; a
      clean tree passes; `SKIP_PREPUSH=1 git push` skips; and a failing early
      gate (e.g. catalog drift) aborts even when the later `pnpm test` would
      pass — confirming the failure is not masked.
- [ ] 1.5 (Follow-up, gated on a runner) Restore `push` and `pull_request`
      triggers in `ci.yml`, remove the `workflow_dispatch`-only stanza and its
      dormant-CI comment, and enable required status checks on `main`.
- [ ] 1.6 (Follow-up) Push a deliberately red commit to a PR branch and confirm
      the required check fails and blocks merge.
- [ ] 1.7 Until 1.5 lands, keep the workflow header comment stating that `main`
      has no enforced server-side gate and the local pre-push hook is the only
      active gate.

## 2. Build supply-chain integrity

- [ ] 2.1 Change `Dockerfile.web` installer stage from
      `pnpm install --no-frozen-lockfile` to `pnpm install --frozen-lockfile`.
- [ ] 2.2 Build the web image; if the frozen install surfaces lockfile drift,
      refresh and commit `pnpm-lock.yaml` (do not revert the flag).
- [ ] 2.3 Make every `pnpm install` step in `.github/workflows/ci.yml` pass
      `--frozen-lockfile` explicitly (all jobs: quality, e2e, migrate-reset).
- [ ] 2.4 Digest-pin the base images in `Dockerfile.web` (`node:25-alpine`) and
      `Dockerfile.api` (the Playwright image) by resolving and appending
      `@sha256:<digest>`.
- [ ] 2.5 Pin the `turbo` install in `Dockerfile.web` to the version declared in
      the repository manifest instead of the floating `turbo@2`.

## 3. Deploy edge topology

- [ ] 3.1 In `Dockerfile.api`, change `EXPOSE 3002` and the `HEALTHCHECK`
      `http://localhost:3002/health/live` to `3001` (or parameterize both via
      `PORT` with the runtime default).
- [ ] 3.2 Build and run the API image standalone (no compose override) and
      confirm the baked healthcheck reports healthy.
- [ ] 3.3 In `docker-compose.prod.yml`, replace the `api` service
      `ports: ["${API_PORT:-3001}:3001"]` with `expose: ["3001"]` (or a
      `127.0.0.1`-bound publish if a documented ops need requires host access).
- [ ] 3.4 Bring up the prod compose and confirm Caddy still reverse-proxies to
      `api:3001` over the compose network and the API is not reachable from a
      remote machine — with `expose:` no host port is published at all; with the
      `127.0.0.1`-bound option the port is loopback-only (host-local reach is the
      accepted trade-off).
- [ ] 3.5 In `Dockerfile.web`, change the builder-stage defaults
      `ARG API_URL=http://api:3002` → `http://api:3001` and move
      `ARG NEXT_PUBLIC_API_URL=http://localhost:3002` off the `:3002` host-port
      path to the Caddy edge (same-origin / public site address). Do this BEFORE
      (or in the same release as) the 3.3 host-port removal, and rebuild the web
      image, so no shipped client bundle references the gone `:3002` port.
      `NEXT_PUBLIC_API_URL` is inlined at build, so it MUST be set at build (this
      `ARG`/`ENV` default or a `web.build.args` entry), not at runtime.
- [ ] 3.6 In `docker-compose.prod.yml`, supply `NEXT_PUBLIC_API_URL` to the `web`
      service via `build.args` (so it reaches the build), and drop or correct the
      runtime `web.environment: NEXT_PUBLIC_API_URL` line — it is a no-op for the
      already-inlined client value. Keep the runtime `web.environment: API_URL`
      override (server-side, read at runtime) pointed at `http://api:3001`.
- [ ] 3.7 Rebuild the web image and confirm the baked client bundle has no
      `localhost:3002` reference (grep the standalone output) and that browser
      API calls still flow same-origin through Caddy (the tRPC client already uses
      the relative `/trpc` URL, so this is a stale-default hygiene check, not a
      routing change).
- [ ] 3.8 Note in the `set-express-trust-proxy` change that its
      `BL-DEPLOY-SEAM-MISC` host-port prerequisite is now satisfied.

## 4. Production CSP enforcement

- [ ] 4.1 Express the candidate enforcing policy as
      `Content-Security-Policy-Report-Only` and exercise the production web app
      across all role surfaces (lead, head, admin, viewer) to collect violations.
- [ ] 4.2 Add any directive needed to admit legitimate sources (in particular a
      nonce-based `script-src` for the Next.js runtime) until report mode is
      clean.
- [ ] 4.3 Flip both `deploy/caddy/Caddyfile` and `deploy/caddy/Caddyfile.staging`
      from `Content-Security-Policy-Report-Only` to the enforcing
      `Content-Security-Policy` header.
- [ ] 4.4 (Optional) Wire a `report-uri` / `report-to` sink for monitoring;
      confirm enforcement still holds when no sink is configured.
- [ ] 4.5 Verify in a browser that a disallowed script is blocked (not merely
      reported) under the enforcing policy.

## 5. Validation

- [ ] 5.1 Run `openspec validate "ci-deploy-supplychain-hardening" --strict` and
      confirm it exits 0.
- [ ] 5.2 Run the repo gate chain `pnpm typecheck && pnpm lint && pnpm test &&
pnpm build` to confirm the infra changes did not break the build.
- [ ] 5.3 Coordinate the Caddyfile edits with `route-pdfs-and-authz` and
      `protect-metrics-endpoint` so the `@api` matcher and CSP header regions do
      not collide on merge.
