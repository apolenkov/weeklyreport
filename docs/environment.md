# Environment contract

This repository has one source of truth per process boundary. Keep real
environment files outside Git; tracked `*.example` files contain names and
safe placeholders only.

| Runtime                   | Loads                                                              | Owns                                                               | Required contract                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native development        | Root `.env` loaded explicitly by both package scripts              | API runtime, Prisma CLI, native Web server and build-time values   | Copy `.env.example`; run the guarded `db:bootstrap:local` against exact `customreport_e2e`; API uses port `3002`, Web uses `3000`, and both bind to `127.0.0.1`.                                                                                                                                                                                                  |
| Unit tests                | Vitest setup and per-test stubs; no personal env file              | Deterministic test doubles                                         | `pnpm test`; tests must not depend on a developer's `.env`.                                                                                                                                                                                                                                                                                                       |
| Guarded API integration   | Root `.env.test` loaded by `apps/api/vitest.integration.config.ts` | Disposable PostgreSQL `customreport_e2e` and Redis logical DB `15` | Copy `.env.test.example` to `.env.test`; set `E2E_DATABASE_URL`, `API_HOST=127.0.0.1`, Redis host/port, `REDIS_DB=15`, and `REDIS_MAXMEMORY_BYTES`. Destructive operations require the exact guard and per-run consent.                                                                                                                                           |
| Source browser acceptance | Explicit shell variables plus a source-run API/web                 | One-off local browser session                                      | Use the same dev API/web origins (`3002`/`3000`) and `AUTH_DEV_MODE=true`; do not add a browser harness or commit browser state.                                                                                                                                                                                                                                  |
| Local dependencies        | Compose interpolation from root `.env`                             | `docker-compose.yml`                                               | Start the local PostgreSQL and Redis services explicitly, then run the guarded bootstrap.                                                                                                                                                                                                                                                                         |
| Production Compose        | `.env.production` passed with `--env-file`                         | `docker-compose.prod.yml` and optional observability overlay       | Copy `deploy/environment/production.env.example`; required values fail Compose rendering. `NEXT_PUBLIC_*` values are build-time, production Compose owns one immutable internal `API_URL` for Next rewrites and server fetches, `DB_PASSWORD` is URL-safe, `POSTGRES_DB` is a simple identifier, and the observability overlay requires `GRAFANA_ADMIN_PASSWORD`. |
| CI                        | Workflow job `env` blocks and service containers                   | `.github/workflows/ci.yml`                                         | CI uses disposable PostgreSQL `customreport_e2e`, Redis DB `15`, and non-production values. No developer `.env` is uploaded or required.                                                                                                                                                                                                                          |

## Optional local observability overlays

`pnpm observability:up` reads the root `.env`, joins the current local Compose
project, and reuses its PostgreSQL, Redis, and Mailpit services while adding
Grafana/OTel and Bugsink. It never creates a second host-bound dependency
stack. `pnpm observability:down` removes only those observability services. The
host ports are loopback-only. The production example composes only the
Grafana/OTel overlay; the Bugsink errors overlay is not part of the production
command or its environment template.

| Variable             | Scope and default                                   | Security contract                                                               |
| -------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- |
| `GRAFANA_PORT`       | Grafana host port; defaults to `3003`               | Loopback binding; change only for a local port collision.                       |
| `GRAFANA_ADMIN_USER` | Grafana UI user; defaults to `admin`                | Local convenience default; choose an explicit operator identity elsewhere.      |
| `BUGSINK_PORT`       | Local Bugsink host port; defaults to `8000`         | Loopback binding; change only for a local port collision.                       |
| `BUGSINK_SECRET_KEY` | Required by the errors overlay; no Compose fallback | The example value is local-only; replace it with a unique secret outside local. |

## Precedence and ownership

Compose interpolation reads the shell and the Compose project env file before
service `environment` values are assembled. A service's `environment` value is
not available for interpolation elsewhere. Production Compose therefore uses
one named YAML anchor for `API_URL`, rather than an operator env value, so the
Next build and Web runtime cannot diverge. Native API and Web scripts both
load the root `.env`; an already exported shell variable takes precedence.
Next `NEXT_PUBLIC_*` values are compiled into the Web bundle, so changing them
requires a rebuild. Server-only `API_URL` is read at runtime by Next; it is the only API origin. API values are validated by
`apps/api/src/infrastructure/config/env.schema.ts`; web toggles are validated by
`apps/web/src/shared/lib/runtime/web-env.ts`, and API URL selection is owned by
`apps/web/src/shared/server/transport/api-url.ts`.

Native listeners fail on a port collision instead of terminating an unrelated
process. Docker explicitly binds API and Web to `0.0.0.0` inside the private
Compose network; only the loopback-published host ports cross that boundary.

Never commit `.env`, `.env.test`, `.env.production`, or web-local env files.
These files may contain credentials, private IdP certificates, database URLs,
DSNs, or personal test data. Share only variable names and redacted pass/fail
evidence in reviews. Guarded PostgreSQL `customreport_e2e` is disposable;
product/dev Redis DB 0 is not and the bootstrap never flushes it. Integration
Redis cleanup is separately restricted to DB 15.

For deployment, the production template is intentionally not a working
configuration until every required empty value is filled and reviewed. The
release version is required even while telemetry is disabled, so enabling an
exporter later cannot publish data under a development identity. External Sentry,
SMTP, Keycloak, DNS, TLS, and off-host backup providers remain
deployment inputs rather than repository defaults.
