# CustomReport Roadmap

**Project:** Team Status Reporting Web App
**Created:** 2026-04-06
**Granularity:** Coarse
**Coverage:** v1.0: 29/29 | v2.0: 55/55 | v4.0: 46/46 | v5.0: 48/48

---

## Milestones

- [x] **v1.0 Domain Logic** - Phases 1-4 (shipped 2026-04-10)
- [x] **v2.0 Infrastructure Integration** - Phases 5-7 (shipped 2026-04-11)
- [x] **v3.0 Progress** - Phases 13-15 (shipped 2026-04-21)
- [x] **v4.0 Backend Completeness & UI Redesign** - Phases 16-19 (shipped 2026-04-25)
- [x] **v5.0 Production Integration** - Phases 20-26 (shipped 2026-04-25) — [details](milestones/v5.0-ROADMAP.md)

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
- [x] **Phase 6: Auth & Frontend Integration** - SAML SSO, JWT sessions, localStorage->tRPC migration, 27 tests
- [x] **Phase 7: Production Infrastructure** - BullMQ jobs, Docker Compose, health/metrics, graceful shutdown

Full details: [v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md)

</details>

---

<details>
<summary>v3.0 Progress (Phases 13-15) - SHIPPED 2026-04-21</summary>

### Phase 13: Quality Assurance & Polish

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

### Phase 14: Backend Hardening & Containerization

Plans:
- [x] 14-01-PLAN.md -- Unit tests for BullMQ processors and tRPC auth middleware
- [x] 14-02-PLAN.md -- Docker image optimization and production docker-compose.prod.yml
- [x] 14-03-PLAN.md -- CI pipeline integration tests, test script updates, full suite verification

### Phase 15: UI/UX Polish & Visual Verification

Plans:
- [x] 15-01-PLAN.md -- Fix Vitest JSX transform, create EmptyState component
- [x] 15-02-PLAN.md -- P3 navigation fixes: nav grouping, logout POST, collapsed padding
- [x] 15-03-PLAN.md -- Expand Playwright visual baselines to ~12 pages

</details>

---

<details>
<summary>v4.0 Backend Completeness & UI Redesign (Phases 16-19) - SHIPPED 2026-04-25</summary>

- [x] **Phase 16: Backend Hardening** - Prisma migration, BullMQ re-enabled, 81 regression scenarios pass (completed 2026-04-21)
- [x] **Phase 17: Fullstack UI Redesign** - Schema + API + Frontend per mockup v14, 6 waves (completed 2026-04-24)
- [x] **Phase 18: E2E Tests** - 223 regression scenarios as Playwright tests, 7 plans (completed 2026-04-24)
- [x] **Phase 19: Documentation** - API reference, deployment guide, developer + user docs (completed 2026-04-24)

### Phase 16: Backend Hardening
**Goal**: Backend fully conforms to all API contracts; BullMQ queues functional; test infrastructure clean
**Depends on**: Phase 15
**Requirements**: BE-01, BE-02, BE-03, BE-04, BE-05, BE-06
**Plans**: 4/4 complete

Plans:
- [x] 16-01-PLAN.md -- Prisma migration (ReminderRule schema alignment) + Zod reportId nullable
- [x] 16-02-PLAN.md -- BullMQ re-enablement + health indicator + Docker fixes
- [x] 16-03-PLAN.md -- ThemeProvider wiring + theme toggle + MSW/web test verification
- [x] 16-04-PLAN.md -- Regression contract tests (P0/P1 scenarios)

### Phase 17: Fullstack UI Redesign (Schema + API + Frontend)
**Goal**: Complete application rewrite driven by mockup v14 -- new data model, 13 new API endpoints, 7 frontend pages (Starbucks design)
**Depends on**: Phase 16
**Requirements**: SCH-01..07, API-01..13, UI-01..20
**Plans**: 7/7 complete
**UI hint**: yes

Plans:
- [x] 17-01-PLAN.md -- Index & overview
- [x] 17-02-PLAN.md -- Wave 1: Schema migration + Login stub + URL routing
- [x] 17-03-PLAN.md -- Wave 2: Remaining API endpoints + service tests
- [x] 17-04-PLAN.md -- Wave 3: Lead Form + Lead History UI
- [x] 17-05-PLAN.md -- Wave 4: Dashboard + Weekly Report UI
- [x] 17-06-PLAN.md -- Wave 5: Admin Panel + Login + Design Polish
- [x] 17-07-PLAN.md -- Wave 6: Print/PDF + Integration Tests

### Phase 18: E2E Tests
**Goal**: 223 regression scenarios as Playwright E2E tests covering all role journeys
**Depends on**: Phase 17
**Requirements**: E2E-01..E2E-10
**Plans**: 7/7 complete

Plans:
- [x] 18-01-PLAN.md -- Auth fixtures + Lead journey
- [x] 18-02-PLAN.md -- Head journey: dashboard + weekly report + PDF
- [x] 18-03-PLAN.md -- Admin journey
- [x] 18-04-PLAN.md -- Cross-role lifecycle + Revoke
- [x] 18-05-PLAN.md -- Period nav + Fill From + Version History
- [x] 18-06-PLAN.md -- Error paths + edge cases
- [x] 18-07-PLAN.md -- Visual regression baselines + accessibility

### Phase 19: Documentation
**Goal**: Complete project documentation for handoff
**Depends on**: Phase 17, Phase 18
**Requirements**: DOC-01..DOC-03
**Plans**: 3/3 complete

Plans:
- [x] 19-01-PLAN.md -- API reference documentation
- [x] 19-02-PLAN.md -- Deployment guide
- [x] 19-03-PLAN.md -- Developer onboarding + User guide

</details>

---

<details>
<summary>v5.0 Production Integration (Phases 20-26) - SHIPPED 2026-04-25</summary>

- [x] **Phase 20: Seed & Type Foundation** - Mockup-aligned seed (12 products, 6 leads, 7 stages, 2 periods, idempotent) + mapper layer with 27 tests
- [x] **Phase 21: tRPC Provider & Client Wiring** - TRPCProvider + tanstack-react-query, 7 container migrations, +99 tests
- [x] **Phase 22: Interactivity & Status-Risk Sync** - 72 buttons wired, autosave, cursor pagination, SyncSource ref pattern, +156 tests
- [x] **Phase 23: PDF & Jobs** - BullMQ + Playwright + /pdfs static mount + ExportPdfButton with polling, +37 tests
- [x] **Phase 24: Auth Guards & Session** - proxy.ts cookie guard + SessionProvider + 401 interceptor + open-redirect sanitization, +16 tests
- [x] **Phase 25: Production Logging** - nestjs-cls + correlation IDs + async file rotation + tRPC request/response logging, 398/398 api unit tests
- [x] **Phase 26: E2E Integration Tests** - Dual-server Playwright config + 21 integration tests across 7 specs, 339 mock tests preserved

Full details: [v5.0-ROADMAP.md](milestones/v5.0-ROADMAP.md)

Audit status: tech_debt — structurally complete, runtime smoke verification deferred per user.

</details>

---

*Roadmap created: 2026-04-06*
*v1.0 shipped: 2026-04-10*
*v2.0 shipped: 2026-04-11*
*v3.0 shipped: 2026-04-21*
*v4.0 shipped: 2026-04-25*
*v5.0 shipped: 2026-04-25*
