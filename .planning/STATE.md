---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Infrastructure Integration
status: executing
last_updated: "2026-04-10T17:09:34.922Z"
last_activity: 2026-04-10
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 5
  completed_plans: 4
  percent: 40
---

# Project State: CustomReport

**Project:** Team Status Reporting Web App
**Status:** Executing Phase 05
**Last Updated:** 2026-04-10

---

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-10)

**Core Value:** Лиды заполняют свои секции независимо через удобную форму, система автоматически собирает единый отчёт — без конфликтов редактирования, с историей и аналитикой.

**Current Focus:** Phase 05 — backend-foundation

---

## Current Position

Phase: 05 (backend-foundation) — EXECUTING
Plan: 5 of 5
Status: Executing Phase 05 -- Plans 01-04 complete, Plan 05 next
Last activity: 2026-04-10 -- Completed 05-04 (tRPC AppRouter + NestJS bootstrap)

Progress: [################....] 80% (4/5 plans complete)

---

## v2.0 Phase Map

- **Phase 5: Backend Foundation** (22 requirements)
  - Prisma migrations + seed, NestJS bootstrap, 9 Prisma repositories, tRPC endpoints, integration tests
- **Phase 6: Auth & Frontend Integration** (18 requirements)
  - SAML SSO, JWT sessions, role guards, frontend localStorage -> tRPC migration, fix failing tests
- **Phase 7: Production Infrastructure** (15 requirements)
  - BullMQ jobs (PDF + email), health/metrics, Docker Compose, PgBouncer, graceful shutdown

---

## Key Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| Coarse 3-phase split for v2.0 | Backend foundation -> Auth+Frontend -> Production infra; follows dependency edges | Confirmed |
| QA distributed across phases | QA-01/QA-04 in Phase 5 (repos), QA-02/QA-03 in Phase 6 (frontend) | Confirmed |
| Auth as tRPC middleware (not NestJS guards) | Guards silently bypassed on tRPC routes (critical pitfall #3) | Confirmed |
| PgBouncer 1.22+ with max_prepared_statements | Avoids prepared statement conflict with Prisma (pitfall #1) | Confirmed |
| Dev bypass auth for Phase 5 | Enables testing tRPC endpoints before SAML is wired | Confirmed |
| Prisma 7 driver adapter pattern | PrismaClient requires @prisma/adapter-pg + pg.Pool (breaking change from Prisma 6) | Confirmed |
| datasource config in prisma.config.ts | Prisma 7 moved url/directUrl from schema.prisma to prisma.config.ts | Confirmed |
| useFactory DI pattern for repos | NestJS modules wire repos to services via useFactory+inject rather than custom DI tokens | Confirmed |
| Status enum mapping tables | Domain enum values (queued/sent) differ from DB enums (pending/sent); explicit mapping tables | Confirmed |
| tRPC Express middleware on NestJS | app.getHttpAdapter().getInstance().use('/trpc', createExpressMiddleware(...)) | Confirmed |
| Service resolution via app.get() | All 8 services resolved from NestJS DI container at bootstrap, passed as RouterDeps | Confirmed |

---

## Critical Pitfalls to Watch

1. **PgBouncer prepared statements:** Use 1.22+ with `max_prepared_statements = 256`
2. **Prisma migrations via directUrl:** Never migrate through PgBouncer
3. **NestJS guards bypassed on tRPC:** All auth must be tRPC middleware
4. **Redis noeviction for BullMQ:** Default `allkeys-lru` destroys job metadata
5. **SAML cookie domain mismatch:** Same-domain or token redirect flow required

---

## Next Steps

1. Execute Plan 05-05: Integration tests against real PostgreSQL
2. After Phase 5 complete: transition to Phase 6 (Auth & Frontend Integration)
3. Phase 6 will replace DEV_SESSION with real JWT auth in trpc.context.ts

---

*State initialized: 2026-04-06*
*v2.0 roadmap: 2026-04-10*
