# CustomReport E2E suites

Run every command from the repository root with `pnpm`. Browser suites use the
workspace Playwright installation owned by `@customreport/web`.

## Commands

| Command                                           | Purpose                                        | Data contract                                                          |
| ------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| `pnpm test:e2e:integration`                       | Cross-role API and web journeys                | Resets a dedicated `E2E_DATABASE_URL`; profile defaults to `full`      |
| `E2E_SEED_PROFILE=demo pnpm test:e2e:integration` | Integration suite with one named profile       | `minimal`, `demo`, `full`, or `stress`                                 |
| `pnpm test:e2e:seed-profiles`                     | Smoke-check all four deterministic profiles    | Resets the E2E database between profiles                               |
| `pnpm test:uat`                                   | Catalog route, console, network, and axe sweep | Report artifacts under `e2e/sweep/.reports/`                           |
| `pnpm catalog:check`                              | Check route/catalog drift without a browser    | Read-only                                                              |
| `pnpm test:e2e:prodbuild`                         | Production-build browser checks                | Uses isolated local ports                                              |
| `pnpm test:e2e:csp`                               | CSP checks against a production build          | Uses isolated local ports                                              |
| `pnpm test:runtime-sweep`                         | Declared Chromium matrix and Flash Driver      | Requires the guarded E2E database and archive path                     |
| `pnpm test:runtime-source`                        | Freeze immutable `SOURCE.json`                 | Requires a clean `RUNTIME_SWEEP_SOURCE_SHA`                            |
| `pnpm test:runtime-preflight`                     | Prepare/reset and inventory every source state | Requires `RUNTIME_SWEEP_SOURCE`, `RUNTIME_SWEEP_PREFLIGHT`, and E2E DB |
| `pnpm test:runtime-manifest`                      | Finalize `MATRIX.json` and `MANIFEST.json`     | Requires matching immutable SOURCE/PREFLIGHT artifacts                 |
| `pnpm test:runtime-driver`                        | Resume Flash Driver against a live source      | Requires `RUNTIME_SWEEP_BASE_URL`; never falls back                    |

## Destructive database boundary

`E2E_DATABASE_URL` is mandatory for integration, seed-profile, and runtime
sweeps. It must differ from `DATABASE_URL` and name an explicitly non-production
database. Global setup runs `prisma migrate reset --force`, then seeds the named
profile. Never point these commands at development, shared, UAT, or production
data.

Example:

```bash
export E2E_DATABASE_URL='postgresql://localhost/customreport_e2e'
pnpm test:e2e:integration
```

## Suite layout

```text
e2e/
|-- integration/       deterministic cross-role browser journeys
|-- seed-profiles/     minimal/demo/full/stress profile smoke checks
|-- catalog/           durable per-role Behavioral Scenario oracle
|-- sweep/             route-level catalog sweep and AI Driver protocol
|-- runtime-sweep/     typed exhaustive-runtime matrix and evidence harness
|-- csp/               production Content-Security-Policy checks
|-- playwright.*.config.ts
`-- helpers/           guarded database preparation
```

The integration suite is single-worker because it shares deterministic state.
Run one spec by forwarding its path:

```bash
pnpm --filter @customreport/web exec playwright test \
  --config ../../e2e/playwright.integration.config.ts \
  e2e/integration/lead-journey.integration.spec.ts
```

## Runtime sweep with OpenCode DeepSeek V4 Flash Max

The runtime campaign is deliberately bounded to Chromium at `1440x900`, the
four canonical roles, the four named seed profiles, catalog-reachable routes,
live DOM controls, declared state transitions, and controlled faults. Firefox,
WebKit, mobile, and production data are explicit exclusions, not covered cases.

1. Start the pinned standalone Playwright MCP server described in
   `e2e/sweep/driver/README.md` and require `opencode mcp list` to report
   `playwright connected`.
2. Set `RUNTIME_SWEEP_ARCHIVE` to a fresh directory under
   `~/work/customreport-archive/` and freeze `RUNTIME_SWEEP_SOURCE_SHA` to the
   clean source commit. Point `RUNTIME_SWEEP_API_LOG` at the native API JSON
   log and configure the local feedback probes with
   `RUNTIME_SWEEP_BUGSINK_DSN`, `RUNTIME_SWEEP_LOKI_PUSH_URL`,
   `RUNTIME_SWEEP_LOKI_QUERY_URL`, `RUNTIME_SWEEP_LOKI_USERNAME`, and
   `RUNTIME_SWEEP_LOKI_PASSWORD`. Keep those values in the shell; never write
   credentials or DSNs to campaign artifacts.
3. Freeze the campaign inputs before starting any browser work:

   ```bash
   export RUNTIME_SWEEP_CAMPAIGN_ID='runtime-sweep-YYYYMMDD'
   export RUNTIME_SWEEP_SOURCE_SHA="$(git rev-parse HEAD)"
   pnpm test:runtime-source
   export RUNTIME_SWEEP_SOURCE="$RUNTIME_SWEEP_ARCHIVE/SOURCE.json"
   export RUNTIME_SWEEP_PREFLIGHT="$RUNTIME_SWEEP_ARCHIVE/PREFLIGHT.json"
   pnpm test:runtime-preflight
   pnpm test:runtime-manifest
   ```

   Stage A writes the immutable `SOURCE.json` plan. The dedicated preflight
   stage resets/prepares every nominal segment, navigates through the assigned
   route binding, inventories semantic controls, and writes `PREFLIGHT.json`.
   Stage B refuses to run without both artifacts, revalidates the clean HEAD,
   then atomically publishes `MATRIX.json` and `MANIFEST.json`. There is no
   navigation or matrix fallback when PREFLIGHT is missing.

4. Run `pnpm test:runtime-sweep` once for each `RUNTIME_SWEEP_PROFILE` value
   (`minimal`, `demo`, `full`, and `stress`). Playwright starts the API and web
   servers from the current source and runs
   `runtime-prerequisites -> runtime-baseline -> runtime-matrix ->
runtime-live-controls -> opencode-flash-driver` in one worker. Each run
   writes immutable case projections under `cells/<profile>/<role>/`; do not
   reuse an archive from another source SHA.
5. After all four profile runs finish, build the one ordered immutable baseline
   ledger from the frozen MATRIX:

   ```bash
   pnpm test:runtime-coverage
   ```

   The finalizer reads every expected case projection, verifies exact
   Frozen-MATRIX identity and order, and creates
   `baseline/coverage-cells.jsonl` with exclusive creation. A missing,
   duplicate, stale, or already-published case fails closed.

6. Resume an interrupted Driver directly only while the same current-source
   server is live, with its exact URL explicitly supplied:

   ```bash
   export RUNTIME_SWEEP_BASE_URL='http://127.0.0.1:3105'
   pnpm test:runtime-driver
   ```

   The direct command rejects missing, non-loopback, non-live, or stale-source
   targets. Never merge partial evidence from a different source SHA or seed
   digest.

Stateful cells may publish, delete, revoke, or restore only on the dedicated
disposable E2E database. Each is followed by reset/reseed and a database-oracle
check before another cell begins.

The driver result is rejected when any feedback channel is blind. OpenCode must
actually call the Playwright MCP console and network tools; a declared clean
result is not evidence. Deterministic Playwright captures browser `pageerror`
events separately, while the native API log, Bugsink, and Loki probes bind
server-side signals to the driver's route timeline.
