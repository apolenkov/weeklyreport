# Kubernetes delivery

The production stack is delivered to a Kubernetes cluster as the Helm chart in
`deploy/helm/weeklyreport/`. Helm is the sole production deployment and
rollback surface. Rendered manifests are checked against independent production
contracts and the API runtime schema; chart `values.schema.json` and
`values.production.example.yaml` define operator inputs. Local development dependencies
run from `deploy/local-dev/` (`pnpm deps:up`) in the OrbStack namespace `wr-dev`.

**Status.** The chart lints, renders, and passes the gate tests. It was
installed on a local OrbStack cluster on 2026-10-01 and the read-back passed:
pods ready, 11 migrations, edge headers and routing, forged `X-Forwarded-For`
rejected, upgrade without data loss, postgres and redis pod deletion survived,
Gotenberg through the internal origin, backup job and `pg_restore --list`,
fail-closed password check, and sign-in, publish and PDF export through the
edge. A real browser, SAML sign-in, a real Ingress controller with TLS,
multi-node ReadWriteOnce volumes, `readOnlyRootFilesystem`, and the CI image
builder on the project runner are NOT VERIFIED.

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
database connection. The assembled `DATABASE_URL` is built inside the pod and
kept out of ConfigMaps. With `existingSecret`, rendered workloads contain only
Secret references; `secrets.create=true` also renders sensitive Secret data.

Changing a Secret does not restart pods. Restart only the consumers of the
changed key and verify their rollout; backup Jobs read the Secret on their next
run. Database-password rotation also requires changing the persisted PostgreSQL
role password, which a Secret update or pod restart does not do. Follow
[Rotating secrets](operations.md#rotating-secrets), including the restriction on
`AI_PROVIDER_CONFIG_ENCRYPTION_KEY` while encrypted provider credentials exist.

## Install and upgrade

`helm lint -f <values>` and `helm template -f <values>` run offline; a plain
`helm lint` without values fails by design. Install and upgrade are two distinct
branches: choose by whether the release already exists.

**First install** is an explicit `helm install` that waits for readiness with
the watcher strategy and never removes anything on failure:

```sh
helm install weeklyreport deploy/helm/weeklyreport -n <ns> --create-namespace \
  -f values.yaml --set images.tag=<commit-sha> --wait=watcher --timeout 10m
```

Do not add `--atomic` or `--rollback-on-failure` to an install: on failure Helm
would uninstall the release, and `pdfdata` and `pgbackups` are ordinary chart
PVCs without a keep policy, so the claims (and, with a `Delete` reclaim policy,
the backing volumes) can go with it. After a timeout keep the failed release, its
resources, the PVCs and the logs (`helm status`, `kubectl describe`,
`kubectl logs deploy/api -c migrate`) for diagnosis; any cleanup is a separate,
target-bound operator decision. The failure path of a first install has not been
exercised on a real cluster yet (see
[Rollback and failed migrations](#rollback-and-failed-migrations)).

**Upgrade of an existing release** is a different command and needs the data
compatibility of the previous images and values with the already migrated schema,
durable PDFs, queues and security policy to be confirmed first. It never uses
`--install`, so an upgrade cannot silently become an install:

```sh
helm upgrade weeklyreport deploy/helm/weeklyreport -n <ns> \
  -f values.yaml --set images.tag=<commit-sha> --rollback-on-failure --timeout 10m
```

`--rollback-on-failure` returns to the previous release and implies the watcher
wait. Where compatibility is not proven, omit it and plan a forward-only upgrade
that keeps the resources on failure. Neither rollback restores SQL data, cache,
Redis or PDFs.

The `postgres` pod mounts the `pgbackups` volume read-only, so storage classes with
`WaitForFirstConsumer` bind it at install and `--wait=watcher` can finish; the backup
Job must then run on the node that holds that ReadWriteOnce volume.

The api runs one replica with strategy `Recreate` because `pdfdata` is a
ReadWriteOnce volume, so every upgrade has a short api outage (the initContainer
plus the 60 second startup budget).

## Local self-hosted stand

A dev cluster (OrbStack, namespace `wr-local-prod`) can host the whole stack
without DevOps: `deploy/local-prod/` replaces the corporate IdP and SMTP relay,
and `deploy/helm/weeklyreport/values-local-prod.example.yaml` is the matching
values file. Nothing in it is a production artefact.

After TASK-369 the stand uses the database role `weeklyreport` and the databases
`weeklyreport_production` and `weeklyreport_e2e`. Recreate an older `wr-local-prod`
stand the way it was installed (not with `deploy/tester-kit/stop.sh`, which belongs to
the tester kit), or, on an existing volume, run `CREATE ROLE weeklyreport …`,
`CREATE DATABASE weeklyreport_production OWNER weeklyreport;` and
`CREATE DATABASE weeklyreport_e2e OWNER weeklyreport;`.

```sh
SHA=$(git rev-parse HEAD); STATE=<dir outside Git>
# 1. images (one at a time): wr/api, wr/migrate, wr/web, wr/backup tagged $SHA,
#    same targets and build args as the CI job build-images
# 2. dependencies: generates secrets/IdP key into $STATE, Secrets, Keycloak, Mailpit
STATE_DIR=$STATE deploy/local-prod/setup.sh
# 3. chart (copy the example outside Git first; the cert comes from setup.sh).
#    First install; on an existing release use the upgrade command from
#    "Install and upgrade" with the same values.
helm install weeklyreport deploy/helm/weeklyreport -n wr-local-prod \
  -f $STATE/values-local-prod.yaml --set images.tag=$SHA \
  --set-string api.env.KEYCLOAK_SAML_CERT="$(cat $STATE/secrets/idp-cert.b64)" --wait=watcher --timeout 10m
# 4. roles (below), then browser access
kubectl -n wr-local-prod port-forward svc/edge 8080:8080 &       # app
kubectl -n wr-local-prod port-forward svc/keycloak 8081:8080 &   # IdP, browser-facing
```

The realm `weeklyreport` has the SAML client `weeklyreport` (signed response and
assertion, NameID = e-mail, attributes `email` and `displayName`) and the users
`lead1@`, `head@`, `viewer@`, `admin@weeklyreport.local`; their passwords are in
`$STATE/secrets/secrets.env`. Mailpit receives the api's SMTP on `mailpit:1025`.

**Roles after SAML.** The assertion carries no role: `verifySamlProfile` always
yields `viewer`, and an existing `User` row is the source of truth and is never
re-synced from the IdP (`apps/api/src/modules/auth/user-session.ts`). Roles are
therefore assigned in the database before or after the first login. For the
stand, `deploy/local-prod/provision-users.sql` is the reproducible way: it
creates a reporting group and the four users with `samlId` equal to the NameID
(a different `samlId` for the same e-mail is refused as an identity mismatch)
and a non-viewer needs a reporting group. It is idempotent:

```sh
kubectl -n wr-local-prod exec -i statefulset/postgres -- \
  psql -U weeklyreport -d weeklyreport_production -v ON_ERROR_STOP=1 \
  < deploy/local-prod/provision-users.sql
```

The script applies the group, user upserts and head assignment in one
transaction. With `ON_ERROR_STOP=1`, a SQL error exits nonzero and rolls back
all changes from that run, including earlier statements. Resolve the conflicting
identity or constraint before retrying. A successful sequential replay keeps
the fixture identities and avoids duplicates; an existing non-null group head
is retained.

In a real deployment an admin does the same through the admin UI.

## Local stand and move to production

The local stand is the same chart with three stand-ins: Keycloak (IdP), Mailpit
(SMTP), and locally built `wr/*` images. Moving to production means replacing
those and the items below; the chart, the migrations and the backup job do not
change.

First-install command (the same as in the local stand section, with production
inputs; later releases follow the upgrade branch of
[Install and upgrade](#install-and-upgrade)):

```sh
helm install weeklyreport deploy/helm/weeklyreport -n <ns> --create-namespace \
  -f values.production.yaml --set images.tag=<commit-sha> --wait=watcher --timeout 10m
```

Start from `deploy/helm/weeklyreport/values.production.example.yaml`. The table
maps every stand value to its production counterpart. Items marked REPLACE IN
PROD (ЗАМЕНИТЬ В ПРОДЕ) have no usable stand value.

| Value                                                                         | Stand                                                  | REPLACE IN PROD (ЗАМЕНИТЬ В ПРОДЕ)                                                                                                                     |
| ----------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `images.registry`, `images.pullSecret`                                        | `wr`, none                                             | The registry written by `build-images`, plus a `dockerconfigjson` Secret                                                                               |
| `edge.ingress.host`, Ingress class, TLS                                       | `localhost`, port-forward                              | Real host, the cluster Ingress controller, a TLS Secret or cert-manager                                                                                |
| `edge.trustedProxies`                                                         | `127.0.0.1/32`                                         | The Ingress controller pod CIDR (and any load balancer hop)                                                                                            |
| `edge.cspReportUri`                                                           | placeholder                                            | Real CSP report collector or an agreed sink                                                                                                            |
| `api.env.FRONTEND_URL`, `APP_BASE_URL`                                        | `http://localhost:8080`                                | `https://<host>`                                                                                                                                       |
| `api.env.KEYCLOAK_SAML_ENTRY_POINT`, `_ISSUER`, `_CALLBACK_URL`, `_CERT`      | Keycloak realm `weeklyreport`, `http://localhost:8081` | Corporate IdP metadata: SSO URL, SP entity ID, callback `https://<host>/auth/saml/callback`, IdP signing certificate (base64)                          |
| IdP attributes                                                                | `email`, `displayName`, NameID = e-mail                | The IdP must release `email` and `displayName` (or `cn`); NameID is stored as `samlId` and must be stable                                              |
| `api.env.SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, Secret `SMTP_USER`/`SMTP_PASS` | `mailpit:1025`, no auth                                | The corporate relay and a sender it accepts                                                                                                            |
| Secret `weeklyreport-secrets`                                                 | generated by `setup.sh`                                | Created by DevOps tooling; fresh `DB_PASSWORD` (charset in "Secrets"), `AUTH_JWT_SECRET`, `PDF_EXPORT_JWT_SECRET`, `AI_PROVIDER_CONFIG_ENCRYPTION_KEY` |
| `persistence.storageClass` and sizes                                          | cluster default, 2Gi / 256Mi / 512Mi / 1Gi             | A real class (check `WaitForFirstConsumer` and ReadWriteOnce node pinning) and production sizes                                                        |
| `backup.schedule`, `retentionDays`                                            | hourly, 14                                             | Agreed RPO and retention; off-cluster replication of `pgbackups`                                                                                       |
| `AUTH_DEV_MODE`                                                               | `false` (chart value)                                  | Must stay `false`                                                                                                                                      |

Roles are not carried by SAML. After the first sign-in every user is a
`viewer`; an admin assigns roles and reporting groups in the admin UI (the
stand uses `deploy/local-prod/provision-users.sql` instead). Do not apply that
file in production.

Checks after install (all observed on the stand except those marked NOT
VERIFIED):

1. `kubectl -n <ns> get pods` all Ready; `helm status weeklyreport` deployed.
2. `GET /health/ready` is 200 through the edge (migrations, database, Redis,
   workers) and `GET /health/pdf-renderer` is 200.
3. SAML sign-in as a lead, a head and a viewer lands on the expected home page
   and the role matches the admin-assigned one. Real IdP: NOT VERIFIED.
4. Lead saves and submits; head acknowledges, publishes and exports a PDF; the
   downloaded file is larger than zero bytes and `file` reports a PDF.
5. A reminder reaches the mail relay (Mailpit on the stand). Reminders are sent
   only for an editable period (open, or published and reopened) that has an
   active policy; the rule is created by the hourly repair job and sent by the
   next hourly dispatch, so allow up to two hours. Real SMTP: NOT VERIFIED.
6. A manual backup Job completes and `pg_restore --list` reads the dump; run the
   restore drill below once on a non-production namespace.
7. Edge: forged `X-Forwarded-For` is ignored and `/metrics` returns 404.
8. Real Ingress with TLS, HSTS and the CSP report sink: NOT VERIFIED.

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
  `HELM_NAMESPACE`. Run it only after `build-images` succeeded for the same
  commit SHA: GitLab counts a failed manual allow-failure job as satisfied, so
  read the job result before deploying.
- Alternative: the GitLab agent for Kubernetes is enabled on the instance and
  can replace the `KUBECONFIG` job. No agent configuration is part of this change.

## Rollback and failed migrations

- `helm rollback` and an upgrade's `--rollback-on-failure` restore the previous
  manifests and image tag; they do not roll the database back. A failed first
  install has no previous release: keep it as described in
  [Install and upgrade](#install-and-upgrade). Migrations are forward-only; fix forward
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
    --env=DATABASE_URL='postgresql://weeklyreport:<password>@postgres:5432/<db>' \
    -- ./node_modules/.bin/prisma migrate resolve --rolled-back <migration_name>
  ```

  Then delete the api pod or run `helm upgrade` again so the initContainer
  retries. Use `--applied` instead of `--rolled-back` only when the migration's
  changes are known to be fully applied.

## Backups and restore drill

The chart's `backup` CronJob uses the release backup image, required
`backup.schedule` and `backup.retentionDays`, and the `pgbackups` PVC. PostgreSQL
mounts that PVC read-only; backup and recovery Jobs must share its node because
it is ReadWriteOnce. Same-cluster storage is not off-cluster protection.

Use the canonical [backup and restore runbook](operations.md#backups) for manual
Jobs, pre-deploy archives, writer shutdown, CronJob suspension, and the one-off
restore Job with the exact target and all destructive-consent guards. Do not
apply production restore tokens to an unapproved target.

Recorded local evidence from 2026-10-04: backup, `TRUNCATE` of report tables,
restore, and matching control counts and IDs on the local stand. This historical
read-back is not a new drill, production acceptance, or evidence of an
independent off-cluster restore. Redis queues and `pdfdata` are outside the
PostgreSQL dump and require separate reconciliation.

## Monitoring and logs

The chart ships no monitoring stack. A scraper must reach `api:3001/metrics`
over the pod network (`api.podAnnotations` takes any annotations it needs); the
public edge returns 404 for `/metrics`. CronJob and restart alerts need
kube-state-metrics. Everything logs JSON to stdout; log rotation is the
kubelet's, not the chart's. `observability/alert-rules.yml` and `observability/grafana/**` in the chart
directory (`deploy/helm/weeklyreport/observability/`, excluded from the chart
package by `.helmignore`) are the monitoring handover for DevOps: importable
artefacts, unverified against cluster label names. Check the label names in the
cluster before importing them.

## Not part of this change

NetworkPolicy (add it after DevOps confirm the CNI enforces policy and which
labels the ingress controller and scraper namespaces carry), HA PostgreSQL,
multiple api replicas, SBOM and provenance, off-cluster backup replication.
