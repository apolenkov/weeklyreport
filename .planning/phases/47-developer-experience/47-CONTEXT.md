# Phase 47: Developer Experience — Context

**Gathered:** 2026-05-10 (in-chat surface during Phase 44 UAT)
**Status:** Ready for planning
**Mode:** Standard horizontal — three independent plans, no inter-plan deps
**Driver:** dev-loop friction surfaced during Phase 44

<domain>
## Phase Boundary

Three independent DX/observability upgrades that share no code surface but
share a single goal: stop wasting dev time on stale-container bugs, missing
build steps, and blind spots in API performance.

**In scope:**

- **47-01 docker compose watch** — replace `node --watch` (which silently
  freezes after 24+ hours of uptime) with `docker compose develop.watch`
  syntax (compose v2.22+). Add `develop:` section with sync+restart actions
  for `apps/api/src/`, `apps/web/src/`, `packages/shared/src/`,
  `prisma/schema.prisma`. Behavior: file change → container restarts
  automatically; no manual `docker compose restart` needed.

- **47-02 git hooks + CI** — add `post-merge` and `post-rewrite` Husky hooks
  that auto-run `pnpm install` (if `pnpm-lock.yaml` changed) and
  `pnpm exec prisma generate` (if `prisma/schema.prisma` changed). Add
  GitHub Actions workflow `ci.yml` that runs `lint + test + build` on
  every push to `main` and on PR open. CI does NOT push back to repo,
  just signals red/green.

- **47-03 tRPC latency dashboard** — instrument the existing NestJS tRPC
  middleware with `prom-client` histograms (`trpc_request_duration_seconds`
  labeled by `procedure`, `type`, `status`). Add Grafana dashboard JSON
  with p50/p95/p99 panels, error-rate panel, top-10-slow procedures table.
  Prometheus + Grafana are ALREADY in `docker-compose.yml`; only the
  metric emission + dashboard provisioning are missing.

**Out of scope:**

- Replacing `node --watch` with a different process manager (PM2, nodemon) —
  docker watch is upstream of process restart.
- Adding new CI jobs beyond test/lint/build (no e2e in CI yet — defer to a
  later phase; Playwright is local-only today).
- Adding RED/golden-signal alerts on top of metrics (just panels for now;
  alerting is a Phase 48 if it ever becomes necessary).
- Migrating the existing Phase 37 observability stack — only ADD new
  metric and dashboard, don't refactor what's there.
- pg_stat_statements (mentioned in perf-baseline as P2) — that's a Postgres
  config change, separate from API instrumentation.
- Replacing pnpm or Docker — toolchain stable.

</domain>

<decisions>
## Implementation Decisions

- **`docker compose watch` over `nodemon`/`tsx --watch` swap.** The actual
  failure mode today is that the inner process watcher gets killed by
  Docker's signal handling or memory pressure after long uptimes. The
  outer Docker watch loop is a separate supervisor that survives inner
  process crashes — strictly better failure semantics.

- **`develop.watch` action = `restart`, not `sync+restart`.** For source
  files (.ts/.tsx), `sync` re-copies the file inside the container then
  reloads. For TS code that compiles via swc-register at boot, plain
  `restart` is faster + simpler. `sync+restart` only matters for assets
  that the running process reads at runtime (PDF templates, etc.) — not
  our path.

- **Husky post-merge, not pre-commit.** Pre-commit is for blocking bad
  commits. Post-merge fires after `git pull` and after merge resolves —
  exactly when `pnpm install` + `prisma generate` are needed. Same for
  `post-rewrite` (covers `git rebase` outcomes).

- **GitHub Actions CI even if repo not yet pushed to GitHub.** The workflow
  file is idempotent on the filesystem; if there is no remote, the file
  costs nothing. As soon as the remote is added, CI starts working without
  edits.

- **`prom-client` over `nestjs-prometheus`.** `prom-client` is the
  upstream OSS library (8M weekly downloads, MIT). `nestjs-prometheus`
  is a thin wrapper that pins `prom-client` versions and adds DI sugar
  we don't need (we already inject middleware manually in
  `apps/api/src/infrastructure/trpc/`). Less indirection = easier to
  reason about.

- **Histogram buckets** match the SLO ladder we care about: 5ms, 25ms,
  50ms, 100ms, 250ms, 500ms, 1s, 2.5s, 5s, 10s. p50 < 50ms p95 < 250ms
  is the budget for tRPC procedures today (per the perf-baseline doc).

- **Grafana dashboard provisioned via JSON file in
  `docker/grafana/dashboards/`,** not edited in UI. Provisioning makes
  the dashboard reproducible across machines.

</decisions>

<code_context>

## Existing Code Insights

- `docker-compose.yml`, `docker-compose.dev.yml` — both define
  `customreport-api-1` and `customreport-web-1`. The dev compose file
  uses `node --import @swc-node/register/esm-register --watch src/main.ts`
  for the api container (per `docker inspect` we ran earlier). Add a
  `develop:` block to BOTH compose files (or only `dev` if production
  uses a different process).

- `package.json` (root) — has Husky already wired
  (see `"prepare": "husky"`). Hooks live in `.husky/`. Currently
  pre-commit runs `lint-staged`. Add `post-merge` and `post-rewrite`
  files there.

- `.github/workflows/` — directory may not exist yet. If it doesn't,
  create with `ci.yml`. The workflow needs Node 22 + pnpm 10 setup,
  `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm lint`,
  `pnpm build` matrix (api + web).

- `apps/api/src/infrastructure/trpc/trpc.middleware.ts` — already has
  a logger middleware that logs `procedure`, `duration`, `status`.
  Add a sibling metrics middleware that increments
  `trpc_request_total{status}` and observes
  `trpc_request_duration_seconds{procedure,type}`.

- `apps/api/src/main.ts` — bootstrap; expose `/metrics` HTTP endpoint
  that returns `register.metrics()` from prom-client. Prometheus
  scrape config in `docker/prometheus/prometheus.yml` (or wherever the
  existing Phase 37 config lives) needs a job for `customreport-api-1`
  on `:3002/metrics`.

- `docker/grafana/provisioning/` (assumed path; verify in 47-03) —
  Phase 37 likely set this up; add a dashboard JSON file alongside
  the existing ones.

</code_context>

<specifics>
## Specific Ideas

- **47-01 docker compose watch:**

  ```yaml
  # In docker-compose.dev.yml, under customreport-api-1:
  services:
    api:
      develop:
        watch:
          - action: restart
            path: ./apps/api/src
          - action: restart
            path: ./packages/shared/src
          - action: restart
            path: ./prisma/schema.prisma
    web:
      develop:
        watch:
          - action: restart
            path: ./apps/web/src
          - action: restart
            path: ./packages/shared/src
  ```

  Usage: `docker compose up --watch` (the `--watch` flag is new in v2.22).
  Document in README + add a script `pnpm dev:watch` that invokes it.

- **47-02 git hooks:**

  ```sh
  # .husky/post-merge
  changed_files="$(git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD)"
  echo "$changed_files" | grep -q '^pnpm-lock\.yaml$' && pnpm install
  echo "$changed_files" | grep -q '^prisma/schema\.prisma$' && pnpm exec prisma generate
  ```

  ```yaml
  # .github/workflows/ci.yml
  name: ci
  on: [push, pull_request]
  jobs:
    test:
      runs-on: ubuntu-latest
      services:
        postgres:
          image: postgres:15-alpine
          env:
            {
              POSTGRES_PASSWORD: localdev,
              POSTGRES_USER: customreport,
              POSTGRES_DB: customreport,
            }
          ports: ["5432:5432"]
        redis: { image: redis:7-alpine, ports: ["6379:6379"] }
      steps:
        - uses: actions/checkout@v4
        - uses: pnpm/action-setup@v4
        - uses: actions/setup-node@v4
          with: { node-version: 22, cache: pnpm }
        - run: pnpm install --frozen-lockfile
        - run: pnpm exec prisma migrate deploy
        - run: pnpm lint
        - run: pnpm test
        - run: pnpm build
  ```

- **47-03 tRPC metrics middleware:**

  ```ts
  // apps/api/src/infrastructure/trpc/trpc.metrics.middleware.ts
  import { Histogram, Counter, register } from "prom-client";

  const duration = new Histogram({
    name: "trpc_request_duration_seconds",
    help: "tRPC request duration",
    labelNames: ["procedure", "type", "status"],
    buckets: [0.005, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [register],
  });

  export const metricsMiddleware = trpc.middleware(
    async ({ path, type, next }) => {
      const end = duration.startTimer({ procedure: path, type });
      const res = await next();
      end({ status: res.ok ? "success" : "error" });
      return res;
    },
  );
  ```

  Dashboard panels: p50/p95/p99 by procedure (timeseries), error rate
  (stat), top-10 slowest procedures (bar gauge), request volume (timeseries).

</specifics>

<deferred>
## Deferred Ideas

- **RED-method alerting** (Rate / Errors / Duration) — panels only first,
  alerts when there is real production traffic and someone to page.
- **Distributed tracing** (OpenTelemetry → Tempo) — separate phase if it
  ever becomes necessary; for single-service api a histogram is enough.
- **Postgres `pg_stat_statements`** — DB-side perf telemetry, complements
  but does not replace API metrics. Phase 48 if it becomes a need.
- **E2E tests in CI** — Playwright is local-only today; CI Playwright
  costs runner time. Wait until E2E suite stabilizes.
- **pnpm cache in CI** — `actions/setup-node`'s `cache: pnpm` flag
  handles this for now; dedicated cache layer when CI gets slow.

</deferred>

## Verification Targets

After Phase 47 lands:

```bash
# 1. docker watch wakes up the container on file change
echo "// noop" >> apps/api/src/main.ts
# observe `docker logs customreport-api-1` to show restart within ~3s

# 2. post-merge hook fires
git pull  # then assert: prisma client regenerated if schema changed

# 3. CI runs
git push  # GitHub Actions workflow turns green

# 4. metrics surface
curl http://localhost:3002/metrics | grep trpc_request_duration_seconds
# expected: histogram series for every observed procedure

# 5. dashboard renders
open http://localhost:3003/d/trpc-latency
# panels populated with recent traffic
```

## Acceptance Gate

Phase 47 closes when:

1. ✓ `docker compose up --watch` restarts api+web on src/schema changes
2. ✓ `.husky/post-merge` and `.husky/post-rewrite` run install + generate
3. ✓ `.github/workflows/ci.yml` exists and a dry-run with `act` (or a real
   push to a fork) is green
4. ✓ `/metrics` endpoint on api returns tRPC histogram series
5. ✓ Grafana dashboard at `/d/trpc-latency` renders p50/p95/p99
6. ✓ Documentation in README updated with `dev:watch` script + CI badge
