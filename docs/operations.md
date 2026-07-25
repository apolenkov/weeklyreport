# Operations runbook

Everything needed to stand up, watch, and recover the production stack.
Architecture lives in `architecture/`; this file is the operational half.

No production deployment exists yet. Steps below are written against
`docker-compose.prod.yml` as it stands and were exercised locally except where
marked **untested in production**.

## The stack

`docker compose -f docker-compose.prod.yml` brings up seven services:

| Service     | Role                                                                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `caddy`     | The only public entrypoint. TLS, security headers, routes `/trpc` `/auth` `/health` `/metrics` `/admin/queues` `/pdfs` to the api and everything else to web. |
| `web`       | Next.js standalone server. Not published to the host — reachable only through caddy.                                                                          |
| `api`       | NestJS + tRPC. Not published to the host either.                                                                                                              |
| `migrate`   | Init container: `prisma migrate deploy`, then exits. `api` waits for it to succeed.                                                                           |
| `pgbouncer` | Transaction-mode pool in front of Postgres. All api query traffic goes through it.                                                                            |
| `postgres`  | The database. No host port; reachable only on the compose network.                                                                                            |
| `redis`     | BullMQ queues. `--maxmemory 200mb`, `noeviction`.                                                                                                             |
| `backup`    | Periodic `pg_dump` into the `pgbackups` volume. See [Backups](#backups).                                                                                      |

`migrate` and `backup` talk to `postgres` **directly**, bypassing pgbouncer:
DDL and `pg_dump` both need a session that outlives a single transaction.

## First deploy

1. **Write the environment file.** Every variable below is required — the api
   refuses to boot without one, and compose refuses to even render. There are
   no defaults by design (`CLAUDE.md`: no silent defaults for product config).

   | Variable                                                              | What it is                                                                          |
   | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
   | `DB_PASSWORD`                                                         | Postgres password, shared by pgbouncer/migrate/backup.                              |
   | `FRONTEND_URL`, `APP_BASE_URL`, `PDF_BASE_URL`, `NEXT_PUBLIC_API_URL` | Public origins. `NEXT_PUBLIC_*` is baked at image build.                            |
   | `AUTH_JWT_SECRET`, `PDF_EXPORT_JWT_SECRET`                            | Min 32 chars each, distinct, never the dev values.                                  |
   | `KEYCLOAK_SAML_CALLBACK_URL`, `_ENTRY_POINT`, `_ISSUER`, `_CERT`      | The IdP. Required whenever `AUTH_DEV_MODE=false`.                                   |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`                                 | Reminder delivery. Without them the api drops mail silently, so boot fails instead. |
   | `HEAP_HEALTH_THRESHOLD_BYTES`                                         | ~75% of the api container memory limit (2 GB → `1610612736`).                       |
   | `CADDY_SITE_ADDRESS`, `CADDY_CSP_REPORT_URI`                          | Public hostname and the CSP violation collector.                                    |
   | `BACKUP_INTERVAL_SECONDS`, `BACKUP_RETENTION_DAYS`                    | Your RPO and history window. See [Backups](#backups).                               |

   Optional: `FRONTEND_URLS` (extra CORS origins, no wildcards in production),
   `SENTRY_DSN`, `CLIENT_LOG_FORWARDING`, `TG_BOT_TOKEN`, `LOG_LEVEL`,
   `OTEL_EXPORTER_OTLP_ENDPOINT`.

2. **Build and start.** `NEXT_PUBLIC_*` values are compiled into the client
   bundle, so a changed public origin needs a rebuild, not a restart.

   ```sh
   docker compose --env-file .env.production -f docker-compose.prod.yml build
   docker compose --env-file .env.production -f docker-compose.prod.yml up -d
   ```

3. **Watch the boot order.** `migrate` must exit 0 before `api` starts; `api`
   must report healthy before `web` and `caddy` start. A stuck start is almost
   always `migrate` failing — read its log first.

4. **Verify before announcing.**

   ```sh
   docker compose -f docker-compose.prod.yml ps        # every service healthy
   curl -fsS https://<host>/health/ready                # api: DB + Redis + queues + memory
   ```

## Health and where to look

- `GET /health/live` — the process is up. Says nothing about dependencies.
- `GET /health/ready` — checks Postgres, Redis, BullMQ and heap against
  `HEAP_HEALTH_THRESHOLD_BYTES`. This is what the container healthcheck and any
  load balancer should use.
- `GET /metrics` — Prometheus. Deliberately **not** routed through caddy from
  the public internet; scrape it on the compose network.
- `/admin/queues` — Bull Board. Session-authenticated, `head` role only.

### Red `/health/ready` — triage

Read the JSON body first: it names the failing indicator.

| Indicator  | Likely cause and first move                                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `database` | pgbouncer or postgres down, or the pool is exhausted. `docker compose logs pgbouncer postgres`. Its healthcheck runs a real `SELECT 1` through the pooler, so a healthy pgbouncer means the path works. |
| `redis`    | Redis evicting or out of memory. It runs `noeviction` on purpose — a full Redis fails writes loudly rather than dropping jobs. Check `INFO memory` against the 200 MB cap.                              |
| `bullmq`   | Workers cannot reach Redis, or a queue is wedged. Inspect `/admin/queues` and the DLQ.                                                                                                                  |
| `memory`   | Heap crossed the threshold. This sheds traffic on purpose, ahead of the container OOM-killer. Restart the api, then find what grew.                                                                     |

## Backups

The `backup` service dumps the database every `BACKUP_INTERVAL_SECONDS` into
the `pgbackups` volume and deletes dumps older than `BACKUP_RETENTION_DAYS`.
Both values are required: together they are the recovery-point objective, and a
default would invent one nobody agreed to.

Its healthcheck is deliberately not a liveness probe — it goes red when the
newest dump is older than two intervals, because a loop whose every `pg_dump`
fails looks perfectly alive until someone needs a restore.

**The volume is not off-site.** A local dump survives a bad migration or a
mistaken `DELETE`; it does not survive the disk. Replicating `pgbackups`
somewhere else is a deployment decision this repo cannot make for you.

### Restore drill

Practise this on a scratch database before you need it in anger. The procedure
below was exercised against a real dump (schema plus row counts matched the
source exactly); **untested in production**.

```sh
# 1. Stop everything that writes. pg_restore --clean must DROP objects, and an
#    open api connection makes that hang halfway.
docker compose -f docker-compose.prod.yml stop api web

# 2. Pick a dump.
docker compose -f docker-compose.prod.yml run --rm backup ls -lh /backups

# 3. Restore. The guard refuses unless you name the target database out loud.
docker compose -f docker-compose.prod.yml run --rm \
  -e CONFIRM_RESTORE_DATABASE=customreport \
  backup /usr/local/bin/restore.sh /backups/customreport-<stamp>.dump

# 4. Bring the app back and confirm before serving traffic.
docker compose -f docker-compose.prod.yml start api web
curl -fsS https://<host>/health/ready
```

The restore runs in a single transaction: a failure part-way rolls back to the
pre-restore state rather than leaving a half-populated schema.

## Rotating secrets

`AUTH_JWT_SECRET` signs session cookies and `PDF_EXPORT_JWT_SECRET` signs the
short-lived token the PDF renderer uses. Rotating either **invalidates every
live session or in-flight export** — there is no dual-key grace period.

1. Put the new value in the environment file.
2. `docker compose … up -d api` (recreates the api only).
3. Expect every signed-in user to be bounced to login. Announce it first.

`DB_PASSWORD` is referenced by postgres, pgbouncer, migrate and backup, so
rotating it means changing the role password in Postgres and recreating all
four together. `NEXT_PUBLIC_*` changes need a **rebuild** — they are inlined at
build time and a restart will not pick them up.

## Migrations

`migrate` runs `prisma migrate deploy` on every `up`, applying only pending
migrations. It never resets.

Until the first production point the databases are disposable and the schema
may be reshaped in place (`CLAUDE.md`, MVP section). **After** that point
migrations become append-only: forward-only, never edited once shipped.
`prisma/_destructive-guard.ts` blocks destructive Prisma commands against a
production database unless `ALLOW_PROD_DESTRUCTIVE` is set — leave it unset.

## Rollback

Images are the unit of rollback; the database is not.

- **Application only**: redeploy the previous image tag. Safe when no migration
  shipped between the two.
- **Migration shipped**: rolling the image back does not roll the schema back,
  and Prisma has no down-migrations here. Either fix forward with a new
  migration, or restore the pre-deploy dump and accept losing writes made
  since. Decide which before deploying anything schema-touching, and take a
  dump of your own first rather than trusting the cycle to have just run:

  ```sh
  docker compose -f docker-compose.prod.yml exec backup sh -c \
    'pg_dump --format=custom --compress=6 --file=/backups/predeploy-$(date -u +%Y%m%dT%H%M%SZ).dump'
  ```

  Retention only prunes `customreport-*.dump`, so a `predeploy-*` dump stays
  until you remove it — which is what you want for a rollback anchor. Delete it
  yourself once the deploy has proven itself.

## CI

`.github/workflows/ci.yml` runs lint + typecheck + unit tests, the integration
E2E suite, a `prisma migrate reset` drift gate, and a production image build.
Local hooks (`.husky/pre-commit`, `.husky/pre-push`) remain the fast gate;
`SKIP_PREPUSH=1` bypasses the slow one when you know why you are doing it.
