# Deployment Guide

Production deployment guide for **CustomReport** -- a weekly status-report
collection system built with Next.js 16, NestJS 11, PostgreSQL 15, and Redis 7.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Environment Variables](#2-environment-variables)
3. [Docker Compose Production](#3-docker-compose-production)
4. [Database Management](#4-database-management)
5. [Health Checks and Monitoring](#5-health-checks-and-monitoring)
6. [SSL/TLS and Reverse Proxy](#6-ssltls-and-reverse-proxy)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Prerequisites

| Component      | Minimum Version | Notes                                                |
| -------------- | --------------- | ---------------------------------------------------- |
| Docker         | 27.x            | Docker Engine with Compose V2 plugin                 |
| Docker Compose | 2.x             | Bundled with Docker Desktop or standalone plugin     |
| Node.js        | 20.x LTS        | Only needed for local/non-Docker builds              |
| pnpm           | 10.x            | Package manager (corepack-managed inside containers) |
| PostgreSQL     | 15+             | Provided via `postgres:15-alpine` container          |
| Redis          | 7+              | Provided via `redis:7-alpine` container              |
| Keycloak       | 26.x            | SAML IdP -- optional if using `AUTH_DEV_MODE=true`   |

**Disk space:** The API image is ~1.4 GB due to the bundled Playwright/Chromium
dependency required for server-side PDF generation. The web image is ~150 MB
(Node.js Alpine + Next.js standalone output).

---

## 2. Environment Variables

All API environment variables are validated at startup by Zod
(`apps/api/src/infrastructure/config/env.schema.ts`). The process exits
immediately if validation fails, so every required variable must be set before
the container starts.

### 2.1 Core

| Variable       | Required | Default                 | Description                                                                              |
| -------------- | -------- | ----------------------- | ---------------------------------------------------------------------------------------- |
| `DATABASE_URL` | Yes      | --                      | PostgreSQL connection string. Format: `postgresql://user:pass@host:5432/dbname`          |
| `DIRECT_URL`   | No       | --                      | Direct PostgreSQL URL (bypasses PgBouncer if configured). Used by Prisma for migrations. |
| `PORT`         | No       | `3001`                  | API server listen port inside the container.                                             |
| `NODE_ENV`     | No       | `development`           | Set to `production` for production deployments.                                          |
| `FRONTEND_URL` | No       | `http://localhost:3000` | Allowed CORS origin. Must match the URL where the web app is served.                     |
| `LOG_LEVEL`    | No       | `info`                  | Logging verbosity: `debug`, `info`, `warn`, `error`.                                     |
| `LOG_DIR`      | No       | --                      | Directory for file-based log output. Omit to log to stdout only.                         |

### 2.2 Authentication

| Variable          | Required    | Default | Description                                                                                 |
| ----------------- | ----------- | ------- | ------------------------------------------------------------------------------------------- |
| `AUTH_DEV_MODE`   | No          | `false` | Set to `true` to bypass SAML and use a stub login. **Never enable in production.**          |
| `AUTH_JWT_SECRET` | Conditional | --      | JWT signing secret. Minimum 32 characters. **Required** when `AUTH_DEV_MODE` is not `true`. |

### 2.3 SAML / Keycloak

These variables are required at runtime when `AUTH_DEV_MODE=false`. They are
validated by the SAML strategy module, not the Zod schema (to allow dev-mode
startup without Keycloak).

| Variable                     | Required          | Default | Description                                                                                |
| ---------------------------- | ----------------- | ------- | ------------------------------------------------------------------------------------------ |
| `KEYCLOAK_SAML_CALLBACK_URL` | When SAML enabled | --      | Callback URL registered in Keycloak (e.g. `https://api.example.com/auth/saml/callback`)    |
| `KEYCLOAK_SAML_ENTRY_POINT`  | When SAML enabled | --      | Keycloak SAML SSO endpoint (e.g. `https://keycloak.example.com/realms/prod/protocol/saml`) |
| `KEYCLOAK_SAML_ISSUER`       | When SAML enabled | --      | Service provider entity ID registered in Keycloak (e.g. `customreport-prod`)               |
| `KEYCLOAK_SAML_CERT`         | When SAML enabled | --      | Keycloak IdP X.509 signing certificate (PEM format, no headers)                            |

### 2.4 Redis

| Variable     | Required | Default     | Description                                                |
| ------------ | -------- | ----------- | ---------------------------------------------------------- |
| `REDIS_HOST` | No       | `localhost` | Redis hostname. Use `redis` inside Docker Compose network. |
| `REDIS_PORT` | No       | `6379`      | Redis port.                                                |

### 2.5 SMTP (Email Reminders)

All SMTP variables are optional. Email features are disabled when `SMTP_HOST` is
not set.

| Variable    | Required | Default               | Description                                         |
| ----------- | -------- | --------------------- | --------------------------------------------------- |
| `SMTP_HOST` | No       | --                    | SMTP server hostname.                               |
| `SMTP_PORT` | No       | `587`                 | SMTP port (587 for STARTTLS, 465 for implicit TLS). |
| `SMTP_USER` | No       | --                    | SMTP authentication username.                       |
| `SMTP_PASS` | No       | --                    | SMTP authentication password.                       |
| `SMTP_FROM` | No       | `noreply@example.com` | Sender address for outgoing emails.                 |

### 2.6 PDF Generation

| Variable         | Required | Default                 | Description                                                                                                                 |
| ---------------- | -------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `PDF_BASE_URL`   | No       | `http://localhost:3000` | Base URL the API uses to render report pages as PDF. In Docker Compose this should be `http://web:3000` (internal network). |
| `PDF_OUTPUT_DIR` | No       | `./storage/pdfs`        | Directory where generated PDF files are written. In Docker/Kubernetes mount this at `/app/data/pdfs`.                       |

### 2.7 Frontend (Web App)

These variables are set on the `web` service, not the API.

| Variable                        | Required | Default                 | Description                                                                                                                                           |
| ------------------------------- | -------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `API_URL`                       | No       | --                      | Server-side API URL for Next.js SSR/session calls. In Docker/Kubernetes use the internal service URL (`http://api:3001` or `http://api:3002` in dev). |
| `NEXT_PUBLIC_API_URL`           | No       | `http://localhost:3001` | Public URL of the API for browser-side tRPC calls.                                                                                                    |
| `NEXT_PUBLIC_AUTH_STUB`         | No       | --                      | Set to `true` to show the dev login stub in the UI.                                                                                                   |
| `NEXT_PUBLIC_DEV_ROLE_SWITCHER` | No       | `false`                 | Set to `true` in local/dev Compose only to expose the floating role switcher and reseed actions.                                                      |

### 2.8 Docker Compose Variables

These variables are used by the Compose files themselves (not passed to
application code).

| Variable              | Required   | Default                 | Description                                                                                                |
| --------------------- | ---------- | ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| `DB_PASSWORD`         | Yes (prod) | `localdev` (dev)        | PostgreSQL password. The production Compose file fails if not set.                                         |
| `AUTH_JWT_SECRET`     | Yes (prod) | --                      | Also injected into the `api` service (see 2.2).                                                            |
| `FRONTEND_URL`        | No         | `http://localhost:3000` | Passed to the `api` service for CORS.                                                                      |
| `NEXT_PUBLIC_API_URL` | No         | `http://localhost:3001` | Passed to the `web` service.                                                                               |
| `API_PORT`            | No         | `3001`                  | Host port mapped to the API container.                                                                     |
| `WEB_PORT`            | No         | `3000`                  | Host port mapped to the web container.                                                                     |
| `SMTP_HOST`           | No         | --                      | Forwarded to API service.                                                                                  |
| `SMTP_PORT`           | No         | `587`                   | Forwarded to API service.                                                                                  |
| `SMTP_FROM`           | No         | `noreply@example.com`   | Forwarded to API service.                                                                                  |
| `CADDY_SITE_ADDRESS`  | Yes (prod) | --                      | Public site address for the bundled Caddy reverse proxy, e.g. `reports.example.com` or `http://localhost`. |

---

## 3. Docker Compose Production

### 3.1 Architecture

The production stack consists of five services:

```
                    +-------------------+
                    |   Reverse Proxy   |  (nginx / Caddy -- external)
                    |  :80 / :443       |
                    +--------+----------+
                             |
               +-------------+-------------+
               |                           |
        +------v------+           +--------v-------+
        |     web     |           |      api       |
        | Next.js 16  |           |   NestJS 11    |
        | :3000       |           |   :3001        |
        +------+------+           +---+------+-----+
               |                      |      |
               |              +-------+  +---+--------+
               |              |          |             |
          +----v----+   +-----v----+ +---v-----------+
          | (reads  |   | postgres | | redis          |
          |  API    |   | :5432    | | :6379          |
          |  via    |   +----------+ +----------------+
          | network)|
          +---------+
```

### 3.2 Quick Start

```bash
# 1. Clone the repository
git clone <repo-url> customreport
cd customreport

# 2. Create a .env file with production secrets
cat > .env << 'EOF'
DB_PASSWORD=<strong-random-password>
AUTH_JWT_SECRET=<min-32-character-random-secret>
PDF_EXPORT_JWT_SECRET=<min-16-character-random-secret>
FRONTEND_URL=https://reports.example.com
API_URL=http://api:3001
NEXT_PUBLIC_API_URL=http://api:3001
PDF_BASE_URL=http://web:3000
SMTP_HOST=<smtp-host>
SMTP_PORT=587
SMTP_FROM=noreply@example.com
KEYCLOAK_SAML_CALLBACK_URL=https://reports.example.com/auth/saml/callback
KEYCLOAK_SAML_ENTRY_POINT=https://keycloak.example.com/realms/prod/protocol/saml
KEYCLOAK_SAML_ISSUER=customreport-prod
KEYCLOAK_SAML_CERT=<base64-or-single-line-cert>
CADDY_SITE_ADDRESS=reports.example.com
EOF

# 3. Build and start all services
docker compose -f docker-compose.prod.yml up -d --build

# 4. Verify all services are healthy
docker compose -f docker-compose.prod.yml ps
```

### 3.3 Service Details

**postgres** -- PostgreSQL 15 Alpine with persistent volume.

- Data stored in the `pgdata` named volume.
- Memory limit: 512 MB.
- Health check: `pg_isready` every 10s.
- No host port exposed in production (internal network only).

**redis** -- Redis 7 Alpine with AOF persistence.

- Data stored in the `redisdata` named volume.
- `maxmemory-policy: noeviction` -- BullMQ requires this to prevent job data loss.
- Memory limit: 256 MB.
- Health check: `redis-cli ping` every 10s.
- No host port exposed in production (internal network only).

**migrate** -- One-shot container that runs `prisma migrate deploy`.

- Runs after postgres is healthy, before the API starts.
- Exits after migration completes (`restart: no`).
- Uses the same API Docker image.

**api** -- NestJS 11 backend with Playwright for PDF generation.

- Memory limit: 2 GB (Chromium requires ~1 GB for PDF rendering).
- Health check: `wget` against `/health/live` every 15s.
- PDF files stored in the `pdfdata` named volume at `/app/data/pdfs`.
- Start period: 30s (allows Prisma client and Playwright to initialize).

**web** -- Next.js 16 standalone server.

- Memory limit: 512 MB.
- Health check: `wget` against `/` every 15s.
- Start period: 20s.

### 3.4 Volumes

| Volume      | Mounted In | Path                       | Purpose                    |
| ----------- | ---------- | -------------------------- | -------------------------- |
| `pgdata`    | postgres   | `/var/lib/postgresql/data` | Database files             |
| `redisdata` | redis      | `/data`                    | Redis AOF + RDB snapshots  |
| `pdfdata`   | api        | `/app/data/pdfs`           | Generated PDF export files |

### 3.5 Logging

All services use the `json-file` Docker logging driver with rotation:

| Service  | Max Size | Max Files |
| -------- | -------- | --------- |
| postgres | 10 MB    | 3         |
| redis    | 10 MB    | 3         |
| migrate  | 5 MB     | 1         |
| api      | 20 MB    | 5         |
| web      | 20 MB    | 5         |

View logs:

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Single service
docker compose -f docker-compose.prod.yml logs -f api

# Last 100 lines
docker compose -f docker-compose.prod.yml logs --tail=100 api
```

### 3.6 Development Mode

For local development with hot-reload:

```bash
# Uses docker-compose.yml (base) + docker-compose.dev.yml (override)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

The dev override:

- Builds from the `installer` stage (includes dev dependencies).
- Mounts source directories for hot-reload (`apps/api/src`, `apps/web/src`, etc.).
- Runs `node --watch` for the API and `pnpm dev` for the web app.
- Enables `AUTH_DEV_MODE=true` and `LOG_LEVEL=debug`.

---

## 4. Database Management

### 4.1 Initial Setup

Migrations run automatically via the `migrate` service on `docker compose up`.
For manual control:

```bash
# Run pending migrations
docker compose -f docker-compose.prod.yml run --rm migrate

# Or exec into the API container
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
```

### 4.2 Creating New Migrations (Development)

```bash
# Generate a migration from schema changes
pnpm exec prisma migrate dev --name descriptive_name

# Apply without generating (deploy existing migrations)
pnpm exec prisma migrate deploy
```

### 4.3 Seed Data

```bash
# Run from host (if Node.js installed)
pnpm exec prisma db seed

# Run inside the API container
docker compose -f docker-compose.prod.yml exec api npx prisma db seed
```

### 4.4 Backup

**Automated pg_dump script:**

```bash
#!/usr/bin/env bash
# backup-db.sh -- Run via cron or manually
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/customreport"
mkdir -p "$BACKUP_DIR"

# Dump from the running postgres container
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U customreport -Fc customreport \
  > "${BACKUP_DIR}/customreport_${TIMESTAMP}.dump"

# Keep last 30 days
find "$BACKUP_DIR" -name "*.dump" -mtime +30 -delete

echo "Backup complete: customreport_${TIMESTAMP}.dump"
```

**Cron example (daily at 02:00):**

```cron
0 2 * * * /opt/customreport/backup-db.sh >> /var/log/customreport-backup.log 2>&1
```

### 4.5 Restore

```bash
# Stop the API to prevent writes during restore
docker compose -f docker-compose.prod.yml stop api web

# Restore from a dump file
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U customreport -d customreport --clean --if-exists \
  < /backups/customreport/customreport_20260424_020000.dump

# Restart services
docker compose -f docker-compose.prod.yml up -d api web
```

### 4.6 Rollback

Prisma tracks migrations in the `_prisma_migrations` table. To roll back:

```bash
# 1. Check current migration state
docker compose -f docker-compose.prod.yml exec api \
  npx prisma migrate status

# 2. If a migration failed, mark it as rolled back
docker compose -f docker-compose.prod.yml exec api \
  npx prisma migrate resolve --rolled-back <migration_name>

# 3. Restore from backup (safest approach for data-destructive rollbacks)
#    See Section 4.5 above
```

**Important:** Prisma does not generate down-migrations automatically. For
destructive schema changes, always take a backup before applying migrations.

### 4.7 Schema Overview

The database contains the following core tables:

| Table                | Purpose                                      |
| -------------------- | -------------------------------------------- |
| `User`               | Team members (leads, head, viewers)          |
| `Project`            | Products/projects managed by leads           |
| `Report`             | Weekly report periods with lifecycle status  |
| `ReportSection`      | Per-lead section within a report             |
| `ProjectStatus`      | Traffic-light status per project per section |
| `Item`               | Current/next week work items                 |
| `Risk`               | Project risks with impact and mitigation     |
| `Decision`           | Decisions requiring management attention     |
| `Priority`           | Ranked priorities per section                |
| `PdfExportJob`       | Async PDF generation job tracking            |
| `ReminderRule`       | Scheduled email reminder configuration       |
| `ReminderExecution`  | Individual reminder send records             |
| `CarryOverExecution` | Cross-period item carry-over tracking        |
| `CarryOverRecord`    | Individual carried-over item/decision        |
| `VersionSnapshot`    | Autosave history for section edits           |
| `Stage`              | SDLC stages (e.g., Development, QA, Deploy)  |
| `StageAssignment`    | Stage ownership per user per project         |
| `AppSettings`        | Application configuration singleton          |

---

## 5. Health Checks and Monitoring

### 5.1 Endpoints

The API exposes health check endpoints via `@nestjs/terminus`:

| Endpoint            | Purpose         | Checks                                    | Use For               |
| ------------------- | --------------- | ----------------------------------------- | --------------------- |
| `GET /health/live`  | Liveness probe  | Memory heap < 200 MB                      | Container restart     |
| `GET /health/ready` | Readiness probe | Database + Redis + BullMQ queues + Memory | Load balancer routing |

### 5.2 Response Format

Both endpoints return JSON:

```json
{
  "status": "ok",
  "info": {
    "memory_heap": { "status": "up" },
    "database": { "status": "up" },
    "redis": { "status": "up" },
    "bullmq": {
      "status": "up",
      "pdf_export": { "waiting": 0, "active": 0 },
      "email_reminder": { "waiting": 0, "active": 0 }
    }
  },
  "error": {},
  "details": { ... }
}
```

When a check fails, the endpoint returns HTTP 503 with the failing component in
the `error` object.

### 5.3 Docker Health Checks

Health checks are configured in the Compose files:

| Service  | Endpoint / Command           | Interval | Timeout | Retries | Start Period |
| -------- | ---------------------------- | -------- | ------- | ------- | ------------ |
| postgres | `pg_isready -U customreport` | 10s      | 5s      | 5       | --           |
| redis    | `redis-cli ping`             | 10s      | 5s      | 5       | --           |
| api      | `GET /health/live`           | 15s      | 5s      | 3       | 30s          |
| web      | `GET /`                      | 15s      | 5s      | 3       | 20s          |

### 5.4 Kubernetes Probes (Future)

When migrating to Kubernetes, map the health endpoints to probes:

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3001
  initialDelaySeconds: 30
  periodSeconds: 15

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3001
  initialDelaySeconds: 10
  periodSeconds: 10
```

### 5.5 BullMQ Monitoring

The API uses two BullMQ queues backed by Redis:

| Queue            | Purpose                             |
| ---------------- | ----------------------------------- |
| `pdf-export`     | Async PDF generation via Playwright |
| `email-reminder` | Scheduled email delivery            |

Queue health is included in the `/health/ready` response. Monitor queue depth
to detect processing delays.

---

## 6. SSL/TLS and Reverse Proxy

In production, place a reverse proxy in front of the web and API services to
handle TLS termination, HTTP/2, and request routing.

### 6.1 Caddy (Recommended -- Automatic HTTPS)

```Caddyfile
# /etc/caddy/Caddyfile

reports.example.com {
    reverse_proxy web:3000
}

api.reports.example.com {
    reverse_proxy api:3001

    header {
        Access-Control-Allow-Origin https://reports.example.com
        Access-Control-Allow-Methods "GET, POST, OPTIONS"
        Access-Control-Allow-Headers "Content-Type, Authorization"
        Access-Control-Allow-Credentials true
    }
}
```

Caddy automatically provisions and renews Let's Encrypt certificates.

### 6.2 Nginx

```nginx
# /etc/nginx/conf.d/customreport.conf

upstream web_backend {
    server web:3000;
}

upstream api_backend {
    server api:3001;
}

# Frontend
server {
    listen 443 ssl http2;
    server_name reports.example.com;

    ssl_certificate     /etc/letsencrypt/live/reports.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/reports.example.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    location / {
        proxy_pass http://web_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# API
server {
    listen 443 ssl http2;
    server_name api.reports.example.com;

    ssl_certificate     /etc/letsencrypt/live/api.reports.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.reports.example.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff always;

    # CORS (handled by NestJS Helmet, but can be enforced here too)
    location / {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Increase timeout for PDF generation requests
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}

# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name reports.example.com api.reports.example.com;
    return 301 https://$host$request_uri;
}
```

### 6.3 Single-Domain Setup

If the API and web app share one domain (e.g., `reports.example.com`), route by
path prefix instead:

```nginx
location /trpc/ {
    proxy_pass http://api_backend;
    # ... same proxy headers as above
}

location /auth/ {
    proxy_pass http://api_backend;
}

location /health/ {
    proxy_pass http://api_backend;
}

location / {
    proxy_pass http://web_backend;
}
```

Update `NEXT_PUBLIC_API_URL` and `FRONTEND_URL` to use the same domain.

### 6.4 Cookie Security

When running behind TLS, ensure cookies use secure attributes. The API sets JWT
tokens with:

- `Secure: true` -- only sent over HTTPS
- `HttpOnly: true` -- not accessible via JavaScript
- `SameSite: Lax` -- prevents CSRF from cross-origin requests

Update `FRONTEND_URL` to use `https://` so the API sets the correct cookie
domain and secure flag.

### 6.5 CORS Configuration

CORS is managed by NestJS Helmet middleware. The `FRONTEND_URL` environment
variable is used as the allowed origin. In production:

```bash
FRONTEND_URL=https://reports.example.com
```

Only this exact origin is allowed. Credentials (cookies) are included in
cross-origin requests.

---

## 7. Troubleshooting

### API fails to start

**Symptom:** Container exits immediately with validation errors.

```bash
# Check logs for Zod validation errors
docker compose -f docker-compose.prod.yml logs api
```

Common causes:

- Missing `AUTH_JWT_SECRET` when `AUTH_DEV_MODE` is not `true`.
- `DATABASE_URL` not in `postgresql://` format.
- `REDIS_HOST` unreachable (check container networking).

### Database connection refused

```bash
# Verify postgres is healthy
docker compose -f docker-compose.prod.yml ps postgres

# Test connectivity from the API container
docker compose -f docker-compose.prod.yml exec api \
  sh -c "wget -q --spider http://localhost:3001/health/ready && echo OK || echo FAIL"
```

### Migrations fail

```bash
# Check migration status
docker compose -f docker-compose.prod.yml exec api npx prisma migrate status

# View migration logs
docker compose -f docker-compose.prod.yml logs migrate
```

### PDF generation fails

- Verify `PDF_BASE_URL` resolves to the web container (`http://web:3000` in
  Docker Compose).
- Check the `pdfdata` volume is writable.
- The API container needs ~1 GB free memory for Chromium.
- Check BullMQ queue status via `/health/ready`.

### Redis connection issues

```bash
# Test Redis from the API container
docker compose -f docker-compose.prod.yml exec api \
  sh -c "node -e \"const Redis = require('ioredis'); const r = new Redis({host:'redis'}); r.ping().then(console.log).catch(console.error).finally(() => r.quit())\""
```

### Updating the Application

```bash
# Pull latest code
git pull origin main

# Rebuild and restart (zero-downtime with health checks)
docker compose -f docker-compose.prod.yml up -d --build

# Verify health
docker compose -f docker-compose.prod.yml ps
```

Migrations run automatically via the `migrate` service before the API starts.

---

_Last updated: 2026-04-24_
