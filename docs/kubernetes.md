# Kubernetes delivery

The production stack is delivered to a Kubernetes cluster as the Helm chart in
`deploy/helm/weeklyreport/`. `docker-compose.prod.yml` stays as the tested
reference and rollback path; the chart is checked against it by
`scripts/gates/operations/helm-chart-parity.test.ts`.

**Status.** The chart lints, renders, and passes the gate tests. It has not
been installed on a cluster yet; the cluster read-back (all pods ready,
migration, edge routing, PDF export, backup job) is separate evidence.
Authenticated flows, a real Ingress controller, and the CI image builder on
the project runner are NOT VERIFIED.

```
Ingress (cluster) -> Service edge:8080 (Caddy, plain HTTP)
                       |- /trpc /auth /health /admin/queues /pdfs /api/web-vitals /api/client-logs -> api:3001
                       `- everything else -> web:3000
api (1 replica, Recreate; initContainer migrate) -> pgbouncer -> postgres (StatefulSet, PVC)
                                                 -> redis (StatefulSet, PVC)
                                                 -> gotenberg:3000 -> web (internal print origin)
CronJob backup -> postgres, dumps to PVC pgbackups
```

Service names are fixed (`api`, `web`, `gotenberg`, `postgres`, `pgbouncer`,
`redis`, `edge`) because the web image bakes `http://api:3001`. Install **one
release per namespace**; a second one would collide on object names.

## Before the first install

- A StorageClass for four ReadWriteOnce volumes (`persistence.*`; an empty
  `storageClass` selects the cluster default).
- An Ingress controller; the chart creates one Ingress to `edge` and assumes
  nothing about the controller (`edge.ingress.className`, `tlsSecretName`,
  `annotations`). Set a read timeout of 300 seconds to match the edge's
  five minute upstream transport.
- `edge.trustedProxies`: the address ranges of the proxies in front of `edge`
  (the Ingress controller pods). The edge walks `X-Forwarded-For` from the
  right past these and forwards exactly one client address, which the api's
  `trust proxy: 1` relies on. If a load balancer adds another hop, include it.
- Images from the CI job `build-images`, referenced by `images.registry`
  (repository prefix) and `images.tag` (the commit SHA). The registry is
  private, so create a `kubernetes.io/dockerconfigjson` Secret in the
  namespace and name it in `images.pullSecret`; the chart never creates
  registry credentials.
- A values file outside Git: copy `values.production.example.yaml` and edit
  every value. Missing or mistyped required values fail the render and name the
  key; there are no product defaults.

## Secrets

Exactly one source, otherwise the render fails:

- `secrets.existingSecret: <name>` (preferred): a Secret created outside Git by
  DevOps' own tooling.
- `secrets.create: true` with `--set-file secrets.values.<KEY>=...` or masked CI
  values at install time. Never commit them.

Keys: `DB_PASSWORD`, `AUTH_JWT_SECRET`, `PDF_EXPORT_JWT_SECRET`,
`AI_PROVIDER_CONFIG_ENCRYPTION_KEY`, and optional `SMTP_USER`, `SMTP_PASS`,
`SENTRY_DSN`. `DB_PASSWORD` may contain only `A-Z a-z 0-9 . _ ~ -`; a password
supplied through values is rejected at render time, one from an existing Secret
is rejected by the first line of the `migrate` initContainer before any
database connection. The assembled `DATABASE_URL` is built inside the pod, so
the password never appears in a ConfigMap or rendered manifest.

Rotation: changing a Secret does not restart pods. Run
`kubectl -n <ns> rollout restart deployment/api deployment/web statefulset/postgres`
(and `deployment/pgbouncer`); backup Jobs read the Secret on their next run.
Do not rotate `AI_PROVIDER_CONFIG_ENCRYPTION_KEY` while encrypted provider
credentials exist (see `docs/operations.md`).

## Install and upgrade

```sh
helm upgrade --install weeklyreport deploy/helm/weeklyreport -n <ns> --create-namespace \
  -f values.yaml --set images.tag=<commit-sha> --atomic --timeout 10m
```

`--atomic` waits for readiness and rolls the release back on failure; do not add
`--wait` as well. `helm lint -f <values>` and `helm template -f <values>` run
offline; a plain `helm lint` without values fails by design.

The api runs one replica with strategy `Recreate` because `pdfdata` is a
ReadWriteOnce volume, so every upgrade has a short api outage (the initContainer
plus the 60 second startup budget).

## CI and delivery options

- `build-images` (GitLab CI, rootless BuildKit, no Docker daemon) pushes `api`,
  `migrate`, `web`, and `backup` tagged with the commit SHA to
  `$CI_REGISTRY_IMAGE` (override: `IMAGE_REGISTRY`, `IMAGE_REGISTRY_USER`,
  `IMAGE_REGISTRY_PASSWORD`) and records digests in the artifact
  `image-digests.txt`. It needs `WR_NEXT_PUBLIC_CLIENT_LOG_FORWARDING`,
  `WR_NEXT_PUBLIC_WEB_VITALS`, `WR_NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED`,
  `WR_NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES` (and optionally
  `NEXT_PUBLIC_SENTRY_DSN`), which are compiled into the web image. It runs by
  itself on the default branch and tags once these variables exist; otherwise
  it is manual. Whether the project runner permits rootless BuildKit is
  NOT VERIFIED.
- `deploy-production` is a manual job that exists only when a file-type
  `KUBECONFIG` variable is set; it also needs `HELM_VALUES_FILE` (file) and
  `HELM_NAMESPACE`.
- Alternative: the GitLab agent for Kubernetes is enabled on the instance and
  can replace the `KUBECONFIG` job. No agent configuration is part of this change.

## Rollback and failed migrations

- `helm rollback` and `--atomic` restore the previous manifests and image tag;
  they do not roll the database back. Migrations are forward-only; fix forward
  or restore a dump (see `docs/operations.md` "Rollback").
- **Failed migration.** The api pod runs `prisma migrate deploy` as an
  initContainer, so a failing migration leaves the pod in `Init:Error`; with
  strategy `Recreate` the old pod is already gone, so the api is down until the
  migration is resolved. Read the log first:
  `kubectl -n <ns> logs deploy/api -c migrate`. Prisma records the failed
  migration and refuses later runs until it is resolved. After fixing the cause:

  ```sh
  kubectl -n <ns> run migrate-resolve --rm -it --restart=Never \
    --image=<registry>/migrate:<tag> --overrides='{"spec":{"imagePullSecrets":[{"name":"<pull-secret>"}]}}' \
    --env=DATABASE_URL='postgresql://customreport:<password>@postgres:5432/<db>' \
    -- ./node_modules/.bin/prisma migrate resolve --rolled-back <migration_name>
  ```

  Then delete the api pod or run `helm upgrade` again so the initContainer
  retries. Use `--applied` instead of `--rolled-back` only when the migration's
  changes are known to be fully applied.

## Backups and restore drill

The `backup` CronJob (`backup.schedule`, `backup.retentionDays`, both required)
runs `backup-loop.sh` in one-shot mode into the `pgbackups` volume with
`concurrencyPolicy: Forbid`. A failed `pg_dump` fails the Job and leaves no
partial file. Same-cluster storage is not off-cluster protection; replicating
the volume is a DevOps decision. Alert on the CronJob's last successful run
(needs kube-state-metrics); the Compose staleness healthcheck has no CronJob
equivalent. Run one manually with
`kubectl -n <ns> create job --from=cronjob/backup backup-manual-1`.

Restore: scale `api` and `web` to zero, run `restore.sh` from the backup image
as a one-off Job that mounts the `pgbackups` claim and sets `PGHOST=postgres`,
`PGPORT=5432`, `PGUSER=customreport`, `PGPASSWORD` (from the Secret),
`PGDATABASE`, `RESTORE_ENVIRONMENT=production`,
`CONFIRM_RESTORE_TARGET=production|postgres|5432|<db>`,
`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=давай`, `ALLOW_PROD_DESTRUCTIVE=yes`,
and the dump path as the command argument; then scale back up and check
`/health/ready`. The drill is documented, not automated, and untested here.

## Monitoring and logs

The chart ships no monitoring stack. A scraper must reach `api:3001/metrics`
over the pod network (`api.podAnnotations` takes any annotations it needs); the
public edge returns 404 for `/metrics`. CronJob and restart alerts need
kube-state-metrics. Everything logs JSON to stdout; log rotation is the
kubelet's, not the chart's. `deploy/grafana/**` and `deploy/alert-rules.yml`
are importable artefacts, unverified against cluster label names.

## Not part of this change

NetworkPolicy (add it after DevOps confirm the CNI enforces policy and which
labels the ingress controller and scraper namespaces carry), HA PostgreSQL,
multiple api replicas, SBOM and provenance, off-cluster backup replication.
