## Why

BL-22 (P2, `docs/reviews/repo-excellence-review-2026-07-14.md`) plus three
council-confirmed misses folded into it by the Orchestrator amendments in the
same doc:

> - CONFIRMED **[P2] GitHub Actions pinned to mutable tags** (`@v4`), while
>   docker images are SHA-pinned — pin actions to SHAs for parity.
> - CONFIRMED **[P2] Staging Caddyfile CSP diverges from prod** (no
>   `script-src` in staging; prod has it) — staging stops rehearsing prod
>   policy.
> - CONFIRMED-CONFIG **[P2] alertmanager webhook → api:3002 `/api/alerts`** —
>   port/endpoint mismatch plausible; verify the receiver before wiring fixes.
> - Redis `requirepass` absence: not fully checked (compose `command` block
>   not audited) — carry as an open verify item, not a finding.

Every item is a **deploy-config parity gap**: something that works in one
environment (dev, CI, staging) and silently diverges from prod, so a
prod-layered run misbehaves in ways local testing never exercises. Verified
directly against the repo before writing this proposal:

- `docker-compose.observability.yml`'s `postgres-exporter` hardcodes
  `DATA_SOURCE_NAME=...customreport_dev` — the prod DB is `customreport`
  (`docker-compose.prod.yml:26` `POSTGRES_DB: customreport`). Any
  prod-layered observability run gets a blank Postgres dashboard.
- `deploy/prometheus-otel-lgtm.yml`'s only scrape target is
  `host.docker.internal:3002` (the dev host-published API port). Prod is
  expose-only (`docker-compose.prod.yml:254` `expose:`, port `3001`), so a
  prod-layered observability run never scrapes `/metrics`.
- `docker-compose.observability.yml`'s Grafana admin password defaults to
  `admin` (`GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:-admin}`) —
  a silent default on an exposed host port (`GRAFANA_PORT:-3003`), the exact
  anti-pattern `env.schema.ts` elsewhere enforces as REQUIRED-no-default.
- Dev/CI/observability-overlay images are mutable or version-tagged without a
  digest, unlike every prod image (`docker-compose.prod.yml` pins `postgres`,
  `pgbouncer`, `redis`, `caddy` all `@sha256:...`):
  `axllent/mailpit:latest` (`docker-compose.yml:39`),
  `bugsink/bugsink:latest` (`docker-compose.errors.yml:14`),
  `grafana/otel-lgtm:latest` (`docker-compose.observability.yml:22`),
  `prometheuscommunity/postgres-exporter:v0.15.0` and
  `oliver006/redis_exporter:v1.62.0` (version tag, no digest).
- `.github/workflows/ci.yml` uses `actions/checkout@v4`,
  `actions/setup-node@v4`, `actions/upload-artifact@v4` — all mutable
  major-version tags a tag-compromise on the upstream repo could silently
  redirect.
- `deploy/caddy/Caddyfile.staging`'s CSP
  (`Content-Security-Policy-Report-Only "default-src 'self'; img-src 'self'
data:; style-src 'self' 'unsafe-inline'; connect-src 'self'"`) omits
  `script-src` and `font-src`/Google Fonts origins that
  `deploy/caddy/Caddyfile` (prod) carries
  (`script-src 'self' 'unsafe-inline'; style-src ... https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com`). Staging report-only mode can't
  predict a prod enforcement violation it never emits.
- `deploy/alertmanager.yml`'s webhook targets `http://api:3002/api/alerts`.
  Prod's API container listens on `3001`
  (`docker-compose.prod.yml:177` `PORT: 3001`, `:254` `expose: [3001]`), and
  `/api/alerts` does not exist in the API — the file's own comment calls it
  "Stub: ... to be implemented when alerting is activated"
  (`deploy/alertmanager.yml:13`). Grepping `apps/api/src` for `api/alerts`
  turns up zero route matches. **Both the port and the endpoint are wrong,
  and there is currently no receiver to fix the endpoint to point at** —
  this is an open-verification item, not a two-line config fix (see Slice 4).
- `docker-compose.prod.yml`'s `redis` service `command` block
  (lines 104–113) sets `maxmemory-policy`, `maxmemory`, `appendonly` but no
  `--requirepass`, and `REDIS_URL`/`REDIS_HOST`/`REDIS_PORT` env vars carry no
  password anywhere in the file. This looks like a real gap on direct read,
  but per this review's disposition instructions it is carried as an
  **open-verification task**, not a confirmed finding, until someone traces
  every Redis-touching env var end-to-end (a partial credential could live in
  a `.env.prod` this repo doesn't check in).
- `docker-compose.observability.yml`'s `otel-lgtm` service publishes
  `${GRAFANA_PORT:-3003}:3000`, `4317:4317`, `4318:4318`, `9090:9090` with no
  interface binding, i.e. `0.0.0.0`. The finding's own recommendation pairs
  the Grafana-credential fix with this: "Bind observability host ports to
  127.0.0.1 **and** make GRAFANA_ADMIN_PASSWORD required." A required
  password alone still leaves Grafana, the OTLP receiver, and the Prometheus
  UI reachable from the public interface on any host with one; both halves
  are needed, not just the credential half.

**Note on the staging-CSP miss:** `openspec/specs/deploy-caddy-config/spec.md`
already has a requirement ("Staging and prod Caddyfiles carry matching
security-header floors") mandating exactly this parity.
`Caddyfile.staging`'s current CSP is a **live violation of an existing spec**,
not a spec gap — slice 3 below is a pure bug fix against that existing
requirement, with no new `specs/` delta.

## What Changes

Four sequential slices, ordered because slices 2–4 touch the same
Caddy/compose/monitoring files slice 1 touches (no parallel edits):

1. **BL-22 base — exporter/scrape parity + no-silent-default + digest pins +
   loopback binding.** Parameterize `postgres-exporter`'s DB name,
   add/enable a prod-reachable Prometheus scrape target for the API, require
   `GRAFANA_ADMIN_PASSWORD` with no default, digest-pin the five
   dev/CI/observability images listed above, and bind `otel-lgtm`'s four
   published host ports to `127.0.0.1`.
2. **GitHub Actions SHA pinning.** Pin `actions/checkout`,
   `actions/setup-node`, `actions/upload-artifact` in `ci.yml` to a reviewed
   commit SHA, with the release tag kept as a trailing comment.
3. **Staging CSP parity (bug fix against an existing spec).** Bring
   `Caddyfile.staging`'s `Content-Security-Policy-Report-Only` directive set
   in line with prod's `Content-Security-Policy` (add `script-src`,
   `font-src`, Google Fonts style/font origins), keeping staging's
   `Report-Only` mode. `openspec/specs/deploy-caddy-config` already requires
   this parity — this slice closes the violation, it does not add new spec
   surface.
4. **Alertmanager webhook — verify then correct.** First confirm there is no
   `/api/alerts` receiver anywhere in `apps/api/src` (already grepped clean
   for this proposal, re-verify at implementation time in case a slice
   1–20 change added one) and confirm the receiver's intended real port.
   Then either (a) if a receiver route genuinely doesn't exist yet, point
   the webhook at the correct prod port (`3001`) and leave the endpoint
   as the documented stub with an explicit `# not yet implemented` comment
   instead of a silently-wrong URL, or (b) if a receiver does exist by the
   time this is implemented, wire the correct port **and** endpoint.

Redis `requirepass` — one open-verification task appended to slice 1's task
list (not a fix task): trace every Redis-touching env var
(`REDIS_URL`/`REDIS_HOST`/`REDIS_PORT`/any `REDIS_PASSWORD`) across
`docker-compose.prod.yml`, `env.schema.ts`, and any `.env.prod.example`, and
only open a follow-up change if the trace confirms no password path exists.

## Claim disposition table

| Claim                                                          | Source             | Disposition                                                                                                                               | Evidence                                                                                                                                                                                   |
| -------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| postgres-exporter hardcoded to `customreport_dev`              | BL-22              | CONFIRMED                                                                                                                                 | `docker-compose.observability.yml:50` vs `docker-compose.prod.yml:26`                                                                                                                      |
| Prometheus scrapes dev port `3002`, unreachable in prod        | BL-22              | CONFIRMED                                                                                                                                 | `deploy/prometheus-otel-lgtm.yml:33-41` vs `docker-compose.prod.yml:254,177`                                                                                                               |
| Grafana admin/admin default                                    | BL-22              | CONFIRMED                                                                                                                                 | `docker-compose.observability.yml:40-41`                                                                                                                                                   |
| `:latest`/undigested dev/CI/observability images               | BL-22              | CONFIRMED                                                                                                                                 | `docker-compose.yml:39`, `docker-compose.errors.yml:14`, `docker-compose.observability.yml:22,49,58` vs `docker-compose.prod.yml` digest pins                                              |
| Prod CSP `unsafe-inline`                                       | BL-22              | ACCEPTED TRADEOFF, no action                                                                                                              | `deploy/caddy/Caddyfile:77-81` — documented Next.js inline-hydration constraint; review itself calls this an "accepted Next.js nonce-placement tradeoff"                                   |
| Grafana/OTLP/Prometheus host ports bound to `0.0.0.0`          | BL-22              | CONFIRMED — bundled with the Grafana-password fix in the original recommendation                                                          | `docker-compose.observability.yml:24-27` `otel-lgtm` `ports:` block has no interface prefix                                                                                                |
| GH Actions on mutable `@v4` tags                               | council/Codex      | CONFIRMED                                                                                                                                 | `.github/workflows/ci.yml:36,39,70,150,153,188,196,236,239,317,320,352,369`                                                                                                                |
| Second unmanaged ioredis client in `trpc.context.ts`           | council/Codex      | OUT OF SCOPE — already folded into BL-13 (PDF-export hardening change), not this change                                                   | review doc "Council-only misses" section                                                                                                                                                   |
| Staging CSP diverges from prod (no `script-src`)               | council/GLM        | CONFIRMED, and already a violation of the EXISTING `deploy-caddy-config` spec requirement — this slice is a bug fix, not new spec surface | `deploy/caddy/Caddyfile.staging:66-73` vs `deploy/caddy/Caddyfile:66-83`; `openspec/specs/deploy-caddy-config/spec.md` "Staging and prod Caddyfiles carry matching security-header floors" |
| Alertmanager webhook wrong port/endpoint                       | council/GLM        | CONFIRMED-CONFIG, open-verification-then-fix                                                                                              | `deploy/alertmanager.yml:15` vs `docker-compose.prod.yml:177`; zero `api/alerts` route matches in `apps/api/src`                                                                           |
| Redis has no `requirepass` in prod compose                     | council/GLM        | OPEN VERIFY, not a confirmed finding (per review disposition)                                                                             | `docker-compose.prod.yml:102-121` — command block has no `--requirepass`, but env-var trace not exhaustive                                                                                 |
| Caddy admin API (`:2019`) unauthenticated on container network | council/GLM (Low)  | OUT OF SCOPE — Low severity, not in the four confirmed-miss set this change was scoped to; note for a future P3 sweep                     | `docker-compose.prod.yml:342`                                                                                                                                                              |
| head cross-group archive/unarchive IDOR                        | council/GLM (High) | REJECTED — head lifecycle authz guards were an explicit declined product decision (2026-07)                                               | review doc "What NOT considered a problem"                                                                                                                                                 |

## Non-goals

- Caddy admin API auth (`:2019`) — Low severity, GLM council finding, not one
  of the three confirmed-misses this change was scoped to; leave for a future
  sweep.
- The second unmanaged Redis client in `trpc.context.ts` — already tracked
  under BL-13 (`harden-pdf-export-backend`), not duplicated here.
- Any CSP change to prod's own `Caddyfile` — prod's `unsafe-inline` is an
  accepted, documented tradeoff per the review; only staging is brought into
  parity with prod, not the other way around.
- Fixing/implementing the `/api/alerts` receiver itself — out of scope unless
  the verification step in slice 4 finds it already exists; implementing a
  new alerting receiver endpoint is a separate, larger change.
- Digest-pinning `postgres:15-alpine` / `redis:7-alpine` in the base (dev)
  `docker-compose.yml` — those are local dev conveniences reviewers didn't
  flag; only the five images explicitly named in BL-22's finding are pinned.

## File manifest

- `docker-compose.observability.yml` — parameterize `postgres-exporter`
  `DATA_SOURCE_NAME`, require `GRAFANA_ADMIN_PASSWORD`, digest-pin
  `grafana/otel-lgtm`, `prometheuscommunity/postgres-exporter`,
  `oliver006/redis_exporter`, bind `otel-lgtm`'s four published ports to
  `127.0.0.1`.
- `deploy/prometheus-otel-lgtm.yml` — add/enable a prod-reachable API scrape
  target.
- `docker-compose.yml` — digest-pin `axllent/mailpit`.
- `docker-compose.errors.yml` — digest-pin `bugsink/bugsink`.
- `.github/workflows/ci.yml` — SHA-pin the three `actions/*` steps.
- `deploy/caddy/Caddyfile.staging` — extend CSP directive set to match prod.
- `deploy/alertmanager.yml` — verify receiver, then correct port/endpoint.

## Verification

- Slice 1: `docker compose -f docker-compose.yml -f docker-compose.observability.yml config` parses clean; boot smoke — `docker compose ... up -d` then confirm `postgres-exporter` and Grafana both come up healthy, Grafana rejects the default `admin` login if `GRAFANA_ADMIN_PASSWORD` is unset (fails loud, not silent), and `docker compose port otel-lgtm 3000`-style inspection (or `netstat`/`ss` on the host) confirms the published ports bind `127.0.0.1` only, not `0.0.0.0`.
- Slice 2: `.github/workflows/ci.yml` still passes `actionlint` (or manual YAML validation if `actionlint` isn't installed) after SHA pins; comment-preserved release tags spot-checked against the pinned SHA via `gh api repos/actions/checkout/git/refs/tags/<tag>`.
- Slice 3: staging CSP parity requires a real browser check, not just a diff — bring up `docker-compose.prod.yml` with `Caddyfile.staging` mounted, load the app in a real browser, open DevTools Console/Network, and confirm no CSP violation is reported (or logged to `Content-Security-Policy-Report-Only`'s report endpoint) that prod's enforcing policy wouldn't also block, and that the app hydrates cleanly under the tightened report-only policy.
- Slice 4: `deploy/alertmanager.yml` change is validated with `docker compose -f docker-compose.prod.yml -f docker-compose.observability.yml config` parsing clean, plus a manual `curl` from inside the compose network to confirm the target port is actually listening (`docker compose exec alertmanager wget -qO- http://api:3001/health/ready` as a stand-in reachability check, since `/api/alerts` itself is a stub).
- Full local gate: `pnpm typecheck && pnpm lint && pnpm test` (no source code changed, but catches accidental YAML/JSON syntax breakage picked up by `lint:*` scripts if any touch config).

## Sequencing

Sequential, not parallel — slices 1, 3, and 4 all touch files under `deploy/`
and root `docker-compose*.yml`; running them concurrently on a shared tree
risks silent clobbering. Order: slice 1 (BL-22 base) → slice 2 (GH Actions,
independent file, can move first or last but kept last-but-one for review
grouping) → slice 3 (staging CSP) → slice 4 (alertmanager, gated on slice 3's
Caddy edits landing cleanly since both touch `deploy/`).
