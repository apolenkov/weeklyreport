---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Infrastructure Integration
status: executing
last_updated: "2026-04-10T21:35:22.571Z"
last_activity: 2026-04-10
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 11
  completed_plans: 9
  percent: 64
---

# Project State: CustomReport

**Project:** Team Status Reporting Web App
**Status:** Ready to execute
**Last Updated:** 2026-04-10

---

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-10)

**Core Value:** Лиды заполняют свои секции независимо через удобную форму, система автоматически собирает единый отчёт — без конфликтов редактирования, с историей и аналитикой.

**Current Focus:** Phase 06 — auth-frontend-integration

---

## Current Position

Phase: 06 (auth-frontend-integration) — EXECUTING
Plan: 3 of 5
Status: Ready to execute
Last activity: 2026-04-10

Progress: [############░░░░░░░░] 64% (7/11 plans complete)

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
| recipientEmail z.string() not z.email() | DB layer returns empty string for recipientEmail; service layer populates real email | Confirmed |
| TS paths in child tsconfig must duplicate base | TypeScript does not merge paths from extends; child must redeclare all base paths | Confirmed |
| Paths relative to baseUrl, not config location | baseUrl in tsconfig.base.json is monorepo root; all paths resolve from there | Confirmed |

---

## Critical Pitfalls to Watch

1. **PgBouncer prepared statements:** Use 1.22+ with `max_prepared_statements = 256`
2. **Prisma migrations via directUrl:** Never migrate through PgBouncer
3. **NestJS guards bypassed on tRPC:** All auth must be tRPC middleware
4. **Redis noeviction for BullMQ:** Default `allkeys-lru` destroys job metadata
5. **SAML cookie domain mismatch:** Same-domain or token redirect flow required

---

## Next Steps

1. Transition to Phase 6: Auth & Frontend Integration
2. SAML SSO via Keycloak + JWT sessions + role guards
3. Frontend localStorage -> tRPC migration
4. Fix 24 failing frontend tests (userEvent.setup crash)

---

*State initialized: 2026-04-06*
*v2.0 roadmap: 2026-04-10*
