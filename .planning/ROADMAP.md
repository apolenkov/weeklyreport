# CustomReport Roadmap

**Project:** Team Status Reporting Web App
**Created:** 2026-04-06
**Granularity:** Coarse
**Coverage:** v1.0: 29/29 | v2.0: 55/55

---

## Milestones

- [x] **v1.0 Domain Logic** - Phases 1-4 (shipped 2026-04-10)
- [x] **v2.0 Infrastructure Integration** - Phases 5-7 (shipped 2026-04-11)
- [ ] **v3.0 UI Polish & Analytics** - Phases 8-15 (in progress)

## Phases

<details>
<summary>v1.0 Domain Logic (Phases 1-4) - SHIPPED 2026-04-10</summary>

- [x] **Phase 1: Core Report Capture** - Leads fill sections, head reviews submissions, data persists
- [x] **Phase 2: Report Assembly & Publication** - Portfolio overview auto-assembles, reports published to web, PDF export available
- [x] **Phase 3: Automation & Admin** - Email reminders, carry-over logic, admin panel, report history
- [x] **Phase 4: Production Hardening** - Hydration fixes, structured logging, design/E2E gaps

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

<details>
<summary>v3.0 UI Polish & Analytics (Phases 8-15) - IN PROGRESS</summary>

- [x] **Phase 8: Tooling Upgrades** - pnpm 10, Next.js 16, Vitest 4, ESLint 10
- [x] **Phase 9: Design System Foundation** - Tailwind v4, shadcn/ui, nav shell
- [x] **Phase 10: Page Styling** - All 8 pages restyled with design system
- [x] **Phase 11: PDF Styling** - Print CSS, hex fallbacks, styled print page
- [x] **Phase 12: E2E Tests & CI/CD** - Playwright config, 4 journey specs, GitHub Actions
- [ ] **Phase 13: Quality Assurance & Polish** - Bug fixes, regression tests, UX/UI review, accessibility, localization
- [ ] **Phase 14: SQL Analytics** - Trends, dashboard (ANAL-01..04)
- [ ] **Phase 15: Search & RAG** - tsvector + pgvector + chatbot (SEARCH-01..09)

</details>

## Active Phases

### Phase 13: Quality Assurance & Polish
**Goal**: Fix all 25 discovered bugs, generate comprehensive Vitest+Playwright tests from 1788 regression scenarios, conduct UX/UI review via Playwright screenshots and all available review skills, fix accessibility/localization gaps, and bring the product to professional quality level
**Depends on**: Phase 12
**Requirements**: QA-01, QA-02, QA-03, QA-04, QA-05, QA-06, QA-07, QA-08, QA-09
**Success Criteria** (what must be TRUE):
  1. All 25 discovered bugs (BUG-001..BUG-025) are fixed and verified
  2. Vitest unit tests cover all Zod schema boundaries, business rules, error mapping, state machines
  3. Playwright E2E tests cover all user journeys, error recovery, and visual regression
  4. UX/UI review completed: Playwright screenshots of every page state, accessibility audit (ARIA, keyboard nav), responsive check (320-1920px)
  5. Localization consistent: all dates in ru-RU, timezone-safe formatting, Russian UI labels where appropriate
  6. Print CSS gap fixed: -webkit-print-color-adjust: exact added, PDF renders with colored backgrounds
  7. All E2E tests pass in CI (GitHub Actions)
  8. Code committed and pushed to remote
**Plans**: 8 plans

Plans:
- [ ] 13-01-PLAN.md — Fix API-layer bugs (BUG-001,003,004,005,007,008,021,022,023,024)
- [ ] 13-02-PLAN.md — Fix schema-layer bugs (BUG-002,006,009,013,014,015,016)
- [x] 13-03-PLAN.md — Fix frontend-layer bugs (BUG-010,011,012,017,018,019,020,025)
- [ ] 13-04-PLAN.md — Vitest schema boundary tests (75+ test cases)
- [ ] 13-05-PLAN.md — Vitest service/integration tests for bug-fix branches
- [ ] 13-06-PLAN.md — UX/UI polish: ARIA, skeleton contrast, design tokens
- [ ] 13-07-PLAN.md — Playwright E2E journey expansion (30+ tests)
- [ ] 13-08-PLAN.md — Playwright visual regression, a11y audit, responsive tests

### Phase 14: SQL Analytics
**Goal**: PostgreSQL-native analytics with project health trends, submission timeliness metrics, and interactive dashboard
**Depends on**: Phase 13
**Requirements**: ANAL-01, ANAL-02, ANAL-03, ANAL-04
**Success Criteria** (what must be TRUE):
  1. SQL views compute project health trends (traffic light history over weeks)
  2. Submission timeliness API shows which leads submitted on time vs late
  3. Recharts dashboard with trend graphs, accessible to head role
  4. Role-gated access (head only for analytics)
**Plans**: TBD

### Phase 15: Search & RAG
**Goal**: Full-text search via tsvector, semantic search via pgvector, hybrid ranking, and chatbot interface
**Depends on**: Phase 14
**Requirements**: SEARCH-01, SEARCH-02, SEARCH-03, SEARCH-04, SEARCH-05, SEARCH-06, SEARCH-07, SEARCH-08, SEARCH-09
**Success Criteria** (what must be TRUE):
  1. tsvector + GIN index for full-text search across report items, risks, decisions
  2. pgvector embeddings for semantic search
  3. Hybrid RRF ranking combining text and vector results
  4. Search UI component with type-ahead
  5. RAG chatbot answering questions about historical reports
**Plans**: TBD

---

*Roadmap created: 2026-04-06*
*v1.0 shipped: 2026-04-10*
*v2.0 shipped: 2026-04-11*
*v3.0 Phases 8-12 completed: 2026-04-12*
