# Requirements: CustomReport v2.0

**Defined:** 2026-04-10
**Core Value:** Лиды заполняют свои секции независимо через удобную форму, система автоматически собирает единый отчёт — без конфликтов редактирования, с историей и аналитикой.
**Milestone:** v2.0 Infrastructure Integration

## v2 Requirements

Requirements for infrastructure integration. Each maps to roadmap phases.

### Database Foundation

- [x] **DB-01**: Prisma schema includes all domain models (add 5 missing: PdfExportJob, ReminderRule, ReminderExecution, CarryOverExecution, CarryOverRecord)
- [x] **DB-02**: Initial migration creates all tables in PostgreSQL
- [x] **DB-03**: Seed script creates baseline data (6 leads, 1 head, 1 viewer, projects, current report period)
- [x] **DB-04**: Seed is idempotent (safe to run multiple times)

### API Server

- [ ] **API-01**: NestJS bootstraps HTTP server listening on configurable port
- [ ] **API-02**: tRPC adapter mounts AppRouter at `/trpc` as Express middleware
- [ ] **API-03**: tRPC context factory extracts UserSession from JWT cookie per request
- [ ] **API-04**: All 8 domain services wired via NestJS dependency injection with Prisma repositories
- [ ] **API-05**: Environment configuration validated with Zod on startup (fail-fast on missing vars)
- [ ] **API-06**: CORS configured for frontend origin
- [ ] **API-07**: Structured error handling maps domain errors to tRPC error codes

### Prisma Repositories

- [x] **REPO-01**: ReportSectionsRepository implementation (nested includes: projects, items, risks, decisions, priorities)
- [ ] **REPO-02**: ReviewService repository (assemble full report with all sections)
- [x] **REPO-03**: PublicationService repository (publish report, update status)
- [ ] **REPO-04**: PdfExportRepository implementation (job CRUD)
- [ ] **REPO-05**: RemindersRepository implementation (rule + execution CRUD with dedupe)
- [x] **REPO-06**: CarryOverRepository implementation (transactional cross-report copy)
- [x] **REPO-07**: AdminRepository implementation (users, projects, periods, reminder rules CRUD)
- [ ] **REPO-08**: ArchiveRepository implementation (query published reports by date)
- [x] **REPO-09**: All repositories parse output through Zod schemas before returning

### Authentication

- [ ] **AUTHZ-01**: SAML login endpoint (`/auth/saml/login`) redirects to Keycloak
- [ ] **AUTHZ-02**: SAML callback endpoint processes assertion, creates/updates user, sets JWT cookie
- [ ] **AUTHZ-03**: tRPC middleware validates JWT and injects UserSession into context
- [ ] **AUTHZ-04**: tRPC middleware enforces role-based access (lead/head/viewer) per procedure
- [ ] **AUTHZ-05**: Dev bypass mode (env flag) provides hardcoded session for local development
- [ ] **AUTHZ-06**: Logout endpoint clears JWT cookie

### Frontend Integration

- [ ] **FE-01**: tRPC client configured with httpBatchLink pointing to API
- [ ] **FE-02**: Lead report form uses tRPC mutations instead of localStorage for save/submit
- [ ] **FE-03**: Head dashboard fetches real submission statuses via tRPC
- [ ] **FE-04**: Assembled report review page loads data from API
- [ ] **FE-05**: Publication flow calls API to publish report
- [ ] **FE-06**: Published report page loads from API
- [ ] **FE-07**: Admin panel CRUD operations call API endpoints
- [ ] **FE-08**: Archive/history pages load from API
- [ ] **FE-09**: PDF export triggers async job via API and polls for completion
- [ ] **FE-10**: localStorage helpers and demo data files removed

### Background Jobs

- [ ] **JOBS-01**: BullMQ registered with Redis connection (noeviction policy)
- [ ] **JOBS-02**: PDF export processor generates PDF via Playwright and stores artifact
- [ ] **JOBS-03**: Email reminder processor sends via SMTP with deduplication
- [ ] **JOBS-04**: Bull Board admin UI accessible to head role for queue monitoring
- [ ] **JOBS-05**: Failed jobs go to dead-letter queue with configurable retry

### Containerization

- [ ] **DOCK-01**: Multi-stage Dockerfile for apps/api (turbo prune + pnpm)
- [ ] **DOCK-02**: Multi-stage Dockerfile for apps/web (turbo prune + pnpm)
- [ ] **DOCK-03**: docker-compose.yml orchestrates PostgreSQL, Redis, PgBouncer, API, Web
- [ ] **DOCK-04**: docker-compose.dev.yml adds volume mounts and hot reload for development
- [ ] **DOCK-05**: Health-check-based startup ordering (DB ready -> migrate -> API -> Web)
- [ ] **DOCK-06**: PgBouncer configured with transaction mode and max_prepared_statements

### Observability

- [ ] **OBS-01**: Health check endpoints (/health/live, /health/ready) checking DB + Redis + memory
- [ ] **OBS-02**: Prometheus metrics endpoint (/metrics)
- [ ] **OBS-03**: Graceful shutdown drains connections on SIGTERM
- [ ] **OBS-04**: Request logging with correlation IDs

### Quality Gates

- [ ] **QA-01**: All existing 51 backend tests still pass with Prisma repositories
- [ ] **QA-02**: Fix 24 failing frontend tests (userEvent.setup crash)
- [ ] **QA-03**: TypeScript typecheck clean across entire monorepo
- [ ] **QA-04**: Integration tests for repository implementations against real PostgreSQL

## v3 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Analytics

- **ANAL-01**: Trend charts showing project health trajectory over weeks
- **ANAL-02**: Risk aggregation dashboard
- **ANAL-03**: Decision resolution timeline

### Extended Integrations

- **INTG-01**: Slack/Teams notification on report publication
- **INTG-02**: Jira integration for auto-populating items

### Production Scaling

- **SCALE-01**: Kubernetes manifests
- **SCALE-02**: S3/MinIO for PDF storage
- **SCALE-03**: Redis Sentinel/Cluster
- **SCALE-04**: CI/CD pipeline (GitHub Actions)
- **SCALE-05**: Database backup automation
- **SCALE-06**: Multi-environment config (staging, production)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Kubernetes deployment | Docker Compose sufficient for 6+1 users |
| S3/MinIO PDF storage | Filesystem volume sufficient for <1000 PDFs |
| CI/CD pipeline | Orthogonal, add after infrastructure milestone |
| Prometheus/Grafana stack | Health endpoints + structured logs sufficient |
| Redis Sentinel/Cluster | Single instance handles the load |
| API versioning | tRPC + Zod handle schema evolution |
| @trpc/react-query | Unnecessary weight for 6 users; vanilla tRPC client simpler |
| nestjs-trpc decorator lib | Conflicts with existing shared router contract |
| @nestjs/schedule | BullMQ repeatable jobs handle scheduling |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01 | Phase 5 | Complete |
| DB-02 | Phase 5 | Complete |
| DB-03 | Phase 5 | Complete |
| DB-04 | Phase 5 | Complete |
| API-01 | Phase 5 | Pending |
| API-02 | Phase 5 | Pending |
| API-03 | Phase 5 | Pending |
| API-04 | Phase 5 | Pending |
| API-05 | Phase 5 | Pending |
| API-06 | Phase 5 | Pending |
| API-07 | Phase 5 | Pending |
| REPO-01 | Phase 5 | Complete |
| REPO-02 | Phase 5 | Pending |
| REPO-03 | Phase 5 | Complete |
| REPO-04 | Phase 5 | Pending |
| REPO-05 | Phase 5 | Pending |
| REPO-06 | Phase 5 | Complete |
| REPO-07 | Phase 5 | Complete |
| REPO-08 | Phase 5 | Pending |
| REPO-09 | Phase 5 | Complete |
| AUTHZ-01 | Phase 6 | Pending |
| AUTHZ-02 | Phase 6 | Pending |
| AUTHZ-03 | Phase 6 | Pending |
| AUTHZ-04 | Phase 6 | Pending |
| AUTHZ-05 | Phase 6 | Pending |
| AUTHZ-06 | Phase 6 | Pending |
| FE-01 | Phase 6 | Pending |
| FE-02 | Phase 6 | Pending |
| FE-03 | Phase 6 | Pending |
| FE-04 | Phase 6 | Pending |
| FE-05 | Phase 6 | Pending |
| FE-06 | Phase 6 | Pending |
| FE-07 | Phase 6 | Pending |
| FE-08 | Phase 6 | Pending |
| FE-09 | Phase 6 | Pending |
| FE-10 | Phase 6 | Pending |
| JOBS-01 | Phase 7 | Pending |
| JOBS-02 | Phase 7 | Pending |
| JOBS-03 | Phase 7 | Pending |
| JOBS-04 | Phase 7 | Pending |
| JOBS-05 | Phase 7 | Pending |
| DOCK-01 | Phase 7 | Pending |
| DOCK-02 | Phase 7 | Pending |
| DOCK-03 | Phase 7 | Pending |
| DOCK-04 | Phase 7 | Pending |
| DOCK-05 | Phase 7 | Pending |
| DOCK-06 | Phase 7 | Pending |
| OBS-01 | Phase 7 | Pending |
| OBS-02 | Phase 7 | Pending |
| OBS-03 | Phase 7 | Pending |
| OBS-04 | Phase 7 | Pending |
| QA-01 | Phase 5 | Pending |
| QA-02 | Phase 6 | Pending |
| QA-03 | Phase 6 | Pending |
| QA-04 | Phase 5 | Pending |

**Coverage:**
- v2 requirements: 55 total
- Mapped to phases: 55
- Unmapped: 0

---

*Requirements defined: 2026-04-10*
*Traceability updated: 2026-04-10 (roadmap creation)*
