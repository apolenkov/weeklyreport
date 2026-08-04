# CustomReport E2E suites

Run every command from the repository root with `pnpm`. Browser suites use the
workspace Playwright installation owned by `@customreport/web`.

## Commands

| Command                                           | Purpose                                        | Data contract                                                     |
| ------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| `pnpm test:e2e:integration`                       | Cross-role API and web journeys                | Resets a dedicated `E2E_DATABASE_URL`; profile defaults to `full` |
| `E2E_SEED_PROFILE=demo pnpm test:e2e:integration` | Integration suite with one named profile       | `minimal`, `demo`, `full`, or `stress`                            |
| `pnpm test:e2e:seed-profiles`                     | Smoke-check all four deterministic profiles    | Resets the E2E database between profiles                          |
| `pnpm test:uat`                                   | Catalog route, console, network, and axe sweep | Report artifacts under `e2e/sweep/.reports/`                      |
| `pnpm catalog:check`                              | Check route/catalog drift without a browser    | Read-only                                                         |
| `pnpm test:e2e:prodbuild`                         | Production-build browser checks                | Uses isolated local ports                                         |
| `pnpm test:e2e:csp`                               | CSP checks against a production build          | Uses isolated local ports                                         |
| `pnpm test:runtime-sweep`                         | Declared Chromium runtime matrix               | Requires the guarded E2E database and archive path                |

## Destructive database boundary

`E2E_DATABASE_URL` is mandatory for integration, seed-profile, and runtime
sweeps. It must differ from `DATABASE_URL` and name an explicitly non-production
database. Global setup runs `prisma migrate reset --force`, then seeds the named
profile. Never point these commands at development, shared, UAT, or production
data.

Example:

```bash
export E2E_DATABASE_URL='postgresql://localhost/customreport_e2e_test'
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

## Runtime sweep with OpenCode Luna

The runtime campaign is deliberately bounded to Chromium at `1440x900`, the
four canonical roles, the four named seed profiles, catalog-reachable routes,
live DOM controls, declared state transitions, and controlled faults. Firefox,
WebKit, mobile, and production data are explicit exclusions, not covered cases.

1. Start the pinned standalone Playwright MCP server described in
   `e2e/sweep/driver/README.md` and require `opencode mcp list` to report
   `playwright connected`.
2. Set `RUNTIME_SWEEP_ARCHIVE` to a fresh directory under
   `~/work/customreport-archive/` and freeze `RUNTIME_SWEEP_SOURCE_SHA` to the
   clean source commit.
3. Run `pnpm test:runtime-sweep`; then run the bounded OpenCode drives
   sequentially. Codex owns database resets, the append-only ledger, candidate
   adjudication, and all reruns.
4. Resume an interrupted OpenCode drive with its recorded session id; never
   merge partial evidence from a different source SHA or seed digest.

Stateful cells may publish, delete, revoke, or restore only on the dedicated
disposable E2E database. Each is followed by reset/reseed and a database-oracle
check before another cell begins.
