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
- [ ] **v5.0 Production Integration** - Phases 20-26 (in progress)

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

## v5.0 Production Integration

- [x] **Phase 20: Seed & Type Foundation** - Seed DB with mockup-aligned data, mapper layer for type translation (completed 2026-04-25)
- [x] **Phase 21: tRPC Provider & Client Wiring** - TRPCProvider, React Compiler migration, 7 container conversions (completed 2026-04-25)
- [ ] **Phase 22: Interactivity & Status-Risk Sync** - All buttons wired to real mutations, autosave, pagination, Status-to-Risk auto-sync
- [ ] **Phase 23: PDF & Jobs** - BullMQ re-enabled, PDF export pipeline end-to-end
- [ ] **Phase 24: Auth Guards & Session** - proxy.ts cookie check, 401 interceptor, session context
- [ ] **Phase 25: Production Logging** - Correlation IDs via nestjs-cls, structured file logging with rotation
- [ ] **Phase 26: E2E Integration Tests** - Dual-server Playwright config, 20-30 real API integration tests

### Phase 20: Seed & Type Foundation
**Goal**: Database contains mockup-aligned seed data and a tested mapper layer translates between API types and presentation types
**Depends on**: Phase 19 (v4.0 complete)
**Requirements**: SEED-01, SEED-02, SEED-03, SEED-04, SEED-05, TYPE-01, TYPE-02, TYPE-03
**Success Criteria** (what must be TRUE):
  1. Running `pnpm prisma db seed` populates 12 products, 6 leads, 7 SDLC stages, and 2 report periods with realistic data -- names match the mockup exactly
  2. DEV_SESSION UUIDs in trpc.context.ts match the seeded user and report IDs -- tRPC queries return non-empty data
  3. Running the seed a second time produces no duplicates and no errors (idempotent)
  4. Mapper functions convert every API enum value to its presentation equivalent and back (green to on-track, etc.) with unit tests covering each mapping
  5. Computed states (pending, planned) are correctly derived from DB data by the mapper layer -- not stored as enum values
**Plans**: 2 plans

Plans:
- [ ] 20-01-PLAN.md — Seed data: 12 products, 6 leads, 7 stages, 2 periods + DEV_SESSION context fix
- [x] 20-02-PLAN.md — Type mappers: traffic-light, item-status, lead-status with unit tests

### Phase 21: tRPC Provider & Client Wiring
**Goal**: Frontend fetches all data from the real API through tRPC hooks; every page renders server data with loading and error states
**Depends on**: Phase 20
**Requirements**: TRPC-01, TRPC-02, TRPC-03, TRPC-04, TRPC-05, TRPC-06, TRPC-07
**Success Criteria** (what must be TRUE):
  1. Opening any app page fetches data from PostgreSQL via tRPC -- no mock-data imports remain in the 7 container components
  2. Each page shows a skeleton/loading state while data loads and a toast notification on API errors
  3. The tRPC client uses @trpc/tanstack-react-query (not classic @trpc/react-query) with superjson -- Date objects roundtrip correctly
  4. Cache invalidation works: submitting a form and navigating to dashboard shows updated data without manual refresh
  5. `pnpm typecheck` passes clean across the monorepo after all container migrations
**Plans**: 4 plans

Plans:
- [x] 21-01-PLAN.md — Provider + tanstack-react-query swap + cache-keys + error boundary (Wave 1)
- [x] 21-02-PLAN.md — Lead History migration: smallest container proof-of-life (Wave 2)
- [x] 21-03-PLAN.md — Admin Panel (5 tabs) + Dashboard read-path migration (Wave 2)
- [x] 21-04-PLAN.md — Lead Form + Weekly Report + reports/[reportId] migrations (Wave 3, after 21-03 to avoid mappers/index.ts conflict)
**UI hint**: yes

### Phase 22: Interactivity & Status-Risk Sync
**Goal**: Every button in the application triggers a real API mutation; stage status changes automatically create risk entries and vice versa
**Depends on**: Phase 21
**Requirements**: INT-01, INT-02, INT-03, INT-04, INT-05, INT-06, INT-07, INT-08, INT-09, INT-10, SYNC-01, SYNC-02, SYNC-03, SYNC-04
**Success Criteria** (what must be TRUE):
  1. Lead can submit section (form locks), head can Publish & Lock (period becomes immutable), head can Revoke (section unlocks for re-edit) -- all through real API
  2. Fill From loads previous period data into the form; Version History shows snapshots and Restore replaces current draft
  3. Autosave persists draft changes every 3-5 seconds via debounced mutation; leaving an unsaved form triggers a browser warning
  4. Setting a stage to At Risk or Blocked auto-creates a risk row; filling a risk offers to update the stage status (with user confirmation); SyncSource flag prevents loops
  5. Admin CRUD operations (users, products, stages, periods, settings) persist through real tRPC mutations with immediate UI feedback
**Plans**: TBD
**UI hint**: yes

### Phase 23: PDF & Jobs
**Goal**: Users can export published reports as PDF files through an async job pipeline
**Depends on**: Phase 21
**Requirements**: PDF-01, PDF-02, PDF-03
**Success Criteria** (what must be TRUE):
  1. BullMQ is re-enabled and the PDF export queue processes jobs (confirmed via Bull Board or health endpoint)
  2. Clicking Export PDF on a published report triggers a tRPC mutation that enqueues a BullMQ job; Playwright renders the report to PDF
  3. User sees a progress indicator (generating, ready) and can download the completed PDF file
**Plans**: TBD
**UI hint**: yes

### Phase 24: Auth Guards & Session
**Goal**: Unauthenticated users are redirected to login; session context is available throughout the application
**Depends on**: Phase 20 (seed must exist for dev session)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):
  1. Visiting any /app route without a session cookie redirects to /login; after login, user returns to the originally requested URL
  2. AUTH_STUB=true bypasses all auth checks -- the application works identically to pre-auth behavior for development and testing
  3. When a session expires mid-use, the next API call triggers a redirect to /login with the current URL preserved as return path
  4. Session context (user name, role, avatar) is available in all (app)/ layouts -- the NavBar displays the logged-in user
**Plans**: TBD

### Phase 25: Production Logging
**Goal**: Every API request is traceable through structured, file-persisted logs with correlation IDs
**Depends on**: Nothing (independent backend track, can run parallel with Phases 22-23)
**Requirements**: LOG-01, LOG-02, LOG-03, LOG-04, LOG-05
**Success Criteria** (what must be TRUE):
  1. Every tRPC request/response is logged with procedure name, userId, duration, and a correlation ID that is consistent across the entire request lifecycle
  2. Logs are written to files (not just console) in structured JSON format with timestamp, level, correlationId, and module fields
  3. Log files rotate by size or time and old files are archived automatically
  4. Searching logs by correlationId returns all log entries for a single user request across all services and middleware
**Plans**: TBD

### Phase 26: E2E Integration Tests
**Goal**: Core user journeys are verified end-to-end against the real API with Playwright; existing mock-based tests are preserved
**Depends on**: Phase 22, Phase 23, Phase 24, Phase 25
**Requirements**: E2E-01, E2E-02, E2E-03, E2E-04, E2E-05, E2E-06, E2E-07
**Success Criteria** (what must be TRUE):
  1. Playwright config starts both API and Web servers; tests run against real PostgreSQL with seeded data
  2. Lead journey passes end-to-end: login -> fill all sections -> submit -> form locks -> data persists in DB
  3. Head journey passes end-to-end: dashboard shows submissions -> weekly report compiles -> publish & lock -> PDF downloads
  4. Cross-role lifecycle passes: lead submits -> head publishes -> lead sees locked -> head reopens -> lead re-edits
  5. Existing 339 mock-based E2E tests continue to pass unchanged (no big-bang migration)

**Plans**: TBD

---

## Progress Table -- v5.0

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 20. Seed & Type Foundation | 1/2 | Complete    | 2026-04-25 |
| 21. tRPC Provider & Client Wiring | 4/4 | Complete    | 2026-04-25 |
| 22. Interactivity & Status-Risk Sync | 0/TBD | Not started | - |
| 23. PDF & Jobs | 0/TBD | Not started | - |
| 24. Auth Guards & Session | 0/TBD | Not started | - |
| 25. Production Logging | 0/TBD | Not started | - |
| 26. E2E Integration Tests | 0/TBD | Not started | - |

## Execution Order (for /gsd:next)

```
20 -> 21 -> 22 -> 23 -> 24 -> 25 -> 26
```

Phases 24 and 25 are independent of 22-23 (can run in parallel if needed), but execute sequentially for a solo developer. Phase 26 depends on all preceding phases.

---

*Roadmap created: 2026-04-06*
*v1.0 shipped: 2026-04-10*
*v2.0 shipped: 2026-04-11*
*v3.0 shipped: 2026-04-21*
*v4.0 shipped: 2026-04-25*
*v5.0 roadmap created: 2026-04-25*
