# CustomReport E2E suites

Run every command from the repository root with `pnpm`. Browser suites use the
workspace Playwright installation owned by `@customreport/web`.

## Commands

| Command                                           | Purpose                                           | Data contract                                                          |
| ------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------- |
| `pnpm test:e2e:integration`                       | Cross-role API and web journeys                   | Resets a dedicated `E2E_DATABASE_URL`; profile defaults to `full`      |
| `E2E_SEED_PROFILE=demo pnpm test:e2e:integration` | Integration suite with one named profile          | `minimal`, `demo`, `full`, or `stress`                                 |
| `pnpm test:e2e:seed-profiles`                     | Smoke-check all four deterministic profiles       | Resets the E2E database between profiles                               |
| `pnpm test:uat`                                   | Catalog route, console, network, and axe sweep    | Report artifacts under `e2e/sweep/.reports/`                           |
| `pnpm catalog:check`                              | Check route/catalog drift without a browser       | Read-only                                                              |
| `pnpm test:e2e:prodbuild`                         | Production-build browser checks                   | Uses isolated local ports                                              |
| `pnpm test:e2e:csp`                               | CSP checks against a production build             | Uses isolated local ports                                              |
| `pnpm test:runtime-sweep`                         | Declared Chromium matrix and deterministic review | Requires the guarded E2E database and archive path                     |
| `pnpm test:runtime-source`                        | Freeze immutable `SOURCE.json`                    | Requires a clean `RUNTIME_SWEEP_SOURCE_SHA`                            |
| `pnpm test:runtime-preflight`                     | Prepare/reset and inventory every source state    | Requires `RUNTIME_SWEEP_SOURCE`, `RUNTIME_SWEEP_PREFLIGHT`, and E2E DB |
| `pnpm test:runtime-manifest`                      | Finalize `MATRIX.json` and `MANIFEST.json`        | Requires matching immutable SOURCE/PREFLIGHT artifacts                 |
| `pnpm test:runtime-driver`                        | Import native Codex Luna Max report(s)            | Requires explicit report, cells, output, SHA, profile, and role        |

## Destructive database boundary

`E2E_DATABASE_URL` is mandatory for integration, seed-profile, and runtime
sweeps. It must differ from `DATABASE_URL` and name an explicitly non-production
database. Global setup runs `prisma migrate reset --force`, then seeds the named
profile. Never point these commands at development, shared, UAT, or production
data.

Example:

```bash
unset DATABASE_URL
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

## Runtime sweep and native Codex Luna review

The runtime campaign is deliberately bounded to Chromium at `1440x900`, the
four canonical roles, the four named seed profiles, catalog-reachable routes,
live DOM controls, declared state transitions, and controlled faults. Firefox,
WebKit, mobile, and production data are explicit exclusions, not covered cases.

1. Treat the deterministic Playwright projects as the exhaustive authority.
   They run in one worker in the fixed order
   `runtime-prerequisites -> runtime-baseline -> runtime-matrix ->
runtime-live-controls`. The required supplemental native Codex Luna review
   is bounded to canonical role/profile evidence batches, emits candidates
   only, and never runs an external provider process or mutates the ledger.
2. Set `RUNTIME_SWEEP_ARCHIVE` to a fresh directory under
   `~/work/customreport-archive/` and freeze `RUNTIME_SWEEP_SOURCE_SHA` to the
   clean source commit. The observer requires
   `RUNTIME_SWEEP_API_LOG`, `RUNTIME_SWEEP_BUGSINK_DSN`,
   `RUNTIME_SWEEP_BUGSINK_API_TOKEN`, `RUNTIME_SWEEP_LOKI_PUSH_URL`, and
   `RUNTIME_SWEEP_LOKI_QUERY_URL`; a missing or unreachable value is blind and
   fails the drive closed. Bugsink requires both the DSN and a 40-character
   lowercase-hex API token, and the DSN must point at the dedicated
   `runtime-sweep` project. The harness is sequential and assumes no other
   writers use that project while counters are polled; this is not a generic
   concurrent liveness proof. Loki
   `RUNTIME_SWEEP_LOKI_USERNAME` and `RUNTIME_SWEEP_LOKI_PASSWORD` are an
   optional pair: leave both unset for an unauthenticated local Loki, or set
   both for an authenticated Loki. Keep values in the shell; never write
   credentials, API tokens, or DSNs to campaign artifacts.
   The live runtime API receives
   `LOG_DIR=$RUNTIME_SWEEP_ARCHIVE/api-log/$RUNTIME_SWEEP_PROFILE` and writes
   JSONL to `app.log`; export the exact same-run profile path explicitly:
   `export RUNTIME_SWEEP_API_LOG="$RUNTIME_SWEEP_ARCHIVE/api-log/$RUNTIME_SWEEP_PROFILE/app.log"`.
   Before import, require that file to exist inside the current campaign
   archive; never reuse a log path from another profile or run.
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

   Both the runtime-preflight and live runtime Playwright configs deliberately
   set `NEXT_PUBLIC_AUTH_STUB=true` only to keep anonymous login bootstrap
   stable. The web proxy still requires a session cookie for protected routes;
   this setting is not an authentication bypass.

4. Run `pnpm test:runtime-sweep` once for each `RUNTIME_SWEEP_PROFILE` value
   (`minimal`, `demo`, `full`, and `stress`). Playwright starts the API and web
   servers from the current source and runs the four deterministic projects in
   one worker. Each run
   writes immutable case projections under `cells/<profile>/<role>/`; do not
   reuse an archive from another source SHA.

   If a browser or Driver crash stops inside a live-control shard, preserve the
   partial attempt outside the canonical `routes/` and `cells/` paths, reset or
   reseed the dedicated E2E database, and replay only the missing frozen case
   identities:

   ```bash
   export RUNTIME_SWEEP_CASE_IDS='matrix-case-...,...'
   export RUNTIME_SWEEP_REUSE_DATABASE=true
   pnpm test:runtime-sweep --project runtime-live-controls --no-deps
   ```

   `RUNTIME_SWEEP_CASE_IDS` is an exact comma-separated identity allowlist. The
   runner rejects empty, duplicate, or foreign-profile ids and preserves the
   frozen MATRIX order. Never point it at a case whose canonical projection or
   artifact path already exists; immutable writes fail closed.

5. After all four profile runs finish, build the one ordered immutable baseline
   ledger from the frozen MATRIX:

   ```bash
   pnpm test:runtime-coverage
   ```

   The finalizer reads every expected case projection, verifies exact
   Frozen-MATRIX identity and order, and creates
   `baseline/coverage-cells.jsonl` with exclusive creation. A missing,
   duplicate, stale, or already-published case fails closed.

6. Import a native Codex Luna Max report only with explicit paths and identity:

   ```bash
   pnpm test:runtime-driver -- \
     --report /archive/native-codex/lead.json \
     --cells /archive/cells/minimal/lead \
     --output /archive/imported/minimal-lead \
     --transcript /archive/native-codex/lead.transcript.jsonl \
     --source-sha "$(git rev-parse HEAD)" \
     --profile minimal \
     --role lead
   ```

   Supply exactly one `--transcript` JSONL path per `--report`; missing or
   unreadable transcript files, or any blind environment channel, fail before
   output is written. A report containing candidates (including candidates
   generated from environment hits) also requires an explicit
   `--verification /archive/native-codex/lead.verification.json` import. The
   command rejects missing, malformed, stale, partial, or unverified reports;
   see `e2e/sweep/driver/README.md` for the record shape.

Stateful cells may publish, delete, revoke, or restore only on the dedicated
disposable E2E database. Each is followed by reset/reseed and a database-oracle
check before another cell begins.

The native report is rejected when its canary or an applicable environment
channel is blind. Deterministic Playwright captures browser `pageerror` events
separately, while the native API log, Bugsink, and Loki probes bind server-side
signals to the review timeline. Never treat an empty candidate list as a pass
without live canary/environment evidence and complete deterministic cells.
