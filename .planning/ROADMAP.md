# CustomReport Roadmap

**Project:** Team Status Reporting Web App
**Created:** 2026-04-06
**Granularity:** Coarse
**Coverage:** v1.0: 29/29 | v2.0: 55/55

---

## Milestones

- [x] **v1.0 Domain Logic** - Phases 1-4 (shipped 2026-04-10)
- [ ] **v2.0 Infrastructure Integration** - Phases 5-7 (in progress)

## Phases

<details>
<summary>v1.0 Domain Logic (Phases 1-4) - SHIPPED 2026-04-10</summary>

- [x] **Phase 1: Core Report Capture** - Leads fill sections, head reviews submissions, data persists
- [x] **Phase 2: Report Assembly & Publication** - Portfolio overview auto-assembles, reports published to web, PDF export available
- [x] **Phase 3: Automation & Admin** - Email reminders, carry-over logic, admin panel, report history
- [x] **Phase 4: Production Hardening** - Hydration fixes, structured logging, design/E2E gaps

### Phase 1: Core Report Capture
**Goal**: Leads can submit structured report sections; head can review who has submitted; system captures all data with role-based access control
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, ENTRY-01, ENTRY-02, ENTRY-03, ENTRY-04, ENTRY-05, ENTRY-06, ENTRY-07
**Success Criteria** (what must be TRUE):
  1. Lead logs in via Keycloak SAML and sees their section form
  2. Lead can fill items (project, text, tag, status), set traffic lights, add risks, add decisions, set Top 3 priorities
  3. Lead can save section as draft multiple times without losing data
  4. Lead can submit entire section; submission is immutable until next report period
  5. Head sees submission dashboard with all leads and their status (submitted/draft)
  6. Unauthorized users see login page
  7. Session persists across page refresh via JWT
**Plans**: 3/3 complete

Plans:
- [x] 01-01-PLAN.md — Bootstrap monorepo, domain contracts, and auth/session foundation
- [x] 01-02-PLAN.md — Build lead report entry workspace with autosave and locked submit
- [x] 01-03-PLAN.md — Deliver head submission dashboard and role-aware navigation

### Phase 2: Report Assembly & Publication
**Goal**: Head can see aggregated portfolio status, publish final report, export to PDF
**Depends on**: Phase 1
**Requirements**: PUB-01, PUB-02, PUB-03, PUB-04, PUB-05, PUB-06, PUB-07
**Success Criteria** (what must be TRUE):
  1. Head sees portfolio status overview auto-aggregated from leads' traffic lights
  2. Head can view assembled report before publishing
  3. Head clicks Publish; report becomes immutable and visible to viewers
  4. Published report accessible via web URL with formatted layout
  5. PDF export via async BullMQ job
**Plans**: 3/3 complete

Plans:
- [x] 02-01-PLAN.md — Lock assembled report contracts and portfolio overview read model
- [x] 02-02-PLAN.md — Deliver immutable publish flow and published viewer web route
- [x] 02-03-PLAN.md — Deliver async PDF export on top of the published report

### Phase 3: Automation & Admin
**Goal**: System carries over pending items, sends email reminders, admin self-service, browsable archive
**Depends on**: Phase 1, Phase 2
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, NOTIF-01, NOTIF-02, ENTRY-08, ENTRY-09, ENTRY-10, HIST-01, HIST-02
**Success Criteria** (what must be TRUE):
  1. Admin panel for users, projects, report periods, email schedules
  2. Carry-over logic moves next-period items and unresolved decisions
  3. Email reminders with idempotent deduplication
  4. All published reports browsable in archive
**Plans**: 4/4 complete

Plans:
- [x] 03-01-PLAN.md — Deliver admin contracts, backend CRUD, and head-only admin UI
- [x] 03-02-PLAN.md — Deliver reminder schedule storage and dedupe-safe reminder execution
- [x] 03-03-PLAN.md — Deliver idempotent carry-over and report-period rollover flow
- [x] 03-04-PLAN.md — Deliver immutable history/archive browsing for published reports

### Phase 4: Production Hardening
**Goal**: Eliminate runtime-quality gaps discovered during real-browser validation
**Depends on**: Phase 3
**Requirements**: RUNTIME-01, OBS-01, QA-01
**Plans**: 2/2 complete

Plans:
- [x] 04-01-PLAN.md — Fix hydration/runtime mismatch and stabilize browser-backed SSR boundaries
- [x] 04-02-PLAN.md — Add rotating system logging and close deep design/E2E production gaps

</details>

---

### v2.0 Infrastructure Integration (In Progress)

**Milestone Goal:** Connect the domain-logic prototype to real infrastructure -- PostgreSQL persistence, NestJS API, SAML authentication, Docker deployment. Transform localStorage demo into production application.

- [x] **Phase 5: Backend Foundation** - Prisma migrations, NestJS bootstrap, all repository implementations, integration tests against real PostgreSQL
- [ ] **Phase 6: Auth & Frontend Integration** - SAML SSO via Keycloak, JWT sessions, frontend migrated from localStorage to tRPC API calls
- [ ] **Phase 7: Production Infrastructure** - BullMQ async jobs, health/metrics endpoints, Docker Compose orchestration with all services

## Phase Details

### Phase 5: Backend Foundation
**Goal**: Domain services persist data in PostgreSQL through Prisma repositories; NestJS serves tRPC endpoints backed by real database; existing tests continue passing
**Depends on**: Phase 4 (v1.0 complete)
**Requirements**: DB-01, DB-02, DB-03, DB-04, API-01, API-02, API-03, API-04, API-05, API-06, API-07, REPO-01, REPO-02, REPO-03, REPO-04, REPO-05, REPO-06, REPO-07, REPO-08, REPO-09, QA-01, QA-04
**Success Criteria** (what must be TRUE):
  1. Running `prisma studio` shows all domain tables populated with seed data (6 leads, 1 head, 1 viewer, projects, current report period)
  2. `curl localhost:3001/trpc/reports.getActive` returns report data from PostgreSQL (using dev bypass auth)
  3. All 8 domain services read and write through Prisma repositories -- no in-memory or localStorage fallbacks remain in the API
  4. All 51 existing backend unit tests pass with the new Prisma repository implementations
  5. Integration tests verify repository read/write against real PostgreSQL (not mocked)
**Plans**: 6 plans

Plans:
- [x] 05-01-PLAN.md — Complete Prisma schema (15 models), initial migration, idempotent seed, PrismaService singleton
- [x] 05-02-PLAN.md — NestJS AppModule, env config, and 4 simpler Prisma repositories (review, archive, pdf-export, reminders)
- [x] 05-03-PLAN.md — 4 complex Prisma repositories (report-sections, publication, carry-over, admin) with deep includes and transactions
- [x] 05-04-PLAN.md — tRPC AppRouter with all domain procedures, main.ts bootstrap, dev auth bypass, error mapping
- [x] 05-05-PLAN.md — Verify 51 existing unit tests pass, integration tests for all 8 repositories against real PostgreSQL
- [x] 05-06-PLAN.md — Gap closure: Add Zod .parse() to 4 non-compliant repositories (REPO-09), fix REQUIREMENTS.md drift

### Phase 6: Auth & Frontend Integration
**Goal**: Users authenticate via Keycloak SAML, frontend calls real API instead of localStorage; the full user journey works end-to-end in a browser
**Depends on**: Phase 5
**Requirements**: AUTHZ-01, AUTHZ-02, AUTHZ-03, AUTHZ-04, AUTHZ-05, AUTHZ-06, FE-01, FE-02, FE-03, FE-04, FE-05, FE-06, FE-07, FE-08, FE-09, FE-10, QA-02, QA-03
**Success Criteria** (what must be TRUE):
  1. User clicks login, is redirected to Keycloak, completes SAML flow, and returns to the app with an active session cookie
  2. Lead fills report section in browser -- data persists in PostgreSQL (not localStorage); page refresh preserves state
  3. Head reviews submissions, publishes report, and viewers can read published reports -- all against real API
  4. Dev bypass mode (env flag) provides hardcoded session for local development without Keycloak
  5. TypeScript typecheck passes clean across the entire monorepo; all 24 previously-failing frontend tests are fixed
**Plans**: 5 plans
**UI hint**: yes

Plans:
- [x] 06-01-PLAN.md — Wire SAML auth routes, tRPC context JWT extraction, env schema, auth error page
- [x] 06-02-PLAN.md — Install tRPC client packages, create TRPCProvider, wire into root layout
- [ ] 06-03-PLAN.md — Migrate lead/head/report/archive pages from localStorage to tRPC hooks
- [ ] 06-04-PLAN.md — Migrate admin page to tRPC, delete all localStorage helper files
- [ ] 06-05-PLAN.md — Fix Vitest jsdom config, create MSW handlers, fix all frontend tests, typecheck clean

### Phase 7: Production Infrastructure
**Goal**: Application runs as a containerized stack with async job processing, health monitoring, and production-grade operational controls
**Depends on**: Phase 6
**Requirements**: JOBS-01, JOBS-02, JOBS-03, JOBS-04, JOBS-05, DOCK-01, DOCK-02, DOCK-03, DOCK-04, DOCK-05, DOCK-06, OBS-01, OBS-02, OBS-03, OBS-04
**Success Criteria** (what must be TRUE):
  1. `docker compose up` starts the full stack (PostgreSQL, Redis, PgBouncer, API, Web) and the app is accessible in a browser
  2. PDF export button triggers async BullMQ job; user can download the generated PDF file within 10 seconds
  3. Email reminder processor sends test email via SMTP; failed jobs appear in dead-letter queue and Bull Board UI
  4. `/health/ready` returns 200 when DB, Redis, and queues are connected; `/metrics` returns Prometheus-format metrics
  5. `docker compose down && docker compose up` restarts cleanly; data persists across restarts via PostgreSQL volume
**Plans**: TBD

---

## Progress

**Execution Order:** Phases execute in numeric order: 5 -> 6 -> 7

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Core Report Capture | v1.0 | 3/3 | Complete | 2026-04-08 |
| 2. Report Assembly & Publication | v1.0 | 3/3 | Complete | 2026-04-09 |
| 3. Automation & Admin | v1.0 | 4/4 | Complete | 2026-04-09 |
| 4. Production Hardening | v1.0 | 2/2 | Complete | 2026-04-10 |
| 5. Backend Foundation | v2.0 | 6/6 | Complete | 2026-04-10 |
| 6. Auth & Frontend Integration | v2.0 | 0/5 | Planning complete | - |
| 7. Production Infrastructure | v2.0 | 0/? | Not started | - |

---

## Coverage Validation

**v2.0 requirements:** 55 total
**Mapped to phases:** 55
**Orphaned:** 0

**Mapping summary:**
- Phase 5: 22 requirements (4 DB + 7 API + 9 REPO + 2 QA)
- Phase 6: 18 requirements (6 AUTHZ + 10 FE + 2 QA)
- Phase 7: 15 requirements (5 JOBS + 6 DOCK + 4 OBS)

All requirements covered. No gaps.

**QA requirement distribution:**
- QA-01 (existing tests pass) -> Phase 5 (repositories replace in-memory implementations)
- QA-02 (fix frontend tests) -> Phase 6 (frontend migration)
- QA-03 (typecheck clean) -> Phase 6 (frontend + backend must compile together)
- QA-04 (integration tests) -> Phase 5 (test repositories against real DB)

---

## Rationale

**Why 3 phases (coarse):**
- Each phase delivers one complete, verifiable infrastructure layer
- Phase 5 is the biggest (22 reqs) but tightly coupled -- DB, API, and repositories cannot be verified independently
- Phase 6 bundles auth with frontend because the frontend cannot function without auth cookies
- Phase 7 groups all production-readiness concerns that are additive (app works without them, but not deployable)

**Phase ordering follows dependency edges:**
1. **Phase 5 first:** Every subsequent phase depends on a working database and API. Cannot test auth, frontend, or jobs without Prisma repositories serving real data.
2. **Phase 6 after 5:** Auth needs working tRPC endpoints to protect. Frontend needs both working API and auth cookies. Dev bypass covers the gap during Phase 5.
3. **Phase 7 last:** Docker wraps a working application. Jobs and observability are additive. Debugging infrastructure issues in containers is slower than debugging locally.

**Critical pitfalls addressed per phase:**
- Phase 5: Pitfall #2 (Prisma migration through PgBouncer -- use directUrl), Pitfall #1 (PgBouncer prepared statements -- PgBouncer 1.22+ with max_prepared_statements)
- Phase 6: Pitfall #3 (NestJS guards bypassed on tRPC -- auth as tRPC middleware), Pitfall #9 (SAML cookie domain mismatch)
- Phase 7: Pitfall #4 (Redis noeviction for BullMQ), Pitfall #6 (workspace:* in Docker -- turbo prune)

---

*Roadmap created: 2026-04-06*
*v2.0 phases added: 2026-04-10*
