# CustomReport Roadmap

**Project:** Team Status Reporting Web App
**Created:** 2026-04-06
**Granularity:** Coarse
**Coverage:** v1.0: 29/29 | v2.0: 55/55 | v4.0: 46/46 (SCH:7 + API:13 + UI:20 + E2E:10 — via MANIFEST D-1→D-70)

---

## Milestones

- [x] **v1.0 Domain Logic** - Phases 1-4 (shipped 2026-04-10)
- [x] **v2.0 Infrastructure Integration** - Phases 5-7 (shipped 2026-04-11)
- [x] **v3.0 Progress** - Phases 13-15 (shipped 2026-04-21)
- [ ] **v4.0 Backend Completeness & UI Redesign** - Phases 16-18 (in progress)

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

<details>
<summary>v2.0 Infrastructure Integration (Phases 5-7) - SHIPPED 2026-04-11</summary>

- [x] **Phase 5: Backend Foundation** - Prisma 14 models, 8 repositories, NestJS tRPC API, integration tests
- [x] **Phase 6: Auth & Frontend Integration** - SAML SSO, JWT sessions, localStorage→tRPC migration, 27 tests
- [x] **Phase 7: Production Infrastructure** - BullMQ jobs, Docker Compose, health/metrics, graceful shutdown

Full details: [v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md)

</details>

## Phase Details

*v2.0 phase details archived to [milestones/v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md)*

<!-- Kept for reference:
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
**Plans**: 6 plans
**UI hint**: yes

Plans:
- [x] 06-01-PLAN.md — Wire SAML auth routes, tRPC context JWT extraction, env schema, auth error page
- [x] 06-02-PLAN.md — Install tRPC client packages, create TRPCProvider, wire into root layout
- [x] 06-03-PLAN.md — Migrate lead/head/report/archive pages from localStorage to tRPC hooks
- [x] 06-04-PLAN.md — Migrate admin page to tRPC, delete all localStorage helper files
- [x] 06-05-PLAN.md — Fix Vitest jsdom config, create MSW handlers, fix all frontend tests, typecheck clean
- [x] 06-06-PLAN.md — Gap closure: Add superjson transformer to fix 17 Date/string typecheck errors (QA-03)

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
**Plans**: 3 plans

Plans:
- [x] 07-01-PLAN.md — BullMQ queues, PDF export processor, email reminder processor, Bull Board UI
- [x] 07-02-PLAN.md — Health check endpoints, Prometheus metrics, graceful shutdown, correlation IDs
- [x] 07-03-PLAN.md — Docker Compose orchestration, multi-stage Dockerfiles, dev override
-->

---

## v3.0 Progress — SHIPPED 2026-04-21

### Phase 13: Quality Assurance & Polish ✅ VERIFIED

Plans:
- [x] 13-01-PLAN.md -- P0 bug fixes (saveDraft publish check, carry-over findMany, idempotency)
- [x] 13-02-PLAN.md -- P1 bug fixes (export failed, carry-over status, removeUser)
- [x] 13-03-PLAN.md -- Wave 1 bug fixes: a11y, keyboard nav, print CSS
- [x] 13-04-PLAN.md -- Validation hardening (trim, null bytes, array limits)
- [x] 13-05-PLAN.md -- Date formatting, locale standardization
- [x] 13-06-PLAN.md -- UX/UI polish: ARIA landmarks, skeleton contrast, design tokens
- [x] 13-07-PLAN.md -- E2E test stabilization and visual baselines
- [x] 13-08-PLAN.md -- Comprehensive test coverage expansion
- [x] UI/UX redesign (3 Sonnet review cycles, 27/35 findings applied)

**Verification:** 8/8 must-haves verified (re-verified 2026-04-13). Human verification items (E2E, WCAG, visual baselines) deferred to runtime.

### Phase 14: Backend Hardening & Containerization ✅ VERIFIED
**Goal**: Backend fully tested with integration tests against real PostgreSQL, BullMQ workers tested, Docker multi-stage builds for production, CI/CD pipeline with GitHub Actions
**Depends on**: Phase 13
**Verification**: 6/7 SC pass. SC-4 partial (Dockerfile.api uses Playwright runner ~1.4GB for PDF — architectural constraint). SC-7 partial (97 unit tests pass, web has 24 pre-existing jsdom failures).
**Plans**: 3 plans

Plans:
- [x] 14-01-PLAN.md — Unit tests for BullMQ processors (pdf-export, email-reminder) and tRPC auth middleware
- [x] 14-02-PLAN.md — Docker image optimization (Dockerfile.api) and production docker-compose.prod.yml
- [x] 14-03-PLAN.md — CI pipeline integration tests, test script updates, full suite verification

### Phase 15: UI/UX Polish & Visual Verification

**Goal:** All pages visually polished with consistent design system, every screen verified via Playwright screenshots, deferred P3 findings resolved, empty states and error states properly styled
**Requirements**: D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11, D-12, D-13
**Depends on:** Phase 13
**Plans:** 3/3 plans complete

Plans:
- [x] 15-01-PLAN.md — Fix Vitest JSX transform, create EmptyState component, wire into all data pages
- [x] 15-02-PLAN.md — P3 navigation fixes: nav grouping, logout POST, collapsed padding, tooltip verification
- [x] 15-03-PLAN.md — Expand Playwright visual baselines to ~12 pages, human visual verification

---

## v4.0 Backend Completeness & UI Redesign

- [x] **Phase 16: Backend Hardening** - Prisma migration, BullMQ re-enabled, 81 regression scenarios pass, test infrastructure clean (completed 2026-04-21)
- [ ] **Phase 17: Fullstack UI Redesign** - Schema + API + Frontend per mockup v14 (6 waves)
- [ ] **Phase 18: E2E Tests** - 223 regression scenarios as Playwright tests, 7 plans
- [ ] **Phase 19: Documentation** - API reference, deployment guide, developer + user docs

### Phase 16: Backend Hardening
**Goal**: Backend fully conforms to all API contracts; BullMQ queues functional; test infrastructure clean and ready to support UI redesign
**Depends on**: Phase 15
**Requirements**: BE-01, BE-02, BE-03, BE-04, BE-05, BE-06
**Success Criteria** (what must be TRUE):
  1. Prisma ReminderRule table has kind/fireAt/timezone/status/version columns; existing seed data survives the migration without loss
  2. BullMQ PDF export job transitions from queued to completed within 30 seconds when triggered from the browser
  3. All 81 regression scenarios pass as API integration tests (extending the existing 191 contract test suite)
  4. `pnpm typecheck` passes clean across the entire monorepo after all backend changes (no broken window between commits)
  5. `pnpm --filter @customreport/web test` reports 0 failures (24 pre-existing jsdom failures resolved; MSW handlers match current tRPC contracts)
**Plans**: 4 plans

Plans:
- [x] 16-01-PLAN.md — Prisma migration (ReminderRule schema alignment) + Zod reportId nullable + repository cascade
- [x] 16-02-PLAN.md — BullMQ re-enablement (module wiring + queue injection) + health indicator + Docker fixes
- [x] 16-03-PLAN.md — ThemeProvider wiring + theme toggle + MSW/web test verification (BE-04, BE-05, BE-06)
- [x] 16-04-PLAN.md — Regression contract tests (P0/P1 scenarios extending existing test suite)

### Phase 17: Fullstack UI Redesign (Schema + API + Frontend)
**Goal**: Complete application rewrite driven by mockup v14 — new data model (period lifecycle, version history), 13 new API endpoints (publish/lock, revoke, fill-from, versions), 7 frontend pages (Starbucks design, URL-based routing)
**Depends on**: Phase 16
**Spec sources**: MANIFEST.md (D-1→D-70), REGRESSION-SCENARIOS.md (223 scenarios), mockup-v17-v14.html
**Requirements**: SCH-01..07, API-01..13, UI-01..20
**Success Criteria** (what must be TRUE):
  1. Prisma schema has Period lifecycle (Open/Published/Reopened), VersionSnapshot model, stage unique constraints — migration runs without data loss
  2. tRPC API: period.publish, period.reopen, leadSubmission.revoke, leadForm.fillFrom, leadForm.versions — all functional with integration tests
  3. Login stub: 4 role buttons redirect to correct pages, guarded by NEXT_PUBLIC_AUTH_STUB env
  4. Lead Form: SDLC pipeline, period navigator, Fill from, version history, submit → locked — matches mockup v14 s1
  5. Dashboard: KPIs, Lead Reports with locks + traffic lights, Report Archive with pagination — matches mockup v14 s2
  6. Weekly Report: auto-compiled, period navigator, per-lead accordions, Publish & Lock — matches mockup v14 s3
  7. Admin Panel: 5 tabs, stage assignment validation — matches mockup v14 s4
  8. URL-based routing: every state in URL, browser back/forward works, bookmarkable (D-69)
  9. All pages: Starbucks design (cream/teal/gold), max-w-6xl, skip-link, aria-labels, touch targets 44px
  10. 223 regression scenarios used as acceptance criteria — P0 scenarios must pass
**Plans**: 7 plans (01=index, 02-07=waves)
**UI hint**: yes

Plans:
- [x] 17-01-PLAN.md — Index & overview (superseded by wave plans)
- [x] 17-02-PLAN.md — Wave 1: Schema migration (SCH-01..07) + Login stub (API-13) + URL routing (UI-14) ✅
- [ ] 17-03-PLAN.md — Wave 2 gaps: Remaining 3 API endpoints (API-04, API-11, API-12) + service tests
- [ ] 17-04-PLAN.md — Wave 3: Lead Form + Lead History UI (UI-01..04, UI-13)
- [ ] 17-05-PLAN.md — Wave 4: Dashboard + Weekly Report UI (UI-05..10)
- [ ] 17-06-PLAN.md — Wave 5: Admin Panel + Login + Design Polish (UI-11,12,15..19)
- [ ] 17-07-PLAN.md — Wave 6: Print/PDF (UI-20) + Integration Tests

### Phase 18: E2E Tests
**Goal**: 223 regression scenarios implemented as Playwright E2E tests covering all role journeys, cross-role lifecycles, error paths, and visual baselines
**Depends on**: Phase 17
**Requirements**: E2E-01..E2E-10
**Success Criteria** (what must be TRUE):
  1. Lead journey: login stub → period select → fill all sections → submit → locked — passes E2E
  2. Head journey: dashboard → weekly report → publish & lock → PDF export — passes E2E
  3. Cross-role lifecycle: lead submits → head publishes → lead sees locked → head reopens → lead re-edits — passes E2E
  4. Revoke flow: admin revokes → lead re-edits → re-submits — passes E2E
  5. Error paths: 403 wrong role, 404 invalid period, network disconnect — passes E2E
  6. Visual regression baselines established; `pnpm playwright test` passes with 0 failures
  7. P0 regression scenarios (83) all pass as automated tests
**Plans**: 7 plans

Plans:
- [ ] 18-01-PLAN.md — Auth fixtures + Lead journey (E2E-01)
- [ ] 18-02-PLAN.md — Head journey: dashboard + weekly report + PDF (E2E-02)
- [ ] 18-03-PLAN.md — Admin journey (E2E-03)
- [ ] 18-04-PLAN.md — Cross-role lifecycle + Revoke (E2E-04, E2E-05)
- [ ] 18-05-PLAN.md — Period nav + Fill From + Version History (E2E-06..08)
- [ ] 18-06-PLAN.md — Error paths + edge cases (E2E-09)
- [ ] 18-07-PLAN.md — Visual regression baselines + accessibility (E2E-10)

### Phase 19: Documentation
**Goal**: Complete project documentation for handoff — API reference, deployment guide, developer onboarding, user guide
**Depends on**: Phase 17, Phase 18
**Requirements**: DOC-01..DOC-03
**Success Criteria** (what must be TRUE):
  1. `docs/API-REFERENCE.md` covers all ~30 tRPC endpoints with input/output shapes
  2. `docs/DEPLOYMENT.md` enables production deploy from scratch
  3. `docs/DEVELOPER.md` enables new developer local setup in < 30 minutes
  4. `docs/USER-GUIDE.md` covers all role workflows with screenshot references
**Plans**: 3 plans

Plans:
- [ ] 19-01-PLAN.md — API reference documentation
- [ ] 19-02-PLAN.md — Deployment guide
- [ ] 19-03-PLAN.md — Developer onboarding + User guide

---

## Progress Table — v4.0

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 16. Backend Hardening | 4/4 | Complete | 2026-04-21 |
| 17. Fullstack UI Redesign | 2/7 | Wave 1-2 done, 5 remaining | - |
| 18. E2E Tests | 0/7 | Plans ready | - |
| 19. Documentation | 0/3 | Plans ready | - |

## Execution Order (for /gsd:next)

```
17-03 → 17-04 → 17-05 → 17-06 → 17-07 → 18-01 → 18-02 → 18-03 → 18-04 → 18-05 → 18-06 → 18-07 → 19-01 → 19-02 → 19-03
```

15 plans remaining. Each plan is self-contained and ready for `/gsd:execute-phase`.

---

*Roadmap created: 2026-04-06*
*v1.0 shipped: 2026-04-10*
*v2.0 shipped: 2026-04-11*
*v3.0 shipped: 2026-04-21*
*v4.0 started: 2026-04-21*
*v4.0 roadmap updated: 2026-04-24*
