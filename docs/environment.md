# Environment contract

This repository has one source of truth per process boundary. Keep real
environment files outside Git; tracked `*.example` files contain names and
safe placeholders only.

| Runtime                   | Loads                                                                       | Owns                                                               | Required contract                                                                                                                                                                                                                                                            |
| ------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native development        | Root `.env` loaded explicitly by both package scripts                       | API runtime, Prisma CLI, native Web server and build-time values   | Copy `.env.example`; run the guarded `db:bootstrap:local` against exact `weeklyreport_e2e`; API uses port `3002`, Web uses `3000`, and both bind to `127.0.0.1`.                                                                                                             |
| Unit tests                | Vitest setup and per-test stubs; no personal env file                       | Deterministic test doubles                                         | `pnpm test`; tests must not depend on a developer's `.env`.                                                                                                                                                                                                                  |
| Guarded API integration   | Root `.env.test` loaded by `apps/api/vitest.integration.config.ts`          | Disposable PostgreSQL `weeklyreport_e2e` and Redis logical DB `15` | Copy `.env.test.example` to `.env.test`; set `E2E_DATABASE_URL`, `API_HOST=127.0.0.1`, Redis host/port, `REDIS_DB=15`, and `REDIS_MAXMEMORY_BYTES`. Destructive operations require the exact guard and per-run consent.                                                      |
| Source browser acceptance | Explicit shell variables plus a source-run API/web                          | One-off local browser session                                      | Use the same dev API/web origins (`3002`/`3000`) and `AUTH_DEV_MODE=true`; do not add a browser harness or commit browser state.                                                                                                                                             |
| Local dependencies        | Fixed disposable values in the manifest                                     | `deploy/local-dev/deps.yaml`                                       | `pnpm deps:up` starts PostgreSQL, Redis, Mailpit and Gotenberg in the OrbStack namespace `wr-dev`, then run the guarded bootstrap.                                                                                                                                           |
| Production Helm           | Reviewed values outside Git, Kubernetes Secrets, and CI Web build arguments | `deploy/helm/weeklyreport/` and `.gitlab-ci.yml`                   | Start from `values.production.example.yaml`; `values.schema.json` rejects absent required inputs. Keep `DB_PASSWORD` URL-safe and `postgres.db` a simple identifier. The chart derives internal origins and release identity; `NEXT_PUBLIC_*` values require an image build. |
| CI                        | Job `env` blocks                                                            | `.gitlab-ci.yml` (manual image build and deploy only)              | No test lanes in CI; checks run locally in pre-push. No developer `.env` is uploaded or required.                                                                                                                                                                            |

## Agentation feedback and MCP

The pinned product packages are `agentation@3.1.2` (authenticated browser UI)
and `agentation-mcp@1.3.2` (agent transport). The UI uses the same-origin
WeeklyReport adapter and the current authenticated session cookie. The adapter
maps sessions, annotations, statuses, threads, actions, and SSE to the
WeeklyReport PostgreSQL feedback store; PostgreSQL is the sole product source
of truth.

Run MCP only in `--mcp-only --http-url` mode:

```sh
pnpm agentation:mcp
# equivalent: agentation-mcp server --mcp-only \
#   --http-url http://127.0.0.1:3002/api/v1/agentation
```

MCP does not forward the browser session cookie. The WeeklyReport adapter
authenticates MCP requests with the optional `x-api-key` value from
`AGENTATION_API_KEY`; the value is never committed, printed, or placed in this
file. The adapter accepts this credential only from a loopback socket; remote
clients are rejected even when the key matches. Do not use the
stock Agentation HTTP server, wildcard CORS, or its `memory`/`sqlite` store for
WeeklyReport. Any stock SQLite file is limited to an isolated developer
experiment and is not an application, shared, staging, or production store.

The toolbar is enabled only by explicit non-production configuration:
`PRODUCT_FEEDBACK_ENABLED=true` and
`NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED=true`, with `AUTH_DEV_MODE=true` only
for local development. Production examples keep both feedback flags false;
the API must fail closed if required configuration is absent or if a dev flag
is enabled under `NODE_ENV=production`.

## Local observability

The repository ships no local observability stack. Tracing stays off
(`OTEL_SDK_DISABLED=true` in `.env.example`) until an operator points
`OTEL_EXPORTER_OTLP_ENDPOINT` at a collector and sets it to `false`. Grafana
dashboards and Prometheus alert rules live under
`deploy/helm/weeklyreport/observability/` as DevOps reference material; see
`docs/kubernetes.md`.

## Precedence and ownership

Production CI and Helm fix
`API_URL=http://api:3001` for the Next build and Web runtime; it is not a Helm
operator value. Native API and Web scripts both load the root `.env`; an already
exported shell variable takes precedence.
Next `NEXT_PUBLIC_*` values are compiled into the Web bundle, so changing them
requires a rebuild. Server-only `API_URL` and `FRONTEND_URL` are read at runtime
by Next: `API_URL` selects the only API origin, while `FRONTEND_URL` supplies the
public origin for browser-origin checks. API values are validated by
`apps/api/src/infrastructure/config/env.schema.ts`; web toggles are validated by
`apps/web/src/shared/lib/runtime/web-env.ts`, API URL selection is owned by
`apps/web/src/shared/server/transport/api-url.ts`, and the Web public origin is
validated by `apps/web/src/shared/server/transport/public-web-origin.ts`.

Native listeners fail on a port collision instead of terminating an unrelated
process.

Never commit `.env`, `.env.test`, `.env.production`, or web-local env files.
These files may contain credentials, private IdP certificates, database URLs,
DSNs, or personal test data. Share only variable names and redacted pass/fail
evidence in reviews. Guarded PostgreSQL `weeklyreport_e2e` is disposable;
product/dev Redis DB 0 is not and the bootstrap never flushes it. Integration
Redis cleanup is separately restricted to DB 15.

For deployment, replace the chart example's placeholders, review all required
values, and supply the chosen Secret source. Missing required values fail Helm
rendering; example domains and names do not prove usable external services. The
release tag is required even while telemetry is disabled and also supplies
`OTEL_SERVICE_VERSION`, so enabling an exporter later cannot publish data under
a development identity. External Sentry,
SMTP, Keycloak, DNS, TLS, and off-host backup providers remain
deployment inputs rather than repository defaults.
