# deploy-kubernetes-chart Specification

## Purpose

Defines the Helm chart that deploys WeeklyReport to Kubernetes: workloads, configuration and secrets, migration, backup, networking, and the rendering checks that guard them.

## Requirements

### Requirement: The chart fails closed on configuration

The Helm chart in `deploy/helm/weeklyreport/` MUST declare all required operator-owned production policy inputs as required keys in `values.schema.json`, MUST set `additionalProperties: false`, and MUST give required product configuration no default in `values.yaml`. Installing or templating with a required key absent MUST fail before any object is created. Chart-derived topology and runtime literals MUST NOT become independent operator inputs; runtime release identity MUST derive from the required image tag. Secret inputs MUST follow the chart's explicit Secret-source contract; public Web build arguments MUST remain required inputs of the CI image build.
The database name MUST match letters, digits, and underscores. When the
database password is supplied through values it MUST be checked at template
time against the URL-safe unreserved character set; when it comes from an
existing Secret the same check MUST be the first statement of the `migrate`
initContainer command, before any database connection.

#### Scenario: A required value is missing

- **WHEN** `helm template` runs with any one required key removed
- **THEN** rendering fails and names the key
- **AND** no manifest is emitted

#### Scenario: Password contains a URL-reserved character

- **WHEN** the database password contains a character outside `A-Za-z0-9._~-`
- **THEN** template rendering fails for a values-supplied password
- **AND** the `migrate` initContainer exits non-zero for an existing-Secret password without printing it

#### Scenario: Dev login cannot be enabled

- **WHEN** any values file is rendered
- **THEN** the api environment carries `AUTH_DEV_MODE=false` and `NODE_ENV=production` as literals
- **AND** no value key can change either

### Requirement: Service topology and names are fixed

The chart MUST create Services named exactly `api` (3001), `web` (3000),
`gotenberg` (3000), `postgres` (5432), `pgbouncer` (5432), `redis` (6379), and
`edge` (8080) without a release-name prefix, because the web image bakes
`http://api:3001`. The chart MUST support one release per namespace and MUST
document that constraint. PostgreSQL and Redis MUST be StatefulSets with a
PersistentVolumeClaim; the api MUST run one replica with strategy `Recreate`
while `pdfdata` is a ReadWriteOnce volume.

#### Scenario: Rendered Services

- **WHEN** the chart is rendered
- **THEN** the Service names and ports match the list above
- **AND** the api Deployment has `replicas: 1` and `strategy.type: Recreate`

### Requirement: Migrations run before the api serves, on install and upgrade

The chart MUST run `prisma migrate deploy` from the migrator image as an api
initContainer connected directly to `postgres:5432`, not through pgbouncer, and
MUST NOT implement migration as a Helm `pre-install` hook, because the in-chart
database does not exist at that point on first install. The api container MUST
NOT start until the initContainer has completed.

#### Scenario: First install

- **WHEN** the chart is installed into an empty namespace
- **THEN** the migrate initContainer retries until `postgres` accepts connections, applies all migrations, and completes
- **AND** the api container starts only afterwards

#### Scenario: Re-run with no pending migration

- **WHEN** the api pod restarts or `helm upgrade` runs with the same migrations
- **THEN** the initContainer completes without changing the schema

### Requirement: One edge carries the route and header contract

The Ingress MUST route all paths to Service `edge`, which runs Caddy over plain
HTTP with the canonical `deploy/helm/weeklyreport/files/Caddyfile`. The Caddyfile MUST keep the route
table, the enforcing security-header floor, and the `/metrics` 404. The chart
MUST NOT expose any other workload through the Ingress. The Caddyfile MUST
resolve the client address through a configured trusted-proxy list with
`trusted_proxies_strict` (right-to-left walk) and forward exactly one
`X-Forwarded-For` entry and one `X-Real-IP`, both equal to `{client_ip}`, so the
api's `trust proxy: 1` receives the real client. The trusted-proxy list MUST be
a required chart value.

#### Scenario: Public paths

- **WHEN** a request arrives through the Ingress for `/trpc/x`, `/`, or `/metrics`
- **THEN** `/trpc/x` reaches `api`, `/` reaches `web`, and `/metrics` returns 404
- **AND** responses carry the header floor of `deploy-caddy-config` and no `Server` header

#### Scenario: Client address behind the Ingress

- **GIVEN** the request's peer address is in the trusted-proxy list
- **WHEN** the request carries `X-Forwarded-For: 203.0.113.9`
- **THEN** the api receives `X-Forwarded-For: 203.0.113.9` as its only entry

#### Scenario: Forged forwarded address through a trusted peer

- **GIVEN** the peer is in the trusted-proxy list
- **WHEN** the request carries `X-Forwarded-For: 198.51.100.7, 203.0.113.9` and the right-most entry `203.0.113.9` is the real client appended by the trusted peer
- **THEN** the api receives `203.0.113.9`, not the forged left-most `198.51.100.7`

#### Scenario: Client address from an untrusted peer

- **WHEN** a peer outside the trusted list sends a forged `X-Forwarded-For`
- **THEN** the api receives the peer address, not the forged value

### Requirement: The renderer is internal and prints the internal web origin

The `gotenberg` workload MUST have no Ingress rule and no externally reachable
Service. The chart MUST render `PDF_BASE_URL` as the in-cluster FQDN origin of
Service `web` and MUST render `CHROMIUM_ALLOW_LIST` from the same value, so the
two cannot differ. The chart MUST keep `CHROMIUM_MAX_CONCURRENCY=1`,
`CHROMIUM_CLEAR_COOKIES=true`, `CHROMIUM_CLEAR_STORAGE=true`,
`CHROMIUM_CLEAR_CACHE=true`, `CHROMIUM_DENY_PRIVATE_IPS=true`,
`CHROMIUM_DENY_PUBLIC_IPS=true`, and `API_TIMEOUT=150s`. The cluster domain suffix MUST
default to `cluster.local` and be overridable.

#### Scenario: Print origin and allow-list agree

- **WHEN** the chart is rendered with any cluster domain and namespace
- **THEN** the allow-list is the anchored, dot-escaped form of the `PDF_BASE_URL` origin

#### Scenario: Renderer invariants are gate-enforced

- **WHEN** a change relaxes any `CHROMIUM_*` value in the chart
- **THEN** the chart gate fails

#### Scenario: Internal print origin reachable, others refused

- **WHEN** the renderer converts the public page of the internal web origin
- **THEN** it returns a PDF
- **AND** converting `http://api:3001/health` is refused with 403
- **AND** that print origin is admitted by the allow-list, which bypasses the IP-class denies for matching URLs

### Requirement: Secrets never enter the repository or a ConfigMap

The chart MUST accept secrets only through `secrets.existingSecret` or through
`secrets.create` with values supplied at install time, MUST fail when neither or
both are chosen, and MUST NOT carry a default for any secret key. An optional `images.pullSecret` MUST
name an existing Secret and render as `imagePullSecrets` on every pod; the chart
MUST NOT create registry credentials. The secret
keys are `DB_PASSWORD`, `AUTH_JWT_SECRET`, `PDF_EXPORT_JWT_SECRET`,
`AI_PROVIDER_CONFIG_ENCRYPTION_KEY`, and the optional `SMTP_USER`, `SMTP_PASS`,
and `SENTRY_DSN`. The assembled `DATABASE_URL` MUST be built in the pod from the
secret reference, and no rendered ConfigMap MUST contain a secret key.

#### Scenario: Secret source selection

- **WHEN** both `existingSecret` and `create` are set, or neither
- **THEN** rendering fails

#### Scenario: No secret in a rendered ConfigMap

- **WHEN** the chart is rendered with a secret-bearing values file
- **THEN** no ConfigMap data value equals any supplied secret value

### Requirement: Persistence, backup, and rollout match the stated constraints

PostgreSQL data MUST use a `PGDATA` subdirectory of its mount. Backups MUST run
as a CronJob with `concurrencyPolicy: Forbid`, a required schedule, and a
required retention in days, using the repository backup image and a one-shot
mode of `backup-loop.sh` that exits with the dump's status. The one-shot mode
MUST NOT require `BACKUP_INTERVAL_SECONDS`. The chart MUST NOT claim off-cluster
protection.

#### Scenario: One-shot backup

- **WHEN** the CronJob (or a manual job from it) runs
- **THEN** one `customreport-*.dump` is written atomically, older dumps beyond retention are pruned, and the job exits 0
- **AND** a failed `pg_dump` exits non-zero and leaves no restorable-looking partial file

#### Scenario: Standalone backup loop remains available

- **WHEN** `backup-loop.sh` runs without the one-shot variable
- **THEN** it loops at `BACKUP_INTERVAL_SECONDS` as before

### Requirement: Resources, probes, and security contexts are explicit

Every workload MUST set explicit memory requests and limits. Default memory limits MUST remain at the reviewed bounds: api 2Gi; migrate, web, and postgres 512Mi; gotenberg 1Gi; pgbouncer 128Mi; redis, edge, and backup 256Mi. Explicit operator resource overrides remain available through chart values. Every workload MUST set `automountServiceAccountToken: false`, `seccompProfile: RuntimeDefault`,
`allowPrivilegeEscalation: false`, dropped capabilities, and numeric `runAsUser`
with `runAsNonRoot`. The api MUST use `/health/live` for liveness and
`/health/ready` for readiness and startup. A read-only root filesystem MUST be
set only where it has been verified to run.

#### Scenario: Liveness does not depend on dependencies

- **WHEN** the database is unavailable
- **THEN** the api readiness probe fails and its liveness probe still passes

### Requirement: Observability is opt-in and ships no monitoring stack

The chart MUST NOT install a monitoring stack. It MUST offer `api.podAnnotations`, default empty. The public edge MUST NOT route `/metrics`.

#### Scenario: Default render

- **WHEN** the chart is rendered with default values
- **THEN** the api pod has no extra annotation and no monitoring object is emitted

### Requirement: Test-stand extension points are opt-in

The chart MUST offer `postgres.args`, default empty, passed to the postgres container as `args`, and `api.extraEnv`, default empty, rendered into the `api-config` ConfigMap after `api.env`. They exist so a test stand can enable server extensions and diagnostics from its own values file; the production example sets neither.

#### Scenario: Default and custom render

- **WHEN** the chart is rendered without `postgres.args`
- **THEN** the postgres container has no `args`
- **WHEN** `postgres.args` lists `-c` and `log_statement=all`
- **THEN** the postgres container carries exactly those args
- **WHEN** `api.extraEnv` has a key
- **THEN** `api-config` carries that key and nothing is added without it

### Requirement: Chart images are pinned and come from CI

Third-party images in `values.yaml` MUST use an explicit tag and `@sha256:`
digest from the reviewed external-image policy. Application images (`api`, `migrate`, `web`, `backup`) MUST be selected
by a required `images.tag` and registry value, MUST NOT use `latest`, and MUST be
the images built by the CI image job. The api `OTEL_SERVICE_VERSION` MUST be
derived from `images.tag`, not supplied separately.

#### Scenario: An unreviewed third-party image is introduced

- **WHEN** chart values select an unpinned, moving, or unreviewed third-party service image
- **THEN** the production image-policy gate fails

### Requirement: Chart behaviour is gate-enforced against independent production contracts

`pnpm test` MUST lint and render the production chart with fixture values and enforce the runtime environment contract, required inputs, reviewed images, private Services, explicit memory limits, security contexts, health probes, fixed `CHROMIUM_*` policy, and literal production auth flags. The API key coverage check MUST compare the rendered environment and chart schema against the runtime configuration contract, including reviewed generated and secret keys, without reading a production Compose file.

#### Scenario: A runtime input is omitted

- **WHEN** a required API runtime environment key has no chart-provided value, generated value, or Secret reference
- **THEN** the chart configuration gate fails and names the key

#### Scenario: A production constraint is weakened

- **WHEN** a rendered workload loses a required memory bound, probe, security context, or private network boundary
- **THEN** the production chart gate fails

#### Scenario: Untested claims stay marked

- **WHEN** the delivery report is written
- **THEN** authenticated flows, real Ingress behaviour, and the CI builder on the project runner are listed as NOT VERIFIED unless evidence exists

### Requirement: Helm is the sole production deployment and rollback path

The repository MUST offer production installation, upgrades, and rollback through `deploy/helm/weeklyreport/`, Helm values, and Kubernetes Secrets. Current production instructions and acceptance gates MUST NOT depend on a production Compose file or Compose environment template. Runbooks MUST describe Helm rollback separately from database restore.

#### Scenario: A production release is installed or rolled back

- **WHEN** an operator follows the current production runbook
- **THEN** installation and upgrades use Helm and compatible release rollback uses Helm release history
- **AND** database recovery retains its explicit target confirmation and destructive consent safeguards

#### Scenario: Development tooling is inspected

- **WHEN** the production deployment configuration is retired
- **THEN** development Compose and its local observability and error-tracking overlays remain available with their existing safety requirements
