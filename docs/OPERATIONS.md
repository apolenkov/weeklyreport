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

| Mode              | Command                                                                                                        | Uses                         | Notes                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------- | --------------------------------- |
| Host dev          | `pnpm dev`                                                                                                     | Host web/API + Docker infra  | Fastest edit loop                 |
| Full local Docker | `pnpm docker:local:verify`                                                                                     | Container web/API/infra      | Wipes and reseeds local Docker DB |
| API integration   | `pnpm --filter @customreport/api test:integration`                                                             | Real PostgreSQL              | Run with dedicated `DATABASE_URL` |
| Web integration   | `pnpm --filter @customreport/web test:e2e:integration`                                                         | Real API + real DB + browser | Requires `E2E_DATABASE_URL`       |
| Regression        | `pnpm --filter @customreport/web exec playwright test --config=e2e/regression/playwright.regression.config.ts` | Running app stack            | Role and workflow regression      |
| Prod Compose      | `docker compose -f docker-compose.prod.yml up -d --build`                                                      | Production-like stack        | Requires real secrets             |

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
  sh -lc 'createdb -U customreport customreport_e2e 2>/dev/null || true'
```

Apply schema:

```bash
DATABASE_URL=postgresql://customreport:localdev@localhost:5432/customreport_e2e \
  pnpm exec prisma migrate deploy
```

Run API integration:

```bash
DATABASE_URL=postgresql://customreport:localdev@localhost:5432/customreport_e2e \
  pnpm --filter @customreport/api test:integration
```

Expected current result:

```text
14 test files passed
55 tests passed
```

### 5.3 Web Integration

Use ports that do not conflict with the manual Docker UI:

```bash
E2E_DATABASE_URL=postgresql://customreport:localdev@localhost:5432/customreport_e2e \
E2E_API_PORT=3012 \
E2E_WEB_PORT=3015 \
  pnpm --filter @customreport/web test:e2e:integration
```

Expected current result:

```text
36 passed
9 skipped
```

The skipped tests are explicit feature-gated cases, not runtime failures.

### 5.4 Full Regression Against Running Stack

Run after `pnpm docker:local:verify` or any equivalent stack bring-up:

```bash
pnpm --filter @customreport/web exec playwright test \
  --config=e2e/regression/playwright.regression.config.ts
```

Latest verified result:

```text
179 passed
```

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
