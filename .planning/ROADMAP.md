# CustomReport Roadmap

**Project:** Team Status Reporting Web App
**Created:** 2026-04-06
**Granularity:** Coarse
**Coverage:** v1.0: 29/29 | v2.0: 55/55 | v3.0: 47/47

---

## Milestones

- [x] **v1.0 Domain Logic** - Phases 1-4 (shipped 2026-04-10)
- [x] **v2.0 Infrastructure Integration** - Phases 5-7 (shipped 2026-04-11)
- [ ] **v3.0 UI Polish & Analytics** - Phases 8-14 (in progress)

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

---

### v3.0 UI Polish & Analytics (In Progress)

**Milestone Goal:** Turn functional prototype into a visually polished product with comprehensive E2E testing, modernized toolchain, and analytics over report history.

**Priority:** Styling is the #1 priority. Phases 9-11 are the bulk of the milestone.

- [ ] **Phase 8: Tooling Upgrades** - pnpm 10, Next.js 16, Vitest 4, ESLint 10; modernize monorepo conventions
- [ ] **Phase 9: Design System Foundation** - Tailwind v4 + shadcn/ui primitives in packages/ui; design tokens, shared components
- [ ] **Phase 10: Page Styling** - Restyle all 8 application pages using design system components
- [ ] **Phase 11: PDF Styling** - Print-specific CSS, color fallbacks, visual fidelity for exported reports
- [ ] **Phase 12: E2E Tests & CI/CD** - Playwright CLI full journey tests, GitHub Actions pipeline
- [ ] **Phase 13: SQL Analytics** - Project health trends, submission timeliness, analytics dashboard
- [ ] **Phase 14: Search & RAG** - Full-text search, pgvector embeddings, hybrid search, chatbot

## Phase Details

### Phase 8: Tooling Upgrades
**Goal**: Monorepo runs on current-generation toolchain; all existing tests and builds pass on upgraded dependencies
**Depends on**: Phase 7 (v2.0 complete)
**Requirements**: TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05
**Success Criteria** (what must be TRUE):
  1. `pnpm install` succeeds with pnpm 10; `onlyBuiltDependencies` allowlist includes prisma, playwright, esbuild
  2. `pnpm turbo build` compiles Next.js 16 app with Turbopack; proxy.ts replaces middleware.ts; async params work
  3. `pnpm turbo test` runs all existing unit tests on Vitest 4 without failures
  4. `pnpm turbo lint` runs ESLint 10 flat config with @typescript-eslint/strict rules; zero errors
  5. CLAUDE.md reflects actual installed versions (Next.js 16, Vitest 4, ESLint 10, pnpm 10)
**Plans**: 2 plans

Plans:
- [x] 08-01-PLAN.md — Migrate pnpm 9 to 10 and Next.js 15 to 16 (proxy.ts, React Compiler)
- [x] 08-02-PLAN.md — Upgrade Vitest 4, set up ESLint 10 flat config, update CLAUDE.md versions

### Phase 9: Design System Foundation
**Goal**: A working component library exists in packages/ui with design tokens and shadcn/ui primitives; any page can import and render styled components
**Depends on**: Phase 8
**Requirements**: DS-01, DS-02, DS-03, DS-04, DS-05, DS-06, DS-07, DS-08, DS-09
**Success Criteria** (what must be TRUE):
  1. Tailwind v4 `@theme` directive defines design tokens (colors, spacing, typography); dark/light mode toggle works
  2. `packages/ui` exports shadcn/ui primitives (Button, Input, Select, Card, Badge, Dialog, Table, Toast, Skeleton); importing any component in `apps/web` renders correctly with full styling
  3. Navigation shell renders on every page — sidebar with role-based menu items, header with user info and logout, responsive hamburger on mobile
  4. DataTable component renders tabular data with sorting; Card layout renders grouped content; Dialog/Sheet renders modal forms
  5. Toast notifications appear on mutation success/error; loading skeletons replace "Loading..." text during tRPC queries
**Plans**: 3 plans

Plans:
- [x] 09-01-PLAN.md — Initialize Tailwind v4, shadcn/ui component library, design tokens, and monorepo wiring
- [x] 09-02-PLAN.md — Build responsive navigation shell, QueryError styling, and skeleton patterns
- [x] 09-03-PLAN.md — Create DataTable, ConfirmDialog, CrudSheet, and TrafficLightBadge composition components

### Phase 10: Page Styling
**Goal**: Every application page uses the design system; users experience a cohesive, professional interface
**Depends on**: Phase 9
**Requirements**: PAGE-01, PAGE-02, PAGE-03, PAGE-04, PAGE-05, PAGE-06, PAGE-07, PAGE-08
**Success Criteria** (what must be TRUE):
  1. Lead sees a styled report form with traffic light selector badges, inline item/risk/decision editors, and priority ranking
  2. Head sees a styled dashboard with status badges per lead, progress indicators, and quick actions
  3. Published report renders as a professional read-only page with portfolio overview, section cards, and clean typography
  4. Archive page shows a filterable, sortable DataTable of past reports with date ranges and status indicators
  5. Admin panel renders Tabs for users/projects/periods/reminders with DataTable + Dialog CRUD; auth error and landing pages are styled consistently
**Plans**: 4 plans

Plans:
- [ ] 10-01-PLAN.md — Restyle lead report form (7 components: form container + 6 child editors)
- [ ] 10-02-PLAN.md — Restyle head dashboard and assembled report review
- [ ] 10-03-PLAN.md — Restyle published report viewer and archive history page
- [x] 10-04-PLAN.md — Restyle admin panel (Tabs + DataTable + CrudSheet), auth error, and landing page

### Phase 11: PDF Styling
**Goal**: The exported PDF report is a professional document that matches the web view quality and prints correctly
**Depends on**: Phase 10
**Requirements**: PDF-01, PDF-02, PDF-03
**Success Criteria** (what must be TRUE):
  1. PDF generated by Playwright has print-specific CSS: hidden navigation, page breaks between sections, header/footer with report metadata
  2. Traffic light colors render correctly in PDF using hex/rgb fallbacks (no oklch that fails in older PDF viewers)
  3. Tables, badges, and cards in the PDF are visually consistent with the browser view; the PDF is presentable to the director without manual editing
**Plans**: TBD
**UI hint**: yes

### Phase 12: E2E Tests & CI/CD
**Goal**: Automated tests cover the full user journey; CI pipeline runs on every push
**Depends on**: Phase 11
**Requirements**: E2E-01, E2E-02, E2E-03, E2E-04, E2E-05, E2E-06, CI-01, CI-02, CI-03
**Success Criteria** (what must be TRUE):
  1. Playwright config starts both Next.js and NestJS servers; Docker services (postgres + redis) run during tests
  2. Auth fixtures provide per-role sessions (lead, head, viewer) via dev-login endpoint; tests do not depend on Keycloak
  3. Lead journey E2E passes: login -> fill section -> save draft -> submit -> verify data persists
  4. Head journey E2E passes: login -> review dashboard -> view assembled report -> publish -> verify published page
  5. GitHub Actions workflow runs lint + typecheck + unit tests + E2E on every push/PR; Docker build verification succeeds
**Plans**: TBD

### Phase 13: SQL Analytics
**Goal**: Head and viewers can see project health trends and submission timeliness over time through an analytics dashboard
**Depends on**: Phase 10 (needs styled analytics page)
**Requirements**: ANAL-01, ANAL-02, ANAL-03, ANAL-04
**Success Criteria** (what must be TRUE):
  1. API returns traffic light history per project as time-series data (SQL aggregation over existing report data)
  2. API returns submission timeliness metrics showing when each lead submits relative to the deadline
  3. Analytics dashboard page renders charts (recharts) for project trends and submission statistics
  4. Dashboard is accessible to head and viewer roles; leads cannot access analytics
**Plans**: TBD
**UI hint**: yes

### Phase 14: Search & RAG
**Goal**: Users can search across report history using keywords and semantic similarity; a chatbot answers questions about past reports
**Depends on**: Phase 13
**Requirements**: SEARCH-01, SEARCH-02, SEARCH-03, SEARCH-04, SEARCH-05, SEARCH-06, SEARCH-07, SEARCH-08, SEARCH-09
**Success Criteria** (what must be TRUE):
  1. Full-text search with Russian morphology returns relevant items, risks, and decisions from report history
  2. pgvector extension is enabled; embeddings are generated via BullMQ job on report publish; semantic search returns similar reports/items
  3. Hybrid search combines keyword (tsvector) and semantic (pgvector) results using Reciprocal Rank Fusion; search UI in navigation shows highlighted matches
  4. Chatbot UI allows head/viewer to ask questions about report history; answers cite source reports
  5. All search/RAG features are feature-flagged via ANALYTICS_ENABLED; app works normally when disabled
**Plans**: TBD
**UI hint**: yes

---

## Progress

**Execution Order:** Phases execute in numeric order: 8 -> 9 -> 10 -> 11 -> 12 -> 13 -> 14

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Core Report Capture | v1.0 | 3/3 | Complete | 2026-04-07 |
| 2. Report Assembly | v1.0 | 3/3 | Complete | 2026-04-08 |
| 3. Automation & Admin | v1.0 | 4/4 | Complete | 2026-04-09 |
| 4. Production Hardening | v1.0 | 2/2 | Complete | 2026-04-10 |
| 5. Backend Foundation | v2.0 | 6/6 | Complete | 2026-04-10 |
| 6. Auth & Frontend | v2.0 | 6/6 | Complete | 2026-04-11 |
| 7. Production Infra | v2.0 | 3/3 | Complete | 2026-04-11 |
| 8. Tooling Upgrades | v3.0 | 2/2 | Complete | 2026-04-11 |
| 9. Design System | v3.0 | 3/3 | Complete | 2026-04-11 |
| 10. Page Styling | v3.0 | 1/4 | In Progress|  |
| 11. PDF Styling | v3.0 | 0/? | Not started | - |
| 12. E2E Tests & CI/CD | v3.0 | 0/? | Not started | - |
| 13. SQL Analytics | v3.0 | 0/? | Not started | - |
| 14. Search & RAG | v3.0 | 0/? | Not started | - |

---

*Roadmap created: 2026-04-06*
*v1.0 shipped: 2026-04-10*
*v2.0 shipped: 2026-04-11*
*v3.0 roadmap: 2026-04-11*
