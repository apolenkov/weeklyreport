# Operations runbook

Everything needed to stand up, watch, and recover the production stack.
This file is the operational runbook for the current stack.

No production deployment exists yet. Steps below are written against
`docker-compose.prod.yml` as it stands and were exercised locally except where
marked **untested in production**.

## The stack

`docker compose --env-file .env.production -f docker-compose.prod.yml` brings up
nine services:

| Service        | Role                                                                                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `config-guard` | Fails before database services start if `DB_PASSWORD` contains a reserved URL character.                                                                                                                                       |
| `caddy`        | The only public entrypoint. TLS, security headers, routes `/api/web-vitals`, `/api/client-logs`, `/trpc`, `/auth`, `/health`, `/admin/queues`, and `/pdfs` to the api and everything else to web. `/metrics` is internal-only. |
| `web`          | Next.js standalone server. Not published to the host — reachable only through caddy.                                                                                                                                           |
| `api`          | NestJS + tRPC. Not published to the host either.                                                                                                                                                                               |
| `migrate`      | Init container: `prisma migrate deploy`, then exits. `api` waits for it to succeed.                                                                                                                                            |
| `pgbouncer`    | Transaction-mode pool in front of Postgres. All api query traffic goes through it.                                                                                                                                             |
| `postgres`     | The database. No host port; reachable only on the compose network.                                                                                                                                                             |
| `redis`        | BullMQ queues. `--maxmemory 200mb`, `noeviction`.                                                                                                                                                                              |
| `backup`       | Periodic `pg_dump` into the `pgbackups` volume. See [Backups](#backups).                                                                                                                                                       |

`migrate` and `backup` talk to `postgres` **directly**, bypassing pgbouncer:
DDL and `pg_dump` both need a session that outlives a single transaction.

## First deploy

1. **Write the environment file.** Copy
   `deploy/environment/production.env.example` to `.env.production`, then fill
   every empty assignment. Compose or the api rejects an untouched template;
   the few populated values are explicit repository policy, not hidden defaults.

   | Variable                                                                                                                                                                                  | What it is                                                                       |
   | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
   | `DB_PASSWORD`                                                                                                                                                                             | Postgres password; URL-safe unreserved characters only (`A-Z a-z 0-9 . - _ ~`).  |
   | `POSTGRES_DB`                                                                                                                                                                             | Database name shared by all consumers; letters, digits, and underscores only.    |
   | `FRONTEND_URL`, `APP_BASE_URL`, `PDF_BASE_URL`                                                                                                                                            | Public origins.                                                                  |
   | `CLIENT_LOG_FORWARDING`, `NEXT_PUBLIC_CLIENT_LOG_FORWARDING`, `NEXT_PUBLIC_WEB_VITALS`                                                                                                    | Explicit server/browser telemetry toggles.                                       |
   | `PRODUCT_FEEDBACK_ENABLED`, `NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED`, `NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES`                                                                            | Matching API/Web feedback gates and the comma-separated inbox role allowlist.    |
   | `AUTH_JWT_SECRET`, `PDF_EXPORT_JWT_SECRET`                                                                                                                                                | Min 32 chars each, distinct, never the dev values.                               |
   | `AI_PROVIDER_CONFIG_ENCRYPTION_KEY`                                                                                                                                                       | Base64 or hexadecimal key for encrypted provider credentials; required at boot.  |
   | `AI_PROVIDER_CONFIG_KEY_VERSION`, `AI_PROVIDER_ALLOWED_ORIGINS`                                                                                                                           | Current key version and exact upstream origin allowlist.                         |
   | `REPORT_ASSISTANT_OUTBOUND_DATA_APPROVED`                                                                                                                                                 | Explicit owner decision for sending report-derived content; `false` blocks it.   |
   | `REPORT_ASSISTANT_INPUT_VERSION`, `REPORT_ASSISTANT_SIMILARITY_THRESHOLD`, `REPORT_ASSISTANT_CANDIDATE_LIMIT`, `REPORT_ASSISTANT_READ_THROUGH_LIMIT`, `REPORT_ASSISTANT_EXHAUSTIVE_LIMIT` | Bounded retrieval policy for the report assistant.                               |
   | `REPORT_ASSISTANT_CONTEXT_TOKEN_BUDGET`, `REPORT_ASSISTANT_PROVIDER_TIMEOUT_MS`, `REPORT_ASSISTANT_PLANNER_MAX_TOKENS`, `REPORT_ASSISTANT_ANSWER_MAX_TOKENS`                              | Bounded assistant execution limits.                                              |
   | `REPORT_ASSISTANT_EMBEDDING_BATCH_SIZE`, `REPORT_ASSISTANT_EMBEDDING_TOKEN_BUDGET`                                                                                                        | Bounded embedding workload limits.                                               |
   | `KEYCLOAK_SAML_CALLBACK_URL`, `KEYCLOAK_SAML_ENTRY_POINT`, `KEYCLOAK_SAML_ISSUER`, `KEYCLOAK_SAML_CERT`                                                                                   | The IdP; all four are required when `AUTH_DEV_MODE=false`.                       |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`                                                                                                                                                     | Reminder delivery. Missing values fail production boot instead of dropping mail. |
   | `HEAP_HEALTH_THRESHOLD_BYTES`                                                                                                                                                             | ~75% of the api container memory limit (2 GB → `1610612736`).                    |
   | `CADDY_SITE_ADDRESS`, `CADDY_ACME_EMAIL`, `CADDY_CSP_REPORT_URI`                                                                                                                          | Public hostname, ACME account email, and external CSP violation collector.       |
   | `HTTP_PORT`, `HTTPS_PORT`, `HTTPS_PORT_QUIC`                                                                                                                                              | Host ports for the public Caddy listener.                                        |
   | `PGBOUNCER_MAX_CLIENT_CONN`, `PGBOUNCER_POOL_SIZE`, `PGBOUNCER_RESERVE_POOL_SIZE`                                                                                                         | PgBouncer capacity limits.                                                       |
   | `DB_POOL_MAX`, `DB_POOL_IDLE_TIMEOUT_MS`, `DB_POOL_CONNECTION_TIMEOUT_MS`                                                                                                                 | API pg.Pool capacity and timeout policy; all three are required.                 |
   | `REDIS_DB`, `LOG_LEVEL`, `OTEL_SDK_DISABLED`, `OTEL_TRACES_SAMPLER_ARG`, `OTEL_SERVICE_VERSION`                                                                                           | Runtime policy, telemetry mode, and the exact release identity.                  |
   | `BACKUP_INTERVAL_SECONDS`, `BACKUP_RETENTION_DAYS`                                                                                                                                        | Local backup cadence and history window. See [Backups](#backups).                |
   | `GRAFANA_ADMIN_PASSWORD`                                                                                                                                                                  | Operator secret required when the optional observability overlay is composed.    |

Optional: `FRONTEND_URLS` (extra CORS origins, no wildcards in production),
`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SMTP_USER`, `SMTP_PASS`.
`CLIENT_LOG_FORWARDING`, `NEXT_PUBLIC_CLIENT_LOG_FORWARDING`,
`NEXT_PUBLIC_WEB_VITALS`, `PRODUCT_FEEDBACK_ENABLED`,
`NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED`, and
`NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES` are explicit required values. The two
product-feedback values must match. `NEXT_PUBLIC_SENTRY_DSN` is compiled into the Web image; changing
it requires `up --build`, not a container restart.

The local Bugsink errors overlay accepts `BUGSINK_PORT` (default `8000`) and
requires `BUGSINK_SECRET_KEY` with no Compose fallback. Both are loopback/local
settings; the errors overlay is not part of the production Compose command, so
`BUGSINK_SECRET_KEY` is intentionally absent from the production environment
template.

Production Compose owns the internal web-to-api origin as one YAML anchor
(`http://api:3001`) and supplies it to both the Next build and the running
Web server. Do not add `API_URL` to `.env.production`; an operator override
would let rewrites and server-side fetches target different origins.

2. **Build and start.** `NEXT_PUBLIC_*` values are compiled into the client
   bundle, so a changed public origin needs a rebuild, not a restart.

   ```sh
   docker compose --env-file .env.production -f docker-compose.prod.yml up --build -d
   ```

3. **Watch the boot order.** `migrate` must exit 0 before `api` starts; `api`
   must report healthy before `web` and `caddy` start. A stuck start is almost
   always `migrate` failing — read its log first.

4. **Verify before announcing.**

   ```sh
   docker compose --env-file .env.production -f docker-compose.prod.yml ps        # long-running services healthy; guards/migrate exited 0
   curl -fsS https://<host>/health/ready                # api: DB + Redis + queues + memory
   ```

The production Caddy mount defaults to `deploy/caddy/Caddyfile`; do not
hand-edit the container mount.

## Health and where to look

- `GET /health/live` — the process is up. Says nothing about dependencies.
- `GET /health/ready` — checks Postgres, Redis, both required BullMQ workers and
  their queues, and heap against `HEAP_HEALTH_THRESHOLD_BYTES`. This is what the
  container healthcheck and any load balancer should use. During startup it
  stays unavailable until both workers connect; Compose grants a 60-second
  startup grace.
- `GET /metrics` — internal API metrics. Deliberately **not** routed through
  Caddy from the public internet; Caddy returns 404 for it at the edge.
- `/admin/queues` — Bull Board. Session-authenticated, `head` role only; exposes
  every monitored queue (`email-reminder`, `pdf-export`, `ai-provider-test`,
  `semantic-index`) for investigation. The in-app Jobs tab exposes the same
  allowlisted failed-job metadata through the canonical Head tRPC authority and
  never displays processor payloads. Retry validates a durable
  `ReminderExecution` only for the `email-reminder` queue; similarly named ids
  in other queues stay in their own domains.

### Red `/health/ready` — triage

Read the JSON body first: it names the failing indicator.

| Indicator  | Likely cause and first move                                                                                                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `database` | pgbouncer or postgres down, or the pool is exhausted. `docker compose --env-file .env.production -f docker-compose.prod.yml logs pgbouncer postgres`. Its healthcheck runs a real `SELECT 1` through the pooler, so a healthy pgbouncer means the path works. |
| `redis`    | Redis evicting or out of memory. It runs `noeviction` on purpose — a full Redis fails writes loudly rather than dropping jobs. Check `INFO memory` against the 200 MB cap.                                                                                    |
| `bullmq`   | A required worker is starting, paused, stopped, or disconnected, or a queue is wedged. Read the safe `workers` states, then inspect API logs, `/admin/queues`, and the DLQ.                                                                                   |
| `memory`   | Heap crossed the threshold. This sheds traffic on purpose, ahead of the container OOM-killer. Restart the api, then find what grew.                                                                                                                           |

## Backups

The `backup` service dumps the database every `BACKUP_INTERVAL_SECONDS` into
the `pgbackups` volume and deletes dumps older than `BACKUP_RETENTION_DAYS`.
Both values are required: cadence sets the intended interval between successful
local dumps, while retention sets the local history window. Neither value alone
proves achieved RPO or RTO; those measurements come from a recorded restore
drill. A default would silently invent recovery policy nobody agreed to.
Its pinned backup image contains the backup, health, and restore entrypoints;
the production Compose file does not mount mutable host scripts into it. Every
repository-built image is tagged with the configured release version; the
documented `up --build` command prevents a stale local tag from being reused.

Its healthcheck is deliberately not a liveness probe — it goes red when the
newest dump is older than two intervals, because a loop whose every `pg_dump`
fails looks perfectly alive until someone needs a restore.

**The volume is not off-site.** A local dump survives a bad migration or a
mistaken `DELETE`; it does not survive the disk. Replicating `pgbackups`
somewhere else is a deployment decision this repo cannot make for you.

### Restore drill

Practise this on a scratch database before you need it in anger. Repository
tests exercise the archive, target, consent, and transaction guards, but they do
not constitute a current restore drill or prove schema and row-count parity.
The procedure remains **untested in production**.

```sh
# 1. Stop everything that writes. pg_restore --clean must DROP objects, and an
#    open api connection makes that hang halfway.
docker compose --env-file .env.production -f docker-compose.prod.yml stop api web

# 2. Pick a dump.
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm backup ls -lh /backups

# 3. Restore. The token binds environment, host, port, and database. Production
#    additionally requires the repository-wide destructive consent. Replace
#    <POSTGRES_DB> below with the exact value from .env.production.
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm \
  -e 'CONFIRM_RESTORE_TARGET=production|postgres|5432|<POSTGRES_DB>' \
  -e 'PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=давай' \
  -e ALLOW_PROD_DESTRUCTIVE=yes \
  backup /usr/local/bin/restore.sh /backups/customreport-<stamp>.dump

# 4. Bring the app back and confirm before serving traffic.
docker compose --env-file .env.production -f docker-compose.prod.yml start api web
curl -fsS https://<host>/health/ready
```

The restore runs in a single transaction: a failure part-way rolls back to the
pre-restore state rather than leaving a half-populated schema.

A drill record must bind the repository SHA, dump checksum, source and target,
start and finish timestamps, schema comparison, agreed row-count or checksum
queries, and the final readiness result. Keep that read-back outside the
repository with the production release evidence; without it, measured RPO/RTO
and production recovery remain BLOCKED.

## Rotating secrets

`AUTH_JWT_SECRET` signs session cookies and `PDF_EXPORT_JWT_SECRET` signs the
short-lived token the PDF renderer uses. Rotating either **invalidates every
live session or in-flight export** — there is no dual-key grace period.

`AI_PROVIDER_CONFIG_ENCRYPTION_KEY` and `AI_PROVIDER_CONFIG_KEY_VERSION` have
an even narrower current-MVP boundary: the credential codec has exactly one
active key and decrypts only records with that same version. Do **not** treat a
version increment as a safe rotation and do not replace either value while
encrypted provider credentials are retained. The API will reject a mismatched
version; a changed key makes existing ciphertext fail authentication. There is
no keyring, dual-key grace period, or in-place re-encryption procedure.

Before any intentional reconfiguration, preserve the exact current key/version
pair and inventory every affected provider credential outside the repository.
If the new pair has already been deployed, restore the original pair to recover
the retained configuration; if that pair is unavailable, the ciphertext cannot
be recovered and every provider credential must be entered again under the new
pair. Treat that outcome as provider reconfiguration, not a reversible key
rotation.

### API shutdown budget

The API completes its ordered shutdown phases within a 12.5-second worst-case
budget: application close, rate-limit Redis, log barrier and file flush, OTel,
and Sentry. BullMQ workers and queue handles first attempt a graceful close for
500 ms, then use BullMQ's supported force-close/disconnect operation. Force
disconnecting does not delete active jobs; BullMQ's stalled-job recovery can
reclaim them on the next worker start. Production Compose grants the API a
20-second `stop_grace_period`, leaving margin for signal delivery and runtime
teardown while preserving the final log and telemetry phases.

1. Put the new value in the environment file.
2. `docker compose --env-file .env.production -f docker-compose.prod.yml up -d api`
   (recreates the api only).
3. Expect every signed-in user to be bounced to login. Announce it first.

`DB_PASSWORD` is referenced by the config guard, postgres, pgbouncer, migrate
and backup, so rotating it means changing the role password in Postgres and
recreating those services together. It must contain only URL-safe unreserved
characters (`A-Z a-z 0-9 . - _ ~`); `POSTGRES_DB` must contain only letters,
digits, and underscores. The config guard validates both before any
database-dependent service starts. `NEXT_PUBLIC_*` changes need a **rebuild** —
they are inlined at build time and a restart will not pick them up.

## Migrations

`migrate` runs `prisma migrate deploy` on every `up`, applying only pending
migrations. It never resets.

The MVP uses one canonical init migration synchronized with `schema.prisma`.
Validate every schema rewrite by recreating only an exact disposable target
listed in `AGENTS.md`, section **Database safety**.
`prisma/guards/_destructive-guard.ts` must accept the resolved target before any
destructive command. Product or shared databases are never reset; leave
`ALLOW_PROD_DESTRUCTIVE` unset.

## Rollback

Images are the unit of rollback; the database is not.

- **Application only**: production image rollback is **BLOCKED** until the
  delivery platform supplies immutable API/Web image references and read-back.
  The repository-owned Compose file currently builds from the checked-out
  source and has no image-tag input, so rebuilding an older commit is a
  pre-production recovery exercise, not proof that the deployed artifact can
  be restored. Do not describe a local rebuild or a dangling Docker image as a
  production rollback.
- **Migration shipped**: rolling the image back does not roll the schema back,
  and Prisma has no down-migrations here. Either fix forward with a new
  migration, or restore the pre-deploy dump and accept losing writes made
  since. Decide which before deploying anything schema-touching, and take a
  dump of your own first rather than trusting the cycle to have just run:

  ```sh
  docker compose --env-file .env.production -f docker-compose.prod.yml exec backup sh -c \
    'pg_dump --format=custom --compress=6 --file=/backups/predeploy-$(date -u +%Y%m%dT%H%M%SZ).dump'
  ```

  Retention only prunes `customreport-*.dump`, so a `predeploy-*` dump stays
  until you remove it — which is what you want for a rollback anchor. Delete it
  yourself once the deploy has proven itself.

## CI

`.github/workflows/ci.yml` runs the `quality`, `api-integration`, `coverage`,
`migrate-reset`, and `docker-build` jobs. The `api-integration` lane runs the
API unit and integration suites once, serially, against disposable
Postgres/Redis/Mailpit services and enforces the API coverage thresholds. The
`coverage` lane enforces Web coverage without starting a second dependency
stack; the quality lane
runs lint, typecheck, unit tests, and the complete workspace build, while the
remaining jobs cover migration drift and the production image build. Local
commands remain the fast gate; run the same checks before pushing.

## External first-production prerequisites

Local Compose and repository tests prove only repository-owned readiness. The
following remain **BLOCKED** until an authorized external read-back exists:

- a real alert receiver, escalation owner, and tested end-to-end alert;
- encrypted backups in an independent failure domain, retention/access audit,
  and a scheduled restore drill with measured RPO/RTO;
- protected `main`, required checks, security settings, and deployment
  environments with approvals and concurrency;
- an immutable image digest with SBOM and signed provenance, promoted without
  rebuilding; and
- an immutable release record binding commit, image, migrations, approvals,
  deployment evidence, and rollback decision.

The local `docker-compose.observability.yml` overlay, its
`deploy/prometheus-otel-lgtm.yml` and `deploy/alert-rules.yml` mounts,
`pgbackups` volume, and checked-in workflows are templates or repository evidence
only; none is a production PASS by itself.
When this overlay is composed with the production stack, it reads the required
`GRAFANA_ADMIN_PASSWORD` operator secret from `.env.production`; the Compose
contract has no password default.
Grafana scans two non-overlapping dashboard roots: operational and tRPC
dashboards appear in `CustomReport`, while product telemetry appears in
`Product KPIs`. The production Prometheus overlay labels its series
`cluster=customreport-production`; the composed-last development override keeps
`cluster=customreport-local`.
Off-box encrypted backup remains **BLOCKED** until an operator supplies a
provider endpoint, repository identity, encryption key policy, retention policy,
and a scheduled restore read-back. This repository deliberately does not invent
those external inputs or claim a restic-style recovery PASS without them.
