# Operations Guide

This guide is the operator entry point for running CustomReport locally,
testing it, verifying Docker Compose, and preparing the same runtime shape for a
future Kubernetes migration.

## 1. Run Modes

```text
[Dev infra only] --> [Host web/api] --> [Fast local coding]
[Full Docker]    --> [Container web/api/infra] --> [Manual UAT + Docker gate]
[Test gates]     --> [Dedicated DB] --> [Unit/integration/regression evidence]
[Prod Compose]   --> [Migrate job] --> [Web/API behind Caddy]
[Kubernetes]     --> [Same images] --> [Job + Deployments + Services]
```

## 1.1 New Engineer Onboarding Path

Use this path when a new person needs a working product as quickly as
possible. It is intentionally Docker-first so the local shape matches the
future Kubernetes split: migrate job, API worker, web container, Postgres,
Redis, and Mailpit.

```text
[Install tools] --> [Copy .env] --> [docker:local:verify] --> [Open UI]
       |                |                 |                  |
       v                v                 v                  v
[Node/pnpm/Docker] [local secrets] [wipe+seed+health] [manual UAT]
```

Commands:

```bash
pnpm install
cp .env.example .env
pnpm docker:local:verify
open http://localhost:3000
open http://localhost:8025
```

Expected proof after the verifier:

| Check                                                           | Expected                                     |
| --------------------------------------------------------------- | -------------------------------------------- |
| `http://localhost:3000`                                         | web app responds                             |
| `http://localhost:3002/health/ready`                            | `200`                                        |
| `http://localhost:8025`                                         | Mailpit responds                             |
| `.planning/regression/evidence/docker-compose-local/verify.log` | contains compose status and `auth.me` output |

Do not stop the stack immediately after `pnpm docker:local:verify`; it leaves
the reseeded UI available so product owners can click through it manually.

| Mode              | Command                                                                                                        | Uses                         | Notes                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------- | --------------------------------- |
| Host dev          | `pnpm dev`                                                                                                     | Host web/API + Docker infra  | Fastest edit loop                 |
| Full local Docker | `pnpm docker:local:verify`                                                                                     | Container web/API/infra      | Wipes and reseeds local Docker DB |
| API integration   | `pnpm --filter @customreport/api test:integration`                                                             | Real PostgreSQL              | Run with dedicated `DATABASE_URL` |
| Web integration   | `pnpm --filter @customreport/web test:e2e:integration`                                                         | Real API + real DB + browser | Requires `E2E_DATABASE_URL`       |
| Regression        | `pnpm --filter @customreport/web exec playwright test --config=e2e/regression/playwright.regression.config.ts` | Running app stack            | Role and workflow regression      |
| Prod Compose      | `docker compose -f docker-compose.prod.yml up -d --build`                                                      | Production-like stack        | Requires real secrets             |
| Runtime doctor    | `make doctor`                                                                                                  | Codex/GSD config             | Uses `GSD_RUNTIME=codex`          |

## 2. Local Dev

Prerequisites:

- Node.js 20+
- pnpm 10+
- Docker Desktop with Compose V2

Start infrastructure only:

```bash
docker compose up -d postgres redis mailhog
pnpm exec prisma migrate deploy
pnpm exec prisma db seed
pnpm dev
```

Open:

| Service   | URL                                  |
| --------- | ------------------------------------ |
| Web       | `http://localhost:3000`              |
| API ready | `http://localhost:3002/health/ready` |
| Mailpit   | `http://localhost:8025`              |

Dev login examples:

```text
http://localhost:3000/auth/dev-login?role=head
http://localhost:3000/auth/dev-login?role=lead&email=lead1@customreport.local
http://localhost:3000/auth/dev-login?role=admin
http://localhost:3000/auth/dev-login?role=viewer
```

## 3. Full Local Docker

Use this when the user wants to click the product locally with the same
container topology that will later map to Kubernetes.

```bash
pnpm docker:local:verify
```

What it does:

```text
[Build images]
  --> [Start postgres/redis/mailpit/api/web]
  --> [Wait health]
  --> [Prisma reset inside api]
  --> [Seed advanced fixture]
  --> [Dev-login through web rewrite]
  --> [Authenticated tRPC auth.me check]
  --> [Write verify.log]
```

Evidence:

```text
.planning/regression/evidence/docker-compose-local/verify.log
```

Manual UAT after the verifier:

```bash
curl -I http://localhost:3000/
curl http://localhost:3002/health/ready
open http://localhost:3000
open http://localhost:8025
```

The verifier intentionally leaves the Docker stack running so a human can test
the UI after the reset and seed.

Stop the stack only when manual testing is finished:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
```

## 4. Wipe And Reseed

`prisma/_destructive-guard.ts` parses the target database from
`DATABASE_URL`. For any non-prod Docker or non-local host wiring, keep both
`POSTGRES_DB` and the database name inside `DATABASE_URL` explicitly suffixed
with `_uat`, `_dev`, or `_test`. If `DIRECT_URL` is present, keep it on the
same suffixed database.

Current naming split: local development, including the Docker verifier, uses
`customreport_dev`; API integration uses `customreport_test`; web integration
uses `customreport_e2e`; there is no active manual UAT/staging database now.
Reserve `customreport_uat` only if such an environment is explicitly created
later; production remains `customreport`.

Destructive local reset from the host:

```bash
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=да \
  pnpm exec prisma migrate reset --force
pnpm exec prisma db seed
```

Destructive reset inside the API container:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T api sh -lc \
  'cd /app && PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=да pnpm exec prisma migrate reset --force'
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T api sh -lc \
  'cd /app && pnpm exec prisma db seed'
```

Do not run integration tests against the normal dev database unless you intend
to destroy and reseed it. Use `customreport_e2e` for web integration and a
separate test database for API integration.

## 5. Test Gates

Gate rule: a historical pass count is not proof. The command output from the
current checkout and current database state is the source of truth.

### 5.1 Product-Ready Quick Gate

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm docker:local:verify
```

### 5.2 API Integration

Create the dedicated database once:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T postgres \
  sh -lc 'createdb -U customreport customreport_test 2>/dev/null || true'
```

Apply schema:

```bash
DATABASE_URL=postgresql://customreport:localdev@localhost:5432/customreport_test \
  pnpm exec prisma migrate deploy --schema=prisma/schema.prisma
```

Run API integration:

```bash
pnpm --filter @customreport/api test:integration
```

The API integration config loads .env.test, whose DATABASE_URL points at
customreport_test. Expected result: the command exits `0`; read the live
Vitest summary for the current test/file count.

### 5.3 Web Integration

Use ports that do not conflict with the manual Docker UI:

```bash
E2E_DATABASE_URL=postgresql://customreport:localdev@localhost:5432/customreport_e2e \
E2E_API_PORT=3012 \
E2E_WEB_PORT=3015 \
  pnpm --filter @customreport/web test:e2e:integration
```

Expected result: the command exits `0`; read the live Playwright summary for
the current passed/skipped/failed count. The integration suite should cover
desktop plus the mobile iOS/Android `@MOB-` projects.

### 5.4 Full Regression Against Running Stack

Run after `pnpm docker:local:verify` or any equivalent stack bring-up:

```bash
# High-signal smoke: role lifecycle + screenshots + browser network log
pnpm --filter @customreport/web exec playwright test \
  --config=e2e/regression/playwright.regression.config.ts \
  e2e/regression/product-ready-progressive.spec.ts

# Full regression directory
pnpm --filter @customreport/web exec playwright test \
  --config=e2e/regression/playwright.regression.config.ts
```

Evidence paths:

| Run                            | Evidence                                                        |
| ------------------------------ | --------------------------------------------------------------- |
| Docker verifier                | `.planning/regression/evidence/docker-compose-local/verify.log` |
| Product-ready progressive      | `.planning/regression/evidence/product-ready-progressive/`      |
| Dashboard post-publish smoke   | `.planning/regression/evidence/dashboard-post-publish-smoke/`   |
| Full regression traces/results | `.planning/regression/agent-c-test-results/`                    |

A release candidate should have no 5xx tRPC responses, no uncaught page
errors, and screenshots/logs for the role paths that were exercised.

### 5.5 Manual UAT Wipe

Use this when the local base configuration is correct and you want to start
manual testing from an empty reporting cycle.

```text
[users/products/stages/settings] --> [delete reports + stage assignments] --> [empty open report]
                                                        |
                                                        v
                                          [ownership-based product rows]
```

Preserved:

- users and roles
- products and lead ownership
- stages
- app settings
- global reminder rules without a report binding

Deleted:

- reports, sections, items, risks, decisions, priorities
- SDLC stage assignments
- PDF export jobs and generated-job rows
- reminder executions and report-bound reminder rules
- carry-over executions/records, reopen requests, version snapshots, AI insights
- local Redis queue/cache state, unless `MANUAL_UAT_WIPE_FLUSH_REDIS=false`

The script does not recreate product-status placeholders from product
ownership. After the wipe, lead reports are intentionally empty until an admin
assigns SDLC stages. This keeps product ownership separate from reporting
responsibility.

Run from host mode:

```bash
pnpm db:wipe:manual-uat
```

Run against the Docker API container:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T api \
  pnpm --dir apps/api exec tsx ../../prisma/wipe-manual-uat.ts
```

In the dev UI, use `DEV: switch role` -> `Data` ->
`Wipe reports (manual UAT)`.

### 5.6 Log Review

Use logs as a regression artifact, not only as ad-hoc debugging output.

```bash
# Recent API/web logs from the local Docker stack
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs --since=10m api web

# Error/warn stream from host-mode API
pnpm logs:errors

# Check failed BullMQ jobs via Admin UI
open http://localhost:3000/admin?tab=jobs
```

Known log signals to treat as regressions:

| Signal                                        | Meaning                                                         |
| --------------------------------------------- | --------------------------------------------------------------- |
| `weeklyReport.get` 5xx                        | Dashboard/report read model is broken                           |
| `leadForm.byPeriod` `Unexpected error`        | Missing-section/domain path is leaking as an internal error     |
| head/admin `/lead/report/<id>` with no author | Should redirect to `/head/report/<id>` without leadForm request |
| `No active report period found` after publish | Current/published period resolution regressed                   |
| `pdf-export job failed` with missing browser  | API image lacks Playwright Chromium or was not rebuilt          |
| repeated `DLQMonitorService` alerts           | Retry or clean old failed BullMQ jobs after root cause is fixed |

### 5.7 Observability

The local stack includes the same observability shape expected in production:

```text
[API /metrics] --> [Prometheus] --> [Grafana dashboard]
       |                |
       v                v
 [structured logs] [Postgres/Redis exporters]
```

Start it after the dev stack is up:

```bash
pnpm observability:up
```

Open:

| Surface     | URL                           |
| ----------- | ----------------------------- |
| Prometheus  | http://localhost:9090         |
| Grafana     | http://localhost:3003         |
| API metrics | http://localhost:3002/metrics |

Grafana default login is `admin` / `admin`. The dashboard is provisioned from
`deploy/grafana/customreport-dashboard.json`, and the datasource is provisioned
from `deploy/grafana/provisioning/datasources/prometheus.yml`.

Sanity check:

```bash
curl http://localhost:3002/metrics | grep http_request_duration_seconds
pnpm observability:logs
```

### 5.8 Domain-Model Regression Coverage

Regression scenarios should be derived from the domain model, not only from
screens that happened to break. Use this checklist when adding or reviewing
coverage:

```text
[Prisma models] --> [Shared Zod schemas] --> [Role/action matrix] --> [UI journeys]
        |                    |                    |                  |
        v                    v                    v                  v
[state transitions]  [input boundaries]  [authorization]   [screens/logs]
```

| Domain axis      | Must be covered by                       | Examples                                                                |
| ---------------- | ---------------------------------------- | ----------------------------------------------------------------------- |
| Entity/schema    | shared schema tests + API contract tests | `Report`, `ReportSection`, `Item`, `Risk`, `Decision`, `ReminderRule`   |
| State transition | service tests + integration tests        | `open -> published -> reopened`, draft save, submit, revoke, carry-over |
| Role/action      | router/middleware tests + E2E            | lead edits own section, head/admin read all, viewer sees published only |
| UI workflow      | Playwright regression + screenshots      | lead form, head dashboard, weekly report, archive, admin tabs           |
| Background job   | service tests + Docker log check         | PDF export, email reminders, BullMQ failed/retry states                 |
| Observability    | metrics + structured logs + evidence     | tRPC status, client page errors, Docker health, DLQ alerts, latency     |

Every new regression should answer four questions:

1. Which model/state/action does this protect?
2. Which role can perform it and which roles must be blocked?
3. Which automated test catches it before manual UAT?
4. Which log or screenshot proves the behavior during a run?

The dashboard-after-publish bug is the reference example: the missing state
was `no open/reopened period, latest period is published`. It is now covered
at repository level by `weekly-report.prisma-repository.test.ts` and at UI
smoke level by the dashboard post-publish evidence directory.

## 6. Production Compose

Use production Compose only with real secrets:

```bash
docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100 api
```

Required production environment:

```bash
DB_PASSWORD=<strong-random-password>
AUTH_JWT_SECRET=<min-32-character-random-secret>
PDF_EXPORT_JWT_SECRET=<min-16-character-random-secret>
FRONTEND_URL=https://reports.example.com
API_URL=http://api:3001
NEXT_PUBLIC_API_URL=http://api:3001
PDF_BASE_URL=http://web:3000
PDF_OUTPUT_DIR=/app/data/pdfs
SMTP_HOST=<smtp-host>
SMTP_PORT=587
SMTP_FROM=noreply@example.com
KEYCLOAK_SAML_CALLBACK_URL=https://reports.example.com/auth/saml/callback
KEYCLOAK_SAML_ENTRY_POINT=https://keycloak.example.com/realms/prod/protocol/saml
KEYCLOAK_SAML_ISSUER=customreport-prod
KEYCLOAK_SAML_CERT=<single-line-cert>
CADDY_SITE_ADDRESS=reports.example.com
```

Never enable these in production:

```bash
AUTH_DEV_MODE=true
NEXT_PUBLIC_AUTH_STUB=true
NEXT_PUBLIC_DEV_ROLE_SWITCHER=true
```

## 7. Kubernetes Porting Map

The current Docker shape is intentionally portable:

| Compose service | Kubernetes object              | Notes                                   |
| --------------- | ------------------------------ | --------------------------------------- |
| `migrate`       | `Job` or init container        | Uses `Dockerfile.api` target `migrator` |
| `api`           | `Deployment` + `Service`       | Mount `/app/data/pdfs`                  |
| `web`           | `Deployment` + `Service`       | Set `API_URL` to internal API service   |
| `postgres`      | Managed DB or `StatefulSet`    | Prefer managed PostgreSQL               |
| `redis`         | Managed Redis or `StatefulSet` | BullMQ requires durable Redis behavior  |
| `mailhog`       | Dev-only deployment            | Replace with real SMTP in prod          |
| `caddy`         | `Ingress` or Gateway           | Terminate TLS at cluster edge           |

Probe mapping:

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3001
readinessProbe:
  httpGet:
    path: /health/ready
    port: 3001
```

Minimum Kubernetes sequence:

```text
[Secret/ConfigMap]
  --> [Postgres/Redis]
  --> [Migrate Job]
  --> [API Deployment]
  --> [Web Deployment]
  --> [Ingress]
  --> [Readiness checks]
```

## 8. GSD Skills For This Project

Use Codex runtime for Codex sessions:

```text
[codex-proxy] --> [GSD_RUNTIME=codex] --> [GSD model routing] --> [make doctor]
```

Rules:

- Treat this project as `runtime: "codex"` in `.planning/config.json`.
- Start Codex sessions through `codex-proxy` so `GSD_RUNTIME=codex` is present.
- Apply the project GSD defaults with
  `GSD_RUNTIME=codex bash scripts/bootstrap-gsd-defaults.sh`.
- Do not edit `~/.codex/*` manually as the source of truth. Change managed
  sources in `/home/user/work/core-principles/`, then reinstall.
- Model routing:
  - heavy -> `gpt-5.5`
  - standard -> `gpt-5.3-codex`
  - light -> `gpt-5.4-mini`
- Verify the runtime with `make doctor`.

Use these skills when running the project process:

| Need                      | Skill                                    |
| ------------------------- | ---------------------------------------- |
| Resume context            | `gsd-resume-work`                        |
| Quick code/doc task       | `gsd-quick`                              |
| Debug failing tests       | `gsd-debug`                              |
| Update verified docs      | `gsd-docs-update`                        |
| Code review changed files | `gsd-code-review`                        |
| UI review screenshots     | `gsd-ui-review`                          |
| Validate phase/milestone  | `gsd-verify-work`, `gsd-audit-milestone` |
| Refresh code graph        | `gsd-graphify`                           |
| Close milestone           | `gsd-complete-milestone`                 |

For cheap parallel mechanical work, route simple subagents to the `haiku`
tier. In Codex-backed GSD config that tier should map to `gpt-5.4-mini`.
Good mini-model tasks:

- grep/inventory
- doc verification
- screenshot triage
- log summarization
- regression matrix status tables
- narrow config review

Keep implementation, security-sensitive fixes, and final arbitration in the
main agent unless the task has a very small, disjoint file scope.
