# Operations runbook

Production uses the Helm chart in `deploy/helm/weeklyreport/`. This runbook
covers diagnosis and recovery; [Kubernetes delivery](kubernetes.md) covers
cluster prerequisites, installation, and the local stand. Production deployment
and recovery remain unverified until a real target supplies read-back evidence.
The dated local-stand results in that guide are not production acceptance.

## The stack

The chart installs one release per namespace with fixed Service names:

| Workload                | Role                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `edge` Deployment       | Caddy on private port 8080 behind the cluster Ingress; Ingress owns TLS. Routes API paths to `api` and other requests to `web`; `/metrics` is internal-only. |
| `web` Deployment        | Next.js standalone server, private Service on port 3000.                                                                                                     |
| `api` Deployment        | NestJS + tRPC, private Service on port 3001, one replica with `Recreate` rollout.                                                                            |
| `migrate` initContainer | Runs `prisma migrate deploy` before the API container starts.                                                                                                |
| `pgbouncer` Deployment  | Transaction-mode pool for API database traffic.                                                                                                              |
| `postgres` StatefulSet  | Database on the `pgdata-postgres-0` PVC.                                                                                                                     |
| `redis` StatefulSet     | BullMQ queues on persistent storage, `noeviction` with an explicit memory cap.                                                                               |
| `gotenberg` Deployment  | Private PDF renderer; Chromium may fetch only the chart-derived internal Web print origin.                                                                   |
| `backup` CronJob        | One-shot `pg_dump` into the `pgbackups` PVC with required schedule and retention.                                                                            |

Migrations, backups, and restores connect directly to `postgres:5432` because
DDL and `pg_dump` need a session that outlives one transaction. The API uses
PgBouncer. `pdfdata` holds exported files separately from the database.

## First deploy

1. Confirm the Kubernetes context and namespace, registry access, StorageClass,
   Ingress/TLS, trusted proxy ranges, IdP, SMTP, and monitoring ownership using
   [Before the first install](kubernetes.md#before-the-first-install). Memory
   requests and limits live in chart `values.yaml`; size the cluster and storage
   for the chosen values. The repository has no measured production capacity.
2. Copy `deploy/helm/weeklyreport/values.production.example.yaml` to a reviewed
   values file outside Git. `values.schema.json` is the required-input contract;
   missing required values fail rendering. Supply exactly one Secret source as
   described in [Secrets](kubernetes.md#secrets). Do not copy local `.env` values
   into production. Keep the encryption key and its version recoverable outside
   the cluster, together with the values and Secret recovery procedure.
3. Build the release with the `build-images` CI job and verify its result and
   `image-digests.txt`. All four repository images use the same commit SHA in
   `images.tag`. `NEXT_PUBLIC_*` inputs belong to the image build, not Helm
   runtime configuration. `NEXT_PUBLIC_SENTRY_DSN` is compiled into the Web image;
   changing it requires a new image build and deployment. The build and chart
   own the same fixed `API_URL=http://api:3001`; it is not an operator override.
4. Review the render before activation, then install or upgrade the release:

   ```sh
   kubectl config current-context
   helm lint deploy/helm/weeklyreport --strict -f <values-file> --set images.tag=<commit-sha>
   helm template weeklyreport deploy/helm/weeklyreport -n <ns> -f <values-file> --set images.tag=<commit-sha>
   ```

   First install (the release does not exist yet). Do not add `--atomic` or
   `--rollback-on-failure`: on install they uninstall the release, and the
   `pdfdata`/`pgbackups` claims go with it.

   ```sh
   helm --kube-context <approved-context> -n <ns> install weeklyreport deploy/helm/weeklyreport --create-namespace      -f <values-file> --set images.tag=<commit-sha> --wait=watcher --timeout 10m
   ```

   If it times out or fails, keep the failed release, its resources, PVC/PV and
   logs for diagnosis; deleting them is a separate, target-bound operator decision.
   Upgrade an existing, deployed release (never with `--install`):

   ```sh
   helm --kube-context <approved-context> -n <ns> upgrade weeklyreport deploy/helm/weeklyreport \
     -f <values-file> --set images.tag=<commit-sha> --wait=watcher --timeout 10m
   ```

   Add `--rollback-on-failure` to an upgrade only after the previous images and
   values are shown compatible with the current post-migration schema and durable
   data; otherwise fix forward. Use the same reviewed values and tag for rendering
   and installation. Rendered output can contain Secrets when `secrets.create=true`;
   protect it accordingly. Neither flag undoes migrations.

5. Verify the release before serving users:

   ```sh
   helm --kube-context <approved-context> -n <ns> status weeklyreport
   kubectl --context <approved-context> -n <ns> get pods,pvc,jobs,cronjobs
   kubectl --context <approved-context> -n <ns> logs deployment/api -c migrate
   kubectl --context <approved-context> -n <ns> rollout status deployment/api --timeout=5m
   kubectl --context <approved-context> -n <ns> rollout status deployment/web --timeout=5m
   curl -fsS https://<host>/health/ready
   curl -fsS https://<host>/health/pdf-renderer
   ```

   Follow the sign-in, role, report, PDF, mail, and edge checks in
   [Kubernetes delivery](kubernetes.md#local-stand-and-move-to-production).
   Readiness alone does not prove those flows or external production controls.

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
  API startup and readiness probes use. During startup it stays unavailable
  until both workers connect; the chart allows 12 startup attempts at five-second
  intervals. Liveness uses `/health/live` independently.
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

| Indicator  | Likely cause and first move                                                                                                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `database` | pgbouncer or postgres down, or the pool is exhausted. `kubectl -n <ns> logs deployment/pgbouncer` and `kubectl -n <ns> logs statefulset/postgres`. The pooler probe runs a real `SELECT 1` through its database path.   |
| `redis`    | Redis evicting or out of memory. It runs `noeviction` on purpose — a full Redis fails writes loudly rather than dropping jobs. Check `INFO memory` against the configured `redis.maxmemoryMb` cap (200 MiB by default). |
| `bullmq`   | A required worker is starting, paused, stopped, or disconnected, or a queue is wedged. Read the safe `workers` states, then inspect API logs, `/admin/queues`, and the DLQ.                                             |
| `memory`   | Heap crossed the threshold. This sheds traffic on purpose, ahead of the container OOM-killer. Restart the api, then find what grew.                                                                                     |

## Backups

The `backup` CronJob runs the image-baked `backup-loop.sh` with
`BACKUP_RUN_ONCE=true`. `backup.schedule` controls the cadence and
`backup.retentionDays` controls the local history window. Neither value alone
proves achieved RPO or RTO; those measurements come from a recorded restore
drill. The CronJob has `concurrencyPolicy: Forbid`, no Job retry, and a bounded
run time. A completed dump is published as `weeklyreport-<stamp>-<unique>.dump` only after
`pg_dump` succeeds; failures leave no restorable-looking partial file.

The backup image also contains `restore.sh`. It uses the release's image tag,
Secret, resource limits, and security context. No mutable host script is mounted.
The Job is pinned to the PostgreSQL node because both mount the ReadWriteOnce
`pgbackups` volume. PostgreSQL mounts that volume read-only for inspection.

Monitor the CronJob's last successful run and failed Jobs through the cluster
monitoring platform (for example, kube-state-metrics). The chart does not run
the standalone backup loop's staleness healthcheck. **The PVC is not off-cluster
protection.** Replication to an independent failure domain, encryption, retention,
and restore access remain operator-owned requirements.

### Manual and pre-deploy backup

Record the CronJob's current suspension state, suspend it, and wait for any
already-active backup Job to finish. Coordinate with other operators so they do
not create a concurrent manual Job, then choose a unique Job name.
`concurrencyPolicy: Forbid` governs the CronJob controller; it does not serialize
manually created Jobs. Suspension does not stop an already-running Job.

```sh
kubectl -n <ns> get cronjob/backup -o jsonpath='{.spec.suspend}'
kubectl -n <ns> patch cronjob/backup --type=merge -p '{"spec":{"suspend":true}}'
kubectl -n <ns> get jobs
# Continue only after every earlier backup Job has finished.
kubectl -n <ns> create job --from=cronjob/backup backup-<run-id>
kubectl -n <ns> wait --for=condition=complete job/backup-<run-id> --timeout=30m
kubectl -n <ns> logs job/backup-<run-id>
```

Inspect the archive through a separate Job copied from the installed backup
CronJob. The backup producer takes its UID and fsGroup from `postgres.runAsUser`
(999 by default), so PostgreSQL can read the mode-0600 dumps through its
read-only PVC mount. Dumps written before this alignment belong to UID 70. If
the storage class applies fsGroup, kubelet regroups them to 999 and they stay
readable; otherwise UID 999 cannot read them until retention prunes them. For
such a dump only, run the inspection or restore Job with `runAsUser: 70` and
`fsGroup: 70` and test `id -u` against 70 instead of 999; never change file
ownership or modes.

```sh
kubectl -n <ns> create job --from=cronjob/backup backup-inspect-<run-id> \
  --dry-run=client -o yaml > <protected-state-dir>/backup-inspect.yaml
```

Keep the inherited image, UID, fsGroup, Secret references, resource limits,
node affinity, and Job deadline. Make the `/backups` mount read-only and replace
only the backup container's command and arguments with:

```yaml
command:
  - /bin/sh
  - -ec
  - |
    id
    test "$(id -u)" = 999
    case "$1" in /backups/weeklyreport-*.dump) ;; *) exit 2 ;; esac
    test -x /backups
    test -f "$1"
    test -r "$1"
    stat -c 'mode=%a uid=%u gid=%g bytes=%s' "$1"
    pg_restore --version
    pg_restore --list "$1"
    sha256sum "$1"
  - archive-inspection
args:
  - /backups/<exact-successful-dump-file>
```

Choose the exact dump from the successful backup log, verify the context,
namespace, image, and PVC, then run the reviewed inspection Job:

```sh
kubectl -n <ns> apply -f <protected-state-dir>/backup-inspect.yaml
kubectl -n <ns> wait --for=condition=complete job/backup-inspect-<run-id> --timeout=<approved-inspection-timeout>
kubectl -n <ns> logs job/backup-inspect-<run-id>
kubectl -n <ns> get pods -l job-name=backup-inspect-<run-id> -o jsonpath='{range .items[*].status.containerStatuses[*]}{.imageID}{"\n"}{end}'
```

Record the actual UID and groups, image ID, exit status, size, and checksum.
Do not change ownership or permissions to make the inspection pass. Inspection
runs no backup loop, retention pruning, or restore; list/hash success proves
archive readability only.

Use the exact filename from the successful Job log. A timeout is not a success;
inspect Job status, events, and logs before proceeding. Before a schema release,
preserve the verified dump and checksum in protected recovery storage outside
CronJob retention. Its ordinary `weeklyreport-*.dump` remains subject to pruning.
A readable archive is necessary evidence, but does not prove a successful restore.
Restore the recorded CronJob suspension state after the backup finishes and its
archive is secured; if it was previously unsuspended, use
`kubectl -n <ns> patch cronjob/backup --type=merge -p '{"spec":{"suspend":false}}'`.
A failed manual run must be investigated, not silently reported as a backup.

### Restore drill

Practise on an explicitly authorized disposable target. Repository tests
exercise the archive, target, consent, and transaction guards, but they do
not constitute a current restore drill or prove schema and row-count parity.
The local-stand drill recorded in [Kubernetes delivery](kubernetes.md#backups-and-restore-drill)
does not authorize another target or establish production recovery.

A production restore is destructive and requires separate authorization for the
exact target and data-loss window. The standing local test-database permission
does not authorize it. The procedure remains **untested in production**.

1. Confirm the Kubernetes context, namespace, `postgres.db`, Secret reference,
   dump path and checksum, and release image. Record the current API, Web, and
   PgBouncer replica counts and CronJob suspension state. Arrange maintenance
   access at the Ingress so users cannot resume traffic during validation. Stop
   deployment automation and all other writers for the maintenance window.
2. Suspend scheduled backups and wait for every already-active backup Job to
   finish. Suspension does not stop running Jobs. Stop the application and
   pooler, then wait until their pods have terminated:

   ```sh
   kubectl -n <ns> patch cronjob/backup --type=merge -p '{"spec":{"suspend":true}}'
   kubectl -n <ns> get jobs
   kubectl -n <ns> scale deployment/api deployment/web deployment/pgbouncer --replicas=0
   kubectl -n <ns> wait --for=delete pod -l 'app.kubernetes.io/name=weeklyreport,app.kubernetes.io/component in (api,web,pgbouncer)' --timeout=2m
   ```

   Verify there are no remaining external database writers or open transactions.
   Do not start a restore after a failed wait or while a backup is still active.

3. Prepare a Job outside Git from the installed CronJob. This retains the exact
   image, Secret references, UID, resource limits, and PostgreSQL node affinity:

   ```sh
   kubectl -n <ns> create job --from=cronjob/backup restore-<run-id> \
     --dry-run=client -o yaml > <protected-state-dir>/restore.yaml
   ```

   Edit its single container's `command` and append the three guard variables to
   its existing `env` list; preserve the inherited `PG*` and
   `RESTORE_ENVIRONMENT=production` values:

   ```yaml
   command: ["/usr/local/bin/restore.sh", "/backups/<dump-file>"]
   # Append to the existing env list; substitute the exact postgres.db below.
   env:
     - { name: CONFIRM_RESTORE_TARGET, value: "production|postgres|5432|<db>" }
     - { name: PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION, value: "давай" }
     - { name: ALLOW_PROD_DESTRUCTIVE, value: "yes" }
   ```

   Set the `/backups` volume mount to `readOnly: true`, review the Job deadline
   for the planned restore, and verify the manifest's namespace and target before
   applying. These tokens satisfy the script guard; they do not grant production
   authorization. Never weaken or remove the guard to make a run pass.

4. Run the reviewed Job and inspect its result:

   ```sh
   kubectl -n <ns> apply -f <protected-state-dir>/restore.yaml
   kubectl -n <ns> wait --for=condition=complete job/restore-<run-id> --timeout=<approved-timeout>
   kubectl -n <ns> logs job/restore-<run-id>
   ```

   `restore.sh` validates the archive and exact target before invoking
   `pg_restore --clean --if-exists --single-transaction`. A failed restore rolls
   back the transaction. Require both a completed Job and `[restore] complete`;
   on failure keep writers stopped and investigate.

5. Compare the restored schema and agreed control queries against the backup
   record before restarting writers. Confirm that the selected API image and
   migrations are compatible with that schema: the migrate initContainer runs
   again when the API starts. Restore PgBouncer, API, and Web to their recorded
   replica counts, wait for rollout readiness, then check `/health/ready` and the
   agreed role/report/PDF flows before reopening traffic. Restore the prior
   CronJob suspension state only after recovery succeeds.

Redis queues and `pdfdata` files are not in the PostgreSQL dump. Preserve them
and reconcile their state with the restored database; do not assume every queue
or PDF can be rebuilt automatically. Record missing or stale artifacts before
choosing an authorized repair.

A drill record must bind the repository SHA, dump checksum, source and target,
start and finish timestamps, schema comparison, agreed row-count or checksum
queries, and the final readiness result. Keep that read-back outside the
repository with the production release evidence; without it, measured RPO/RTO
and production recovery remain BLOCKED. Preserve Job logs and evidence before
removing completed manual Jobs and the temporary restore manifest.

## Rotating secrets

`AUTH_JWT_SECRET` signs session cookies and `PDF_EXPORT_JWT_SECRET` signs the
short-lived token the PDF renderer uses. Rotating either **invalidates every
live session or in-flight export** — there is no dual-key grace period.

To rotate `AUTH_JWT_SECRET`:

1. Announce that signed-in users will need to log in again.
2. Update `AUTH_JWT_SECRET` through the owner of the installed Kubernetes Secret.
3. Run `kubectl -n <ns> rollout restart deployment/api`, wait for
   `kubectl -n <ns> rollout status deployment/api`, and verify readiness and sign-in.
   Changing a Secret alone does not restart pods.

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

`DB_PASSWORD` is shared by PostgreSQL, PgBouncer, migrations, and backups.
Changing the Kubernetes Secret or restarting PostgreSQL does **not** change an
existing database role's password. Plan a coordinated maintenance operation to
change the role password, update the Secret, restart its consumers, and verify
new connections; suspend backups during that window. Do not use a generic
Secret restart command as a database-password rotation procedure.

The password must contain only URL-safe unreserved characters
(`A-Z a-z 0-9 . - _ ~`); `postgres.db` must contain only letters, digits, and
underscores. Helm validates the database name and a values-supplied password.
For an existing Secret, the migrate initContainer validates the password before
its first database connection. `NEXT_PUBLIC_*` changes need a **rebuild** —
they are inlined at build time and a restart will not pick them up.

### API shutdown budget

The API completes its ordered shutdown phases within a 12.5-second worst-case
budget: application close, rate-limit Redis, log barrier and file flush, OTel,
and Sentry. BullMQ workers and queue handles first attempt a graceful close for
500 ms, then use BullMQ's supported force-close/disconnect operation. Force
disconnecting does not delete active jobs; BullMQ's stalled-job recovery can
reclaim them on the next worker start. The chart grants the API a
20-second `terminationGracePeriodSeconds`, leaving margin for signal delivery and runtime
teardown while preserving the final log and telemetry phases.

## Migrations

The API pod's `migrate` initContainer runs `prisma migrate deploy` before the
API starts, applying only pending migrations. It never resets. A failed
migration blocks API startup; inspect `kubectl -n <ns> logs deployment/api -c migrate`
and follow [failed migration recovery](kubernetes.md#rollback-and-failed-migrations).

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

### Перед деплоем OCR-правок 287

Run these on the real target database (read-only queries, the owner runs them)
before applying any of these migrations:
`20261007003500_user_email_case_insensitive`,
`20261007120000_semantic_embedding_nonzero_vector`,
`20261012110000_report_autoarchive_flag_check`,
`20261012163000_reviewer_history_delete_restrict` or
`20261013020000_reopen_reviewer_history_delete_restrict`. Also run them before
deploying the API that enforces the key format. Take the pre-deploy dump first
([Manual and pre-deploy backup](#manual-and-pre-deploy-backup)).

1. **Email duplicates.** The first migration fails loudly on any case-only
   duplicate; the result must be empty. Otherwise resolve the listed users as
   an operator decision (no automatic merge) and repeat.

   ```sql
   SELECT lower(btrim("email")) AS email_key, count(*) AS users, array_agg("id") AS user_ids
   FROM "User"
   GROUP BY 1
   HAVING count(*) > 1;
   ```

2. **Zero vectors.** The second migration deletes these cache rows; the
   read-through path rebuilds them. A non-zero count is acceptable only if the
   owner confirms the rebuild cost.

   ```sql
   SELECT count(*) AS zero_norm_rows
   FROM "SemanticEmbedding"
   WHERE vector_norm("vector") = 0;
   ```

3. **Auto-archived reports.** The third migration rejects reports marked as
   auto-archived without being archived; the result must be empty. Otherwise
   resolve the listed reports as an operator decision and repeat.

   ```sql
   SELECT "id" FROM "Report" WHERE "autoArchived" AND NOT "archived";
   ```

4. **Reviewer history.** The fourth migration replaces the three reviewer-user
   foreign keys with `ON DELETE RESTRICT` in one transaction, without deleting
   data. The fifth migration sets `ReopenRequest.reviewedById` to
   `ON DELETE RESTRICT ON UPDATE CASCADE`, preserving the live reviewer as the
   author of the decision. Existing `NULL` authors on legacy requests remain
   unchanged. A user with any live acknowledgement, verdict, comment or reopen
   decision must be deactivated instead of deleted. Existing validated foreign
   keys already prevent orphaned references; no cleanup or backfill is required
   before either replacement.

5. **Rollback of the first three schema changes.** Undo each applied migration separately,
   only when its schema change must be undone. Deleted cache rows are not
   restored; they rebuild on demand.

   ```sql
   DROP INDEX IF EXISTS "User_email_lower_key";
   ALTER TABLE "SemanticEmbedding" DROP CONSTRAINT IF EXISTS "SemanticEmbedding_vector_nonzero_check";
   ALTER TABLE "Report" DROP CONSTRAINT IF EXISTS "Report_auto_archived_state_check";
   ```

   Prisma migration history still lists the applied migrations after this;
   reconcile it only through the explicitly authorized recovery path, otherwise
   fix forward with a new migration. Do not undo the fourth or fifth reviewer
   migration or restore reviewer-user delete cascades: that would permit
   deletion of retained history and violate the owner policy. Recover either
   migration by fixing forward; any reversal requires a new owner decision.

6. **Key format, without printing the value.** For every environment, the
   `AI_PROVIDER_CONFIG_ENCRYPTION_KEY` must be 64 hex characters or canonical
   padded base64 of 32 bytes, otherwise boot fails closed. The value is passed
   through the environment and only `OK`/`INVALID` is printed:

   ```sh
   AI_KEY="$(kubectl -n <ns> get secret <secret> \
     -o jsonpath='{.data.AI_PROVIDER_CONFIG_ENCRYPTION_KEY}' | base64 -d)" \
   node --import tsx -e '
     import("./apps/api/src/lib/ai-provider-key-material.ts").then(({ parseAiProviderKeyMaterial }) => {
       try { parseAiProviderKeyMaterial(process.env.AI_KEY ?? ""); console.log("OK"); }
       catch { console.log("INVALID"); process.exitCode = 1; }
     });'
   ```

   Do not rotate or replace the key to fix the format while encrypted provider
   credentials are retained (see [Rotating secrets](#rotating-secrets)); fix only
   the encoding of the same bytes.

### Agentation feedback operations

WeeklyReport uses `agentation@3.1.2` for the authenticated development/
non-production toolbar and `agentation-mcp@1.3.2` for agent access. Both use
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

Images are the unit of rollback; the database is not. Production image rollback
is **BLOCKED** until the selected release's images remain available in the
registry and deployment read-back exists. The chart closes the
image-source blocker only after the first successful image push and a
verified deployment; a local rebuild is not evidence of production rollback.

For a schema-compatible application/configuration rollback, inspect the release
history and the target revision's images and values before running:

```sh
helm -n <ns> history weeklyreport
helm -n <ns> rollback weeklyreport <revision> --wait --timeout 10m
kubectl -n <ns> rollout status deployment/api --timeout=5m
curl -fsS https://<host>/health/ready
```

Helm rollback and an upgrade's `--rollback-on-failure` rollback restore manifests
and image tags; neither restores the database. Never overwrite a published image tag.
If a migration shipped, either fix forward with a new migration or use an
explicitly authorized pre-deploy dump restore and accept the agreed loss of
later writes. Prepare and verify that dump with
[Manual and pre-deploy backup](#manual-and-pre-deploy-backup) before the release.
The PDF artifact generation compatibility constraint above also applies.

## CI

`.gitlab-ci.yml` runs the lint/test lanes (`node-toolchain`, `quality`,
`dependency-scan`, `coverage`, `api-integration`, `migrate-reset`), one gated
image build (`build-images`, rootless BuildKit, no Docker-in-Docker), and an
optional manual `deploy-production` job; see `docs/gitlab-ci.md`. The `api-integration` lane runs the API unit and
integration suites once, serially, against disposable Postgres/Redis/Mailpit
(in-job loopback Postgres; Redis and Mailpit as service aliases) and enforces the API coverage thresholds.
The `coverage` lane enforces Web coverage without starting a second dependency
stack; the `quality` lane runs lint, typecheck, and unit tests, and
`migrate-reset` covers migration drift. The `production-build` lane checks the complete workspace build on the pipeline SHA; the
PDF export, browser acceptance, and the read-back of a deployment are not CI
evidence and stay required evidence collected outside CI; a successful
`build-images` run produces images, not that evidence. Local
commands remain the fast gate; run the same checks before pushing.

## Load check

`deploy/tester-kit/load/read-pages.js` (k6) signs a Lead and a Head in through SAML once and then loads their
read pages (`/lead/report`, `/head/dashboard`, `/reports`, `/reports/latest`, `/reports/trends`) from 20 virtual
users for 3 minutes against the tester stand. Measured 2026-10-06 on a shared laptop (OrbStack Kubernetes, load
average above 30): 43,897 requests at about 243 requests per second, p95 108 ms, 0 failed. It covers
read-only page loads only; it says nothing about saves, PDF export or a production-sized dataset.

## External first-production prerequisites

Local Helm rehearsals and repository tests prove only repository-owned readiness. The
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

The `pgbackups` volume, the alert rules and Grafana dashboards under
`deploy/helm/weeklyreport/observability/`, and checked-in workflows are templates
or repository evidence only; none is a production PASS by itself. The
production Helm chart ships no monitoring stack, and the repository has no local
one.

Grafana scans two non-overlapping dashboard roots: operational and tRPC
dashboards appear in `WeeklyReport`, while product telemetry appears in
`Product KPIs`. `observability/alert-rules.yml` and `observability/grafana/**`
remain operator reference material; verify their labels and receivers against
the actual cluster before treating them as production monitoring.
Off-box encrypted backup remains **BLOCKED** until an operator supplies a
provider endpoint, repository identity, encryption key policy, retention policy,
and a scheduled restore read-back. This repository deliberately does not invent
those external inputs or claim a restic-style recovery PASS without them.
