# Operations runbook

Everything needed to stand up, watch, and recover the production stack.
This file is the operational runbook for the current stack.

No production deployment exists yet. Steps below are written against
`docker-compose.prod.yml` as it stands and were exercised locally except where
marked **untested in production**.

## The stack

`docker compose --env-file .env.production -f docker-compose.prod.yml` brings up
ten services:

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
| `gotenberg`    | Internal PDF renderer reached only by the api over the compose network — no host port, no Caddy route. Serializes conversions and clears browser state between jobs; egress is confined to the `PDF_BASE_URL` print origin.    |
| `backup`       | Periodic `pg_dump` into the `pgbackups` volume. See [Backups](#backups).                                                                                                                                                       |

`migrate` and `backup` talk to `postgres` **directly**, bypassing pgbouncer:
DDL and `pg_dump` need a session that outlives a single transaction.

## Host requirements

Facts below come from `docker-compose.prod.yml`; sizing is a **recommendation**,
not a measurement.

- **Software.** Linux with Docker Engine and Compose v2 (`docker compose`) plus
  `git`. No Node or pnpm on the host: `api`, `migrate`, `web`, and `backup` are
  built on the host from this checkout (`up --build`), inside pinned
  `node:26.8.1` images. The repository pins no minimum Docker/Compose version
  or distribution; the file needs `depends_on` with
  `service_completed_successfully` and `deploy.resources.limits`.
- **Memory limits** (no CPU limits are set; `migrate` and `config-guard` are
  one-shot and unlimited):

  | Service     | Limit                    |
  | ----------- | ------------------------ |
  | `api`       | 2 GiB                    |
  | `gotenberg` | 1 GiB                    |
  | `postgres`  | 512 MiB                  |
  | `web`       | 512 MiB                  |
  | `pgbouncer` | 128 MiB                  |
  | `redis`     | 256 MiB                  |
  | `backup`    | 256 MiB                  |
  | `caddy`     | 256 MiB                  |
  | **Sum**     | 4992 MiB (about 4.9 GiB) |

- **Recommended VM: 4 vCPU, 8 GiB RAM, 40+ GiB SSD.** The limits alone fill
  about 5 GiB; the rest is headroom for the OS, Docker, and the on-host image
  build (pnpm, Next, Nest), whose peak is unmeasured. Disk covers images, the
  volumes below, and dumps; growth rates are unmeasured. The `observability`
  overlay sets no limits and adds its own `lgtmdata` volume; size it separately
  if enabled.
- **Inbound.** Only `caddy` publishes ports: `HTTP_PORT` (80/tcp), `HTTPS_PORT`
  (443/tcp), and `HTTPS_PORT_QUIC` (443/udp). Open those in the host firewall.
  `CADDY_SITE_ADDRESS` needs a DNS A/AAAA record to the host so Caddy can
  obtain a Let's Encrypt certificate.
- **Outbound.** Let's Encrypt (ACME); image registries during builds; the SMTP
  server (`SMTP_HOST`/`SMTP_PORT`; production has no mail container); optionally the origins in
  `AI_PROVIDER_ALLOWED_ORIGINS` (data stays blocked until
  `REPORT_ASSISTANT_OUTBOUND_DATA_APPROVED=true`) and a Sentry-compatible
  receiver when `SENTRY_DSN` is set. SAML sign-in needs no host egress: the
  browser reaches the identity provider, and the api only holds the
  `KEYCLOAK_SAML_*` URLs and certificate. `CADDY_CSP_REPORT_URI` is an external
  collector that browsers call. `gotenberg` prints the `PDF_BASE_URL` origin,
  so the host must reach its own public address; this is untested on a real
  network.
- **Storage.** Named volumes: `pgdata`, `pgbackups`, `redisdata` (queues),
  `pdfdata` (exported PDFs), `caddy_data` (certificates), `caddy_config`.
  `pgbackups` on the same disk is not off-host protection; see
  [Backups](#backups). Keep a copy of `.env.production` off the host too,
  including `AI_PROVIDER_CONFIG_ENCRYPTION_KEY`.
- **Still undecided:** SAML provider, SMTP provider, off-host backup target,
  alert receiver, and image promotion; see
  [External first-production prerequisites](#external-first-production-prerequisites).
  Required variables are listed in [First deploy](#first-deploy).

## First deploy

1. **Write the environment file.** Copy
   `deploy/environment/production.env.example` to `.env.production`, then fill
   every empty assignment. Compose or the api rejects an untouched template;
   the few populated values are explicit repository policy, not hidden defaults.

   | Variable                                                                                                                                                                                  | What it is                                                                              |
   | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
   | `DB_PASSWORD`                                                                                                                                                                             | Postgres password; URL-safe unreserved characters only (`A-Z a-z 0-9 . - _ ~`).         |
   | `POSTGRES_DB`                                                                                                                                                                             | Database name shared by all consumers; letters, digits, and underscores only.           |
   | `FRONTEND_URL`, `APP_BASE_URL`, `PDF_BASE_URL`                                                                                                                                            | Public origins.                                                                         |
   | `GOTENBERG_URL`, `CHROMIUM_ALLOW_LIST`                                                                                                                                                    | Renderer compose-network URL and the anchored regex matching the `PDF_BASE_URL` origin. |
   | `CLIENT_LOG_FORWARDING`, `NEXT_PUBLIC_CLIENT_LOG_FORWARDING`, `NEXT_PUBLIC_WEB_VITALS`                                                                                                    | Explicit server/browser telemetry toggles.                                              |
   | `PRODUCT_FEEDBACK_ENABLED`, `NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED`, `NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES`                                                                            | Matching API/Web feedback gates and the comma-separated inbox role allowlist.           |
   | `AUTH_JWT_SECRET`, `PDF_EXPORT_JWT_SECRET`                                                                                                                                                | Min 32 chars each, distinct, never the dev values.                                      |
   | `AI_PROVIDER_CONFIG_ENCRYPTION_KEY`                                                                                                                                                       | Base64 or hexadecimal key for encrypted provider credentials; required at boot.         |
   | `AI_PROVIDER_CONFIG_KEY_VERSION`, `AI_PROVIDER_ALLOWED_ORIGINS`                                                                                                                           | Current key version and exact upstream origin allowlist.                                |
   | `REPORT_ASSISTANT_OUTBOUND_DATA_APPROVED`                                                                                                                                                 | Explicit owner decision for sending report-derived content; `false` blocks it.          |
   | `REPORT_ASSISTANT_INPUT_VERSION`, `REPORT_ASSISTANT_SIMILARITY_THRESHOLD`, `REPORT_ASSISTANT_CANDIDATE_LIMIT`, `REPORT_ASSISTANT_READ_THROUGH_LIMIT`, `REPORT_ASSISTANT_EXHAUSTIVE_LIMIT` | Bounded retrieval policy for the report assistant.                                      |
   | `REPORT_ASSISTANT_CONTEXT_TOKEN_BUDGET`, `REPORT_ASSISTANT_PROVIDER_TIMEOUT_MS`, `REPORT_ASSISTANT_PLANNER_MAX_TOKENS`, `REPORT_ASSISTANT_ANSWER_MAX_TOKENS`                              | Bounded assistant execution limits.                                                     |
   | `REPORT_ASSISTANT_EMBEDDING_BATCH_SIZE`, `REPORT_ASSISTANT_EMBEDDING_TOKEN_BUDGET`                                                                                                        | Bounded embedding workload limits.                                                      |
   | `KEYCLOAK_SAML_CALLBACK_URL`, `KEYCLOAK_SAML_ENTRY_POINT`, `KEYCLOAK_SAML_ISSUER`, `KEYCLOAK_SAML_CERT`                                                                                   | The IdP; all four are required when `AUTH_DEV_MODE=false`.                              |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`                                                                                                                                                     | Reminder delivery. Missing values fail production boot instead of dropping mail.        |
   | `HEAP_HEALTH_THRESHOLD_BYTES`                                                                                                                                                             | ~75% of the api container memory limit (2 GB → `1610612736`).                           |
   | `CADDY_SITE_ADDRESS`, `CADDY_ACME_EMAIL`, `CADDY_CSP_REPORT_URI`                                                                                                                          | Public hostname, ACME account email, and external CSP violation collector.              |
   | `HTTP_PORT`, `HTTPS_PORT`, `HTTPS_PORT_QUIC`                                                                                                                                              | Host ports for the public Caddy listener.                                               |
   | `PGBOUNCER_MAX_CLIENT_CONN`, `PGBOUNCER_POOL_SIZE`, `PGBOUNCER_RESERVE_POOL_SIZE`                                                                                                         | PgBouncer capacity limits.                                                              |
   | `DB_POOL_MAX`, `DB_POOL_IDLE_TIMEOUT_MS`, `DB_POOL_CONNECTION_TIMEOUT_MS`                                                                                                                 | API pg.Pool capacity and timeout policy; all three are required.                        |
   | `REDIS_DB`, `LOG_LEVEL`, `OTEL_SDK_DISABLED`, `OTEL_TRACES_SAMPLER_ARG`, `OTEL_SERVICE_VERSION`                                                                                           | Runtime policy, telemetry mode, and the exact release identity.                         |
   | `BACKUP_INTERVAL_SECONDS`, `BACKUP_RETENTION_DAYS`                                                                                                                                        | Local backup cadence and history window. See [Backups](#backups).                       |
   | `GRAFANA_ADMIN_PASSWORD`                                                                                                                                                                  | Operator secret required when the optional observability overlay is composed.           |

Optional: `FRONTEND_URLS` (extra CORS origins, no wildcards in production),
`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SMTP_USER`, `SMTP_PASS`.
`CLIENT_LOG_FORWARDING`, `NEXT_PUBLIC_CLIENT_LOG_FORWARDING`,
`NEXT_PUBLIC_WEB_VITALS`, `PRODUCT_FEEDBACK_ENABLED`,
`NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED`, and
`NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES` are explicit required values. The
inbox role list must include `admin` whenever feedback is enabled, and the two
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

2. **Build the release images.** `NEXT_PUBLIC_*` values are compiled into the
   client bundle, so a changed public origin needs a rebuild, not a restart.

   ```sh
   docker compose --env-file .env.production -f docker-compose.prod.yml build
   ```

3. **Activate the release.** Start the stack:

   ```sh
   docker compose --env-file .env.production -f docker-compose.prod.yml up -d
   ```

4. **Watch the boot order.** `migrate` must exit 0 before `api` starts; `api`
   must report healthy before `web` and `caddy` start. A stuck start is almost
   always `migrate` failing — read its log first.

5. **Verify before announcing.**

   ```sh
   docker compose --env-file .env.production -f docker-compose.prod.yml ps        # long-running services healthy; guards/migrate exited 0
   curl -fsS https://<host>/health/ready                # api: DB + Redis + queues + memory
   ```

The production Caddy mount defaults to `deploy/caddy/Caddyfile`; do not
hand-edit the container mount.

## Owner flags and when to remove them

Every on/off flag exists for one reason and is deleted once that reason is
gone. Env flags accept only `true` or `false`; any other value fails startup.

| Flag                                                                              | Kept for                                                       | Remove when                                                                                                     |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `PRODUCT_FEEDBACK_ENABLED`, `NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED`                | Owner switch for the in-app feedback ingress and inbox.        | The feedback channel is either permanent in every environment or dropped; then delete the gate and both values. |
| `CLIENT_LOG_FORWARDING`, `NEXT_PUBLIC_CLIENT_LOG_FORWARDING`                      | Owner switch for browser-to-API log forwarding.                | A central log pipeline replaces forwarding, or forwarding is always on.                                         |
| `OTEL_SDK_DISABLED`                                                               | Kill switch for the OpenTelemetry SDK when an endpoint is set. | The collector is a fixed part of every deployment and the SDK can no longer be disabled safely.                 |
| `AUTH_DEV_MODE_ALLOW_TEST`                                                        | Lets automated tests use dev login under `NODE_ENV=test`.      | Tests authenticate through a real IdP fixture and never need dev login.                                         |
| `AppSettings.autoCreatePeriods`, `AppSettings.autoPublishAfterDeadline` (DB flag) | Owner control over scheduled period creation and auto-publish. | The owner confirms the schedule is fixed; then make the behaviour unconditional and drop the column.            |

## Health and where to look

- `GET /health/live` — the process is up. Says nothing about dependencies.
- `GET /health/ready` — checks Postgres, Redis, both required BullMQ workers and
  their queues, and heap against `HEAP_HEALTH_THRESHOLD_BYTES`. This is what the
  container healthcheck and any load balancer should use. During startup it
  stays unavailable until both workers connect; Compose grants a 60-second
  startup grace.
- `GET /health/pdf-renderer` — dedicated, non-gating probe of the Gotenberg
  service's own `GET /health`. It reports `up`/`down` (200/503) and never joins
  `/health/ready`: a renderer outage degrades PDF exports (jobs fail retryably)
  without marking the api unready.
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

To rotate `AUTH_JWT_SECRET`:

1. Announce that signed-in users will need to log in again.
2. Put the new `AUTH_JWT_SECRET` value in the environment file.
3. Run `docker compose --env-file .env.production -f docker-compose.prod.yml up -d api`
   to recreate the API with the new key.

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

`DB_PASSWORD` is referenced by the config guard, postgres, pgbouncer, migrate
and backup, so rotating it means changing the role password in Postgres and
recreating those services together. It must contain only URL-safe unreserved
characters (`A-Z a-z 0-9 . - _ ~`); `POSTGRES_DB` must contain only letters,
digits, and underscores. The config guard validates both before any
database-dependent service starts. `NEXT_PUBLIC_*` changes need a **rebuild** —
they are inlined at build time and a restart will not pick them up.

### API shutdown budget

The API completes its ordered shutdown phases within a 12.5-second worst-case
budget: application close, rate-limit Redis, log barrier and file flush, OTel,
and Sentry. BullMQ workers and queue handles first attempt a graceful close for
500 ms, then use BullMQ's supported force-close/disconnect operation. Force
disconnecting does not delete active jobs; BullMQ's stalled-job recovery can
reclaim them on the next worker start. Production Compose grants the API a
20-second `stop_grace_period`, leaving margin for signal delivery and runtime
teardown while preserving the final log and telemetry phases.

## Migrations

`migrate` runs `prisma migrate deploy` on every `up`, applying only pending
migrations. It never resets.

The repository has a canonical init migration followed by forward-only additive
migrations synchronized with `schema.prisma`. Never rewrite applied migration
history or fold a new production change back into init. Add a new timestamped
migration, verify it against an exact disposable target, and deploy it with
`prisma migrate deploy`.
Validate every schema rewrite by recreating only an exact disposable target
listed in `AGENTS.md`, section **Database safety**.
`prisma/guards/_destructive-guard.ts` must accept the resolved target before any
destructive command. Product or shared databases are never reset; leave
`ALLOW_PROD_DESTRUCTIVE` unset.

### PDF artifact generation protocol

PDF artifact files are generation-scoped: workers publish
`${jobId}-g${generation}.pdf`, the public URL stays `/pdfs/{jobId}.pdf`, and
the download resolves the completed row's recorded generation — never a
legacy un-suffixed name. No production database exists yet, so there are no
pre-protocol artifacts to migrate. Once the api is running, ordinary rollback
is unsafe — a completed artifact may exist only as
`${jobId}-g${generation}.pdf`, which an older reader cannot resolve — so
recovery is forward-only: fix forward and preserve every durable row,
artifact, and queue entry.

### Agentation feedback operations

WeeklyReport uses `agentation@3.0.2` for the authenticated development/
non-production toolbar and `agentation-mcp@1.2.0` for agent access. Both use
the WeeklyReport adapter and PostgreSQL feedback store; the stock Agentation
HTTP server and stock SQLite/memory store are not a product persistence path.
MCP must run as:

```sh
pnpm agentation:mcp
# agentation-mcp server --mcp-only --http-url \
#   http://127.0.0.1:3002/api/v1/agentation
```

Browser calls are authenticated by the WeeklyReport session cookie. MCP does
not inherit that cookie, so an adapter-side agent credential is required
through `AGENTATION_API_KEY` supplied by the local environment. Never place the
key value in Git, logs, shell history, or this runbook. The adapter accepts the
key only from a loopback socket and rejects matching remote requests. Keep
`PRODUCT_FEEDBACK_ENABLED` and `NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED` false in
production; missing or unsafe configuration must disable the toolbar, inbox,
mutations, and SSE rather than falling back to SQLite.

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

`.gitlab-ci.yml` runs the lint/test lanes only (`node-toolchain`, `quality`,
`dependency-scan`, `coverage`, `api-integration`, `migrate-reset`; see
`docs/gitlab-ci.md`). The `api-integration` lane runs the API unit and
integration suites once, serially, against disposable Postgres/Redis/Mailpit
(in-job loopback Postgres; Redis and Mailpit as service aliases) and enforces the API coverage thresholds.
The `coverage` lane enforces Web coverage without starting a second dependency
stack; the `quality` lane runs lint, typecheck, and unit tests, and
`migrate-reset` covers migration drift. The complete workspace build, the
production image build, PDF export, and browser acceptance are not CI lanes and
stay required evidence collected outside CI. Local
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
