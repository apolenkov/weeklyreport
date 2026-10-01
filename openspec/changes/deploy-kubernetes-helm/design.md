## Context

Source of truth for the port: `docker-compose.prod.yml` (10 services), the two
Dockerfiles, `deploy/**`, `env.schema.ts`, and the specs named in the proposal.
Owner decisions (decision-092, 2026-10-01) are fixed and not reopened: corporate
cluster, Helm chart in the repo, in-cluster PostgreSQL as a StatefulSet with a PVC
and CronJob `pg_dump` backups, no HA, images built in GitLab CI without
Docker-in-Docker, optional manual deploy job, no Argo CD assumption.

Constraints found while reading the code (each decides a choice below):

- The api sets `trust proxy` to exactly 1 (`api-bootstrap.ts`). Rate limits and
  audit IP come from `req.ip`. The number of proxy hops in front of the api is
  therefore part of the contract.
- `API_URL=http://api:3001` is compiled into the web image (rewrites) and must equal the
  runtime value (`web-api-url-config` spec). Service names are baked into images.
- `Dockerfile.api` uses `RUN --mount=type=cache` and
  `RUN --mount=from=builder,source=...,readonly`. Not every builder supports that.
- `PDF_BASE_URL` is only `z.url()`; the render cookie domain is
  `new URL(PDF_BASE_URL).hostname` (`pdf-export.service.ts`). The print URL is
  `{PDF_BASE_URL}/print/{reportId}?jobId=...` (`pdf-export.processor.ts`).
- `/health/live` (process only) and `/health/ready` (Postgres, Redis, BullMQ, heap) both exist.
- `backup-loop.sh` never exits; the compose health check is "a recent dump exists".
- Cookie `secure` is `NODE_ENV === "production"`, not derived from `X-Forwarded-Proto`.
- Gates: `prod-compose-gate.test.ts` (1585 lines) asserts compose and CI
  facts, including a negative lock on CI image builds and a `deepEqual` on the
  reviewed external image set. `prettier --check .` runs on every YAML file.

## 1. Object mapping

```
                     Internet / intranet
                            |
                  Cluster Ingress (DevOps)  -- TLS, host
                            |  one hop
                      Service edge:8080
                            |
                     Deployment edge (Caddy, plain HTTP)
              /trpc /auth /health /admin/queues /pdfs /api/web-vitals /api/client-logs
                 |                                         everything else
                 v                                               v
          Service api:3001                                Service web:3000
          Deployment api (1 replica, Recreate)            Deployment web
            initContainers: config-guard, migrate           |
            PVC pdfdata (RWO)                               | server-side fetch
              |    |    |                                   v
              |    |    +--> Service gotenberg:3000 --> prints http://web... (internal)
              |    +-------> Service redis:6379  (StatefulSet + PVC redisdata)
              +-----------> Service pgbouncer:5432 (Deployment)
                                  |
                           Service postgres:5432 (StatefulSet + PVC pgdata)
                                  ^
                CronJob backup ---+   (PVC pgbackups, concurrencyPolicy Forbid)
```

| Compose service                      | Kubernetes objects                                                                                                                         | Notes                                                                                                                                                                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config-guard`                       | `values.schema.json` (required, pattern) plus a `fail` helper at template time, plus a runtime `config-guard` initContainer on the api pod | Template time sees values only. With `existingSecret` the password is invisible to Helm (`lookup` returns nothing under `helm template` and `--dry-run`), so the same shell `case` check also runs at pod start. One check source: the script text lives once in `_helpers.tpl`. |
| `postgres`                           | StatefulSet (1 replica), ClusterIP Service `postgres`, `volumeClaimTemplates` `pgdata`                                                     | `PGDATA=/var/lib/postgresql/data/pgdata` (a subdirectory: a fresh volume holds `lost+found`, which makes initdb refuse the mount point). Same pgvector image digest as compose.                                                                                                  |
| `pgbouncer`                          | Deployment, Service `pgbouncer`                                                                                                            | Same env contract and `SELECT 1` probe as compose. Kept (not dropped) because the api `DATABASE_URL` uses `?pgbouncer=true` and the pool sizes are specified.                                                                                                                    |
| `backup`                             | CronJob, PVC `pgbackups`, image built from `Dockerfile.backup`                                                                             | See section 5.                                                                                                                                                                                                                                                                   |
| `redis`                              | StatefulSet (1 replica) with `volumeClaimTemplates` `redisdata`, Service `redis`                                                           | `--maxmemory` and `REDIS_MAXMEMORY_BYTES` both render from one value `redis.maxmemoryMb` (compose kept two literals in sync by comment).                                                                                                                                         |
| `migrate`                            | initContainer `migrate` on the api pod (migrator image target)                                                                             | See section 1.1.                                                                                                                                                                                                                                                                 |
| `gotenberg`                          | Deployment, Service `gotenberg`, NetworkPolicy                                                                                             | No Ingress rule, no external Service.                                                                                                                                                                                                                                            |
| `api`                                | Deployment (replicas 1, strategy `Recreate`), Service `api`, PVC `pdfdata`                                                                 | See section 5.                                                                                                                                                                                                                                                                   |
| `web`                                | Deployment, Service `web`                                                                                                                  |                                                                                                                                                                                                                                                                                  |
| `caddy`                              | Deployment `edge` + Service `edge` + ConfigMap (Caddyfile via `.Files`) + one Ingress                                                      | See section 1.2.                                                                                                                                                                                                                                                                 |
| volumes `caddy_data`, `caddy_config` | `emptyDir`                                                                                                                                 | Caddy runs plain HTTP behind the Ingress with no ACME, so nothing there is durable.                                                                                                                                                                                              |
| env files                            | one ConfigMap per workload (non-secret) plus the Secret (section 3)                                                                        |                                                                                                                                                                                                                                                                                  |

Service names are exactly `api`, `web`, `gotenberg`, `postgres`, `pgbouncer`,
`redis`, `edge`, with no release prefix, because `http://api:3001` is baked into
the web image. Consequence, stated in the chart README and enforced by a
template check: **one release per namespace**. Two releases in one namespace
would collide on object names; helm refuses the second install on its own, so
no extra guard is needed beyond the doc line.

### 1.1 Migration: initContainer, not a Helm hook

- A `pre-install` hook runs before the chart's own resources exist. On first
  install the in-chart `postgres` is not there yet, so the hook would wait on a
  database that only appears after the hook finishes. Splitting into
  `post-install` plus `pre-upgrade` hooks works but gives two code paths and two
  failure stories.
- An api initContainer gives one path for install and upgrade, mirrors compose
  (`api depends_on migrate: service_completed_successfully`), and fails visibly
  as `Init:Error` on the pod while the Deployment keeps the old pod only if
  the strategy allows it (see `Recreate` below, so a failed migration stops
  the rollout with the old pod already gone; accepted for the MVP).
- `prisma migrate deploy` takes an advisory lock, so a restart or a future
  second replica cannot interleave migrations. Re-running is a no-op when no
  migration is pending, which is the common pod-restart case.
- The init container uses the `migrator` build target and connects directly to
  `postgres:5432` (DDL needs a session; pgbouncer is transaction mode).
  Postgres not yet ready makes the init container exit non-zero and kubelet
  retries with backoff; no custom wait loop.
- Failed rollout with a migration already applied: unchanged from compose
  (`docs/operations.md` Rollback): the database is not rolled back by
  `helm rollback`. Migrations stay additive/forward-only.

### 1.2 Edge: keep Caddy behind the Ingress

Options considered:

| Option                                     | Header contract                                                                               | Routes                                             | Client IP for `trust proxy: 1` | Cost                                       |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------ | ------------------------------------------ |
| A. Ingress only (annotations)              | `add_header` needs controller snippets, which many clusters disable; controller unknown       | Second route table next to the Caddyfile (drift)   | One hop (good)                 | Header contract untested; two route tables |
| B. Headers in the app (`proxy.ts`, Helmet) | Moves CSP into app code; contradicts `prod-security-hardening` ("only CSP layer is the edge") | Still two tables                                   | One hop                        | New product code and spec rewrite          |
| **C. Ingress -> Caddy (chosen)**           | Unchanged, already specified and tested                                                       | One table: the Caddyfile used by compose and chart | Needs the fix below            | One extra small pod                        |

Chosen: C. Compose keeps working with the same file, so the header and route
contract has one source. The cost is client-IP handling, and the existing
Caddyfile gets it wrong behind a proxy: it overwrites
`X-Forwarded-For {remote_host}`, which would be the Ingress pod address, so
every user shares one rate-limit bucket. Fix (Task 2):

- Caddy global option `servers { trusted_proxies static ... }` fed from
  `CADDY_TRUSTED_PROXIES` (chart value `edge.trustedProxies`, required; compose
  gets the unset behaviour, which trusts nobody).
- `header_up X-Forwarded-For {client_ip}` replaces `{remote_host}`. With no
  trusted proxy `{client_ip}` equals the peer address, so compose behaviour is
  unchanged. Behind the Ingress, `{client_ip}` walks `X-Forwarded-For` from the
  right past trusted proxies, so private-range intranet clients are still
  resolved correctly (the trust list names proxies, not client ranges).
  The api then sees one `X-Forwarded-For` entry and `trust proxy: 1` stays right.
- Site address `http://:8080` and `auto_https off` in the chart; compose keeps
  its public site address. The ACME `email` global must not break the chart
  mode; Task 2 verifies `caddy validate` for both modes.
- `X-Forwarded-Proto` stays `{scheme}`: the app does not read it (cookie
  `secure` follows `NODE_ENV`). It reports `http` behind the Ingress; recorded
  as a known cosmetic difference.
- The Caddyfile moves to `deploy/helm/weeklyreport/files/Caddyfile` because
  Helm `.Files` cannot read outside the chart directory. Compose mounts it
  from there. One file, no copy step.
- `/metrics` stays unreachable: the Caddyfile returns 404 and the Ingress has
  one rule (`/` to `edge`), so nothing else can reach `api:3001/metrics`
  from outside. In-cluster scrapers reach `api:3001/metrics` directly; the
  NetworkPolicy admits the monitoring namespace (value `networkPolicy.monitoringNamespace`).
- Ingress class, host, TLS secret name, and controller annotations
  (`proxy-read-timeout` 300 to match Caddy's 5 minute transport) are values;
  the chart does not assume ingress-nginx.

DevOps question that changes this: whether the Ingress is the only hop before
the edge (external load balancer adds X-Forwarded-For or PROXY protocol?).

## 2. Gotenberg and the print origin

`pdf-renderer-service` already scopes the cookie to the print origin host and
the allow-list to the same origin, so an internal origin is allowed by spec.
Choice: `PDF_BASE_URL=http://web.<namespace>.svc.cluster.local:3000`, rendered
from release namespace, and `CHROMIUM_ALLOW_LIST` rendered from the same
value with dots escaped, so the two cannot diverge (compose has two operator
inputs that must be kept equal by hand).

- FQDN rather than single-label `web`: the compose probe proved a single-label
  Docker DNS name, not a Kubernetes search-domain lookup from a Chromium
  process. The cluster domain suffix is a value (`clusterDomain`, required;
  DevOps knows it).
- Hairpin removed: Gotenberg no longer goes out through the public Ingress
  and back in, so it needs no external DNS, no corporate TLS trust, and no
  egress to the public address.
- `CHROMIUM_DENY_PRIVATE_IPS=true` stays. The spec scenario "allow-list admits
  the print origin despite the IP-class denies" must now be proven for a
  cluster pod IP, which is a private address. This is the one real risk of the
  change and is verified in Task 8 (print `web` public page returns a PDF;
  a non-allowed in-cluster URL such as `http://api:3001/health` returns 403).
  If the allow-list does not override the private-IP deny for a pod IP, the
  fallback is the public print origin (hairpin) and an egress rule, decided in
  Task 8, not guessed now.
- The print page is served by web without the Caddy headers. The print route
  is a render input, not a browser surface, so this is accepted; Task 8
  confirms the page still reaches `data-print-state="ready"` for the public page.
- NetworkPolicy: `gotenberg` ingress only from api pods; egress only to web
  pods on 3000 and to cluster DNS. This duplicates the Chromium allow-list at
  the network layer. Enforcement depends on the CNI (DevOps question).
- The authenticated export (`/print/{id}` with the job token) cannot be proven
  without a signed session; see section 7.

## 3. Configuration and secrets

- `values.schema.json` marks every compose `${VAR:?}` input required, with
  types, `additionalProperties: false`, and the DB identity pattern. A value
  missing at `helm template/install/lint` fails the render, replacing
  `${VAR:?}`. Infrastructure toggles (replicas, probe timings, security contexts)
  have defaults in `values.yaml`; product configuration has none (AGENTS.md
  "Product configuration fails closed").
- Secrets: `secrets.existingSecret` (name of a Secret created by DevOps via
  their own tooling) is the primary path. `secrets.create=true` plus
  `secrets.values.*` renders a Secret for clusters without such tooling; values
  come from masked CI variables or `--set-file`, never from a committed file.
  Exactly one of the two must be chosen, else the render fails. The secret keys are
  documented in `docs/kubernetes.md` and checked by the test.
  Secret keys: `DB_PASSWORD`, `AUTH_JWT_SECRET`, `PDF_EXPORT_JWT_SECRET`,
  `AI_PROVIDER_CONFIG_ENCRYPTION_KEY`, optional `SMTP_USER`, `SMTP_PASS`,
  `SENTRY_DSN`. The SAML certificate is public key material and rides in
  the ConfigMap; this is a judgement call listed for review.
- `DATABASE_URL` is assembled in the pod with Kubernetes dependent-variable
  expansion `$(DB_PASSWORD)`, so the password never appears in a ConfigMap or
  in a rendered manifest.
- `AUTH_DEV_MODE` is a literal `"false"` in the template, not a value; the
  chart has no way to switch dev login on. `NODE_ENV=production` literal.
- A committed `values.production.example.yaml` lists names with empty
  required values (mirror of `production.env.example`). The real values file
  and secrets live outside Git (GitLab file-type variable, or DevOps).
- Rotation: changing a Secret does not restart pods. Docs say
  `kubectl rollout restart`. A checksum annotation is added only for
  chart-rendered Secrets and ConfigMaps.
- `AI_PROVIDER_CONFIG_ENCRYPTION_KEY` must not rotate while encrypted
  credentials exist (existing operations rule); the chart doc repeats it.

NEXT_PUBLIC_* values are compiled into the web image (`Dockerfile.web`
refuses to build without the required ones). The image-build job reads them from CI
variables (`WR_NEXT_PUBLIC_*`, plus `NEXT_PUBLIC_SENTRY_DSN`), passes them as
build args, and fails loudly when a required one is missing. The image tag is
the Git SHA. One environment is supported (production); a second
environment with different values would need a tag suffix and is out of scope.
`API_URL` is the literal `http://api:3001` in the build job, as in compose.
`NEXT_PUBLIC_AUTH_STUB` and `NEXT_PUBLIC_DEV_ROLE_SWITCHER` are passed as `false`.

## 4. Resources, probes, security contexts

Limits mirror compose memory limits. CPU requests are small placeholders and
no CPU limits are set (compose sets none; limits cause throttling). None of
this is measured; it is a starting point.

| Workload                    | Memory request / limit | Notes                                                                                                                                                                      |
| --------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| api                         | 512Mi / 2Gi            | `HEAP_HEALTH_THRESHOLD_BYTES` is required input (about 75% of limit, 1610612736 for 2Gi); a schema `x-` comment, not a computed default, because the owner sets the policy |
| web                         | 128Mi / 512Mi          |                                                                                                                                                                            |
| gotenberg                   | 512Mi / 1Gi            |                                                                                                                                                                            |
| postgres                    | 256Mi / 512Mi          |                                                                                                                                                                            |
| pgbouncer                   | 32Mi / 128Mi           |                                                                                                                                                                            |
| redis                       | 64Mi / 256Mi           | maxmemory 200mb, noeviction                                                                                                                                                |
| edge (Caddy)                | 32Mi / 256Mi           |                                                                                                                                                                            |
| backup (job)                | 64Mi / 256Mi           |                                                                                                                                                                            |
| api initContainer `migrate` | 128Mi / 512Mi          | compose leaves it unlimited; value unmeasured                                                                                                                              |

Probes (compose healthchecks reinterpreted, because "unhealthy" in Docker is a
label, while a failing Kubernetes liveness probe kills the pod):

- api: `startupProbe` and `readinessProbe` on `/health/ready` (startup budget
  60s mirrors `start_period`), `livenessProbe` on `/health/live`. Liveness on
  `/health/ready` would restart every api pod during a database outage.
- web: readiness `GET /` (compose check), liveness `tcpSocket` 3000, since `/`
  fetches the api and would restart web during an api outage.
- gotenberg: `GET /health` on 3000 for readiness and liveness.
- postgres: exec `pg_isready`. pgbouncer: exec `SELECT 1` through the pooler.
  redis: exec `redis-cli ping`. edge: exec `wget` on `127.0.0.1:2019/config/`
  (as compose; kubelet httpGet cannot reach a pod-local admin socket).
- api `terminationGracePeriodSeconds: 20` (documented shutdown budget).

Security contexts: compose does not set `read_only`, `cap_drop`, or
`no-new-privileges`, so these are additions, not a mirror, and each one must be
verified on OrbStack (Task 8) or left off with the reason recorded.

- All pods: `seccompProfile: RuntimeDefault`, `allowPrivilegeEscalation: false`,
  `capabilities.drop: [ALL]`, `runAsNonRoot: true` with explicit numeric
  `runAsUser` (api 1000 `node`, web 1001 `nextjs`, postgres 999, redis 999,
  caddy 65532 via values, gotenberg 1001). `USER node` is a name, so Kubernetes
  cannot verify non-root without a number.
- `fsGroup` set where a PVC is mounted (api 1000 for `pdfdata`, postgres 999).
- `readOnlyRootFilesystem: true` is attempted for api, web (with emptyDir for
  `/tmp` and `.next/cache`), pgbouncer, and edge; kept off for postgres, redis,
  gotenberg (Chromium needs a writable profile directory) unless verified.
- `automountServiceAccountToken: false` everywhere (no pod calls the Kubernetes API).

## 5. Volumes and scheduling

| Compose volume               | Kubernetes                 | Constraint                                                                                                      |
| ---------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `pgdata`                     | StatefulSet PVC            | RWO, size and storageClass required values                                                                      |
| `pgbackups`                  | PVC mounted by the CronJob | RWO. Same-cluster storage is not off-cluster backup; replication stays a DevOps decision (documented as before) |
| `redisdata`                  | StatefulSet PVC            | AOF as in compose                                                                                               |
| `pdfdata`                    | PVC mounted by the api pod | RWO                                                                                                             |
| `caddy_data`, `caddy_config` | emptyDir                   | no ACME in chart mode                                                                                           |

- `pdfdata` is read by the api `/pdfs` handler and written by the BullMQ worker
  in the same process. RWO means one node at a time, so the api runs **one
  replica with strategy `Recreate`** (a rolling update would start a second pod
  against an RWO volume, which fails on another node). Cost: a short api outage
  during rollout (initContainers plus the 60s startup budget). Scaling the api
  later needs RWX storage or moving PDFs off disk; out of scope.
- Backup: `backup-loop.sh` gains a one-shot mode (`BACKUP_RUN_ONCE=true`: one
  dump, prune, exit with the dump's status; `BACKUP_INTERVAL_SECONDS` not
  required in that mode). CronJob `schedule` and `BACKUP_RETENTION_DAYS` are
  required values (no default recovery policy, as before),
  `concurrencyPolicy: Forbid`, `startingDeadlineSeconds`, history limits 3/3.
  The compose staleness health check has no CronJob equivalent; the substitute is
  alerting on CronJob last-success age (needs kube-state-metrics; DevOps
  question). `restore.sh` is run as a one-off Job/`kubectl run` from the same
  image with its existing consent guards; the drill is documented, not automated.

## 6. Observability

Minimal. The api pod carries optional `prometheus.io/scrape|port|path`
annotations (`observability.scrapeAnnotations`, default off). No ServiceMonitor,
Grafana, Prometheus, or LGTM subchart: the cluster owns monitoring.
`deploy/grafana/**` and `deploy/alert-rules.yml` stay as importable artefacts,
unverified against cluster label names. The cluster needs: a scraper that reaches
`api:3001/metrics` over the Pod network, kube-state-metrics (CronJob and restart
alerts), an OTLP endpoint only if `OTEL_EXPORTER_OTLP_ENDPOINT` is set, and
log collection from stdout (everything already logs JSON to stdout).

## 7. Image build (GitLab CI, no Docker-in-Docker)

Facts (checked 2026-10-01): the project has container_registry disabled, shared
runners disabled, one project runner `cp-test-runner` (docker executor,
privileges unknown). The registry is therefore a CI variable, never `$CI_REGISTRY`.

Builder candidates:

| Candidate                                                                                | Status                                                                 | Fit                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kaniko (`GoogleContainerTools`)                                                          | Archived June 2025                                                     | Excluded                                                                                                                                                                                                                    |
| Kaniko forks (`chainguard-forks/kaniko`, `osscontainertools/kaniko`, v1.28.5 2026-09-20) | Maintained                                                             | **Cannot build `Dockerfile.api` unchanged**: its README states cross-stage `RUN --mount=type=bind,from=<stage>` is not supported, and `Dockerfile.api` uses it in `prod-deps`. `--mount=type=cache` support is unconfirmed. |
| Buildah                                                                                  | Maintained                                                             | Needs user-namespace and storage setup (vfs or fuse-overlayfs) that is also unknown on this runner; no advantage over BuildKit for these Dockerfiles                                                                        |
| **BuildKit rootless (`moby/buildkit:v0.33.1-rootless`)**                                 | Maintained (v0.33.1 released 2026-09-30), upstream Dockerfile frontend | Builds both Dockerfiles unchanged (cache mounts, stage mounts, `--chown`)                                                                                                                                                   |

Pick: rootless BuildKit in daemonless mode (`buildctl-daemonless.sh`), image
`moby/buildkit:v0.33.1-rootless@sha256:f8a833b2de9d68e27f0815e4a737abdfaf8a2e4c615650557df11025101557b4`
(manifest-list digest read from Docker Hub 2026-10-01; re-read at implementation).
It does not need a Docker daemon or a privileged container, but BuildKit's own
documentation requires, on a Docker host, `seccomp=unconfined`,
`apparmor=unconfined`, and `systempaths=unconfined`, or
`--oci-worker-no-process-sandbox` (which upstream discourages). A GitLab docker
executor cannot set these per job; they are runner `config.toml` settings.
Whether `cp-test-runner` allows them is **unknown** and is question 1 to DevOps.
Task 5 starts with a manual probe job that only runs `buildctl-daemonless.sh --help`
and a trivial rootless build, so the privilege question is answered before the
real job is written.

Fallbacks, in order, if the probe fails: (1) ask DevOps for a runner with the
security options; (2) Kaniko fork plus a one-line Dockerfile change of the
`--mount=from=builder` step to `COPY --from`, only after confirming the other
`--mount=type=cache` lines are honoured or harmless; (3) build on the owner
workstation and push (not CI; recorded as a manual exception).

Job rules (fail closed, never red on merge requests):

- Runs on default-branch pushes and tags; manual (`allow_failure: true`) on merge requests.
- First script line `: "${IMAGE_REGISTRY:?IMAGE_REGISTRY is not set}"`, likewise
  `IMAGE_REGISTRY_USER`, `IMAGE_REGISTRY_PASSWORD` (masked), and every `WR_NEXT_PUBLIC_*`
  required by `Dockerfile.web`. Registry credentials become a `config.json` in a
  job-local directory; never echoed.
- Builds and pushes `api`, `migrate` (api `--target migrator`), `web`, `backup`,
  each tagged with `$CI_COMMIT_SHA`, and records the pushed digest in a job
  artifact. The chart pins by `images.tag` (SHA); digest pinning of deployments
  is a follow-up (the `External first-production prerequisites` list keeps
  "immutable digest, SBOM, provenance" BLOCKED).
- Resource group shared with the heavy lanes.

Deployment (CD): documented command in `docs/kubernetes.md`:

```
helm upgrade --install weeklyreport deploy/helm/weeklyreport -n <ns> \
  -f "$HELM_VALUES_FILE" --set images.tag="$CI_COMMIT_SHA" --atomic --wait --timeout 10m
```

plus an optional `deploy-production` job: `when: manual`, default branch only,
defined only when `KUBECONFIG` (file-type variable) is set, pinned `helm` image,
`environment: production`. No Argo CD, no cluster credentials in the repo.
`--atomic` rolls the release back on failure; it cannot undo a migration.

## 8. Verification plan (OrbStack)

Context `orbstack`, helm 4.3.0, kubeconform to be installed, namespace
`wr-k8s-accept` (dedicated, deleted at the end). Memory discipline: at most
two heavy jobs at once (image builds one at a time; `kubectl` and `helm` are light).

1. Static: `helm lint` and `helm template` with the test values fixture; `kubeconform -strict`
   against the Kubernetes version of the OrbStack cluster; negative renders
   (drop each required key, set both or neither secret source, bad DB name) must fail.
2. Build images locally with Docker (shared image store, `imagePullPolicy: IfNotPresent`,
   tag `local`); no registry. This exercises the Dockerfiles, not the CI builder.
3. Install with dummy non-secret values in a scratch file kept outside the repository.
   Dev login does not exist in this chart, so there is no sign-in shortcut.
4. Prove (each with the observed output recorded):
   - all pods Ready, `migrate` initContainer completed, tables exist in `postgres`;
   - `GET /health/ready` 200 through `edge` via `kubectl port-forward`;
   - `/` carries the security-header floor, `/metrics` is 404, `/trpc/*` reaches the api,
     `/api/revalidate-org` reaches web, `Server` header absent;
   - client-IP: send a request with a forged `X-Forwarded-For` through the edge
     with `trustedProxies` set to the port-forward source, and read the api access log;
   - `helm upgrade` with the same tag: migrate is a no-op, Recreate works, data survives;
   - postgres and redis pod deletion: data and AOF survive on the PVC;
   - Gotenberg: converting the web public page through the internal origin returns a PDF;
     a non-allowed URL returns 403 (section 2 risk);
   - `kubectl create job --from=cronjob/backup`: a dump appears on the PVC and
     `pg_restore --list` reads it;
   - config-guard initContainer rejects a reserved-character password supplied via `existingSecret`.
5. NOT VERIFIED (stay marked in the delivery report):
   - authenticated flows and SAML (no identity provider in the namespace);
   - authenticated PDF export end to end: it needs a signed session for an existing
     user row. Minting a cookie with the local `AUTH_JWT_SECRET` is possible but needs
     a seeded user, and the guarded seed refuses a non-loopback target. Owner decision
     required before inserting any row; until then it is NOT VERIFIED;
   - the real Ingress controller, TLS, client IP behind a real load balancer;
   - NetworkPolicy enforcement (OrbStack CNI may not enforce);
   - BuildKit on `cp-test-runner`, push to the real registry;
   - multi-node RWO attach, storage class behaviour, real resource sizing.

Database safety: the namespace database is created by the chart and is not one of
the guard-approved disposable targets, so no repository reset, seed, or guard script
runs against it. Only chart-driven `migrate deploy` and read-only queries.

## 9. What happens to `docker-compose.prod.yml`

Keep it. Reasons: it is the tested reference (1585 lines of gate plus eight
specs name it); the chart is not yet exercised on the real cluster; deleting it
would remove the only fully proven rollback path and force a rewrite of the gate
in the same change. The two-sources-of-truth risk is handled mechanically, not by
convention:

- the Caddyfile is one shared file;
- a parity test compares the chart's rendered api/web/gotenberg/backup environment key
  sets, `CHROMIUM_*` values, image references and digests, and secret key list with
  compose and `production.env.example`; a key added to one side fails the gate;
- compose and the chart read the same image digests for third-party images.

Revisit deletion after the first production deployment on the cluster
(follow-up, recorded in tasks.md as an explicit non-goal now).

## 10. Repository gates

- `.prettierignore`: `deploy/helm/weeklyreport/templates/` (Go templates are not
  valid YAML). `values.yaml`, `values.schema.json`, `Chart.yaml` stay formatted.
- `.dockerignore`: `deploy/helm` (not needed in image contexts).
- `scripts/gates/operations/prod-compose-gate.test.ts`: the CI "no image build" negative
  lock becomes "image build only in the gated job"; `REVIEWED_EXTERNAL_IMAGES`
  gains the BuildKit image (and helm image if used); the Caddyfile path changes.
- `quality` job gets a pinned (sha256) `helm` and `kubeconform` download, following
  the existing `docker-compose` pattern, for the chart tests.
- `openspec/specs/README.md` gets the new capability line when the change is synced.
- `docs/kubernetes.md` is curated product documentation; indexed in `docs/README.md`.
- Path references (`deploy/caddy/Caddyfile`) in docs, specs, tests, compose, and the Caddy
  README are updated; `knip` and `lint:cleanliness` run after the move.

## Risks

- BuildKit cannot run on the runner (privileges) - probe first, fallbacks listed.
- Allow-list does not override private-IP deny for pod IPs - verified before commit to the internal origin.
- Caddy `{client_ip}` semantics differ from the assumption - verified with a forged-header request.
- Single api replica and Recreate mean short outages on every deploy - accepted MVP trade-off.
- Chart passing its own tests while the real Ingress/CNI behave differently - listed as NOT VERIFIED.
