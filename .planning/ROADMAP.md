# CustomReport Roadmap

**Project:** Team Status Reporting Web App
**Created:** 2026-04-06
**Granularity:** Coarse
**Coverage:** v1.0: 29/29 | v2.0: 55/55 | v4.0: 46/46 | v5.0: 48/48 | v6.0: 37/37

---

## Milestones

- [x] **v1.0 Domain Logic** - Phases 1-4 (shipped 2026-04-10)
- [x] **v2.0 Infrastructure Integration** - Phases 5-7 (shipped 2026-04-11)
- [x] **v3.0 Progress** - Phases 13-15 (shipped 2026-04-21)
- [x] **v4.0 Backend Completeness & UI Redesign** - Phases 16-19 (shipped 2026-04-25)
- [x] **v5.0 Production Integration** - Phases 20-26 (shipped 2026-04-25) — [details](milestones/v5.0-ROADMAP.md)
- [ ] **v6.0 Roles, Quality, AI & Analytics** - Phases 27-31 (planning 2026-04-28)

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

<details open>
<summary>v6.0 Roles, Quality, AI & Analytics (Phases 27-31) - PLANNING 2026-04-28</summary>

- [ ] **Phase 27: Quality Stabilisation & Role Middleware Factory** - Integration suite green as CI gate; `requireRole` factory shipped with default-deny coverage test (Wave 1: B + A1)
- [ ] **Phase 28: Role Filters, PDF Cookie Seam, Deadline Reminders & Release Checklist** - Service-layer role filtering; PDF worker cookie injection; T-24h reminders + react-email templates; CHECKLIST.md template (Wave 2: A2 + A4 + E1+E3 + G)
- [ ] **Phase 29: Real Keycloak SAML, Role-Aware UI & Escalation** - Keycloak SAML in production; layout-level role gates; T+2h escalation digest with audit log (Wave 3a: A3 + A5 + A6 + E2)
- [ ] **Phase 30: Mobile Polish & Trend Analytics** - 7 pages clean at 375px; analytics tRPC procedures + `/reports/trends` charts (Wave 3b: F + D)
- [ ] **Phase 31: AI Insights** - Executive summary card + risk sentiment badges + on-track advisory (Wave 4: C — gated by AI-SPEC.md)

### Phase 27: Quality Stabilisation & Role Middleware Factory
**Goal**: Integration suite runs green as a true CI gate, and a default-deny `requireRole` factory is shipped so every subsequent phase can declare role-scoped procedures.
**Depends on**: Phase 26 (v5.0 closed)
**Requirements**: QA-01, QA-02, QA-03, QA-04, AUTH-03
**Success Criteria** (what must be TRUE):
  1. Playwright integration suite (`admin-crud`, `cross-role-lifecycle`, `lead-journey`, `status-risk-sync`) passes 3 consecutive runs against the dual-server config — single root cause for the 5 timeouts is identified, fixed, and documented (no per-test bandages).
  2. Fresh `pnpm install` on a clean checkout produces working `@prisma/client` types via `apps/api/package.json` postinstall (NOT root); `turbo.json` lists `prisma generate` as a `build` predecessor so CI runs that skip postinstall still produce types.
  3. `apps/web/src/proxy.ts` is deleted; `apps/web/proxy.ts` is the only proxy file and carries the comment `// Next.js 16 proxy.ts must live here, NOT under src/`.
  4. `period.contract.test.ts:65` `userId` is renamed `_userId` (TS6133 closed); `.planning/phases/22-*/22-VERIFICATION.md` frontmatter reads `status: passed`.
  5. `requireRole(allowed)` factory exists at `packages/shared/src/trpc/middleware/role.ts` and emits `leadProcedure` / `headProcedure` / `adminProcedure` / `viewerProcedure`; a coverage test fails CI if any tRPC procedure lacks an explicit role declaration (default-deny).
**Plans**: 5 plans
- [ ] 27-01-PLAN.md — QA-04 doc-sync (`_userId` rename + Phase 22 VERIFICATION status flip)
- [ ] 27-02-PLAN.md — QA-03 delete dead `apps/web/src/proxy.ts` + add CC-6 guard comment to active proxy
- [ ] 27-03-PLAN.md — QA-02 `prisma generate` postinstall hook in `apps/api/package.json` + turbo build predecessor
- [ ] 27-04-PLAN.md — AUTH-03 `requireRole` factory + 4 named procedures + default-deny coverage test
- [ ] 27-05-PLAN.md — QA-01 root-cause + fix of 5 Playwright integration timeouts (3 consecutive green runs)
**Plan note**: QA-03 must include the explicit `apps/web/src/proxy.ts` deletion path AND the comment in `apps/web/proxy.ts` in the same plan (CC-6 hinge — deleting the wrong file kills auth).

### Phase 28: Role Filters, PDF Cookie Seam, Deadline Reminders & Release Checklist
**Goal**: Role-scoped procedures land at the service layer, the PDF worker authenticates via short-lived cookie, leads receive T-24h reminders through react-email templates, and the release-day checklist is a commit-able artefact.
**Depends on**: Phase 27
**Requirements**: AUTH-04, AUTH-05, AUTH-01 (PDF-only enable; full Keycloak in Phase 29), NOTIF-01, NOTIF-03, NOTIF-04, REL-01, REL-02, REL-03, REL-04, REL-05
**Success Criteria** (what must be TRUE):
  1. `archive.list`, `archive.detail`, `weeklyReport.get` are viewer-scoped to `status: 'published'` at the Prisma `where` clause; `review.dashboard` becomes a `headProcedure`; service-level unit tests prove a `viewer` token cannot read `draft` reports.
  2. `requestPdfExport(reportId, requestedBy?, authToken)` signs a 5-minute scoped JWT at tRPC entry; `pdf-export.processor.ts:69-72` calls `page.context().addCookies(...)` before `page.goto`; PDF jobs succeed end-to-end against a running API that has `AUTH_DEV_MODE=false` and `AUTH_DEV_MODE_ALLOW_TEST=true`.
  3. `AUTH_DEV_MODE_ALLOW_TEST=true` mode exists and is the staging switch the integration suite uses; `AUTH_DEV_MODE=true` (legacy admin-only) still works behind a feature flag pending Phase 29 cut-over.
  4. Each lead with a `draft` `ReportSection` receives one T-24h `kind='deadline'` reminder per cycle via the existing BullMQ pipeline; idempotent on `${rule.id}:deadline:${cycleDate}:${recipientEmail}` dedupe key; HTML + plaintext multipart rendered from `apps/api/src/modules/email/templates/deadline.template.ts` (react-email `<Tailwind>`).
  5. `apps/api/src/modules/reminders/reminders.scheduler.ts` runs hourly via `@Cron`, reads `WHERE status='active' AND fireAt <= now()`, and dispatches via existing `requestReminderExecution` reusing the existing dedupeKey shape.
  6. `/CHECKLIST.md` template exists at repo root with sections (Functional Smoke, Auth, PDF, Email, Mobile, AI Insights, Analytics) + signoff line; each item maps 1:1 to a row in `.planning/REGRESSION-TEST-SCENARIOS.md` by ID; at least one item is gated by CI (e.g. `pnpm test:ai-eval`); `tools/handoff-sync.ts` regenerates HANDOFF.md `## Pending Manual Smoke` from unticked items.
**Plans**: TBD
**Plan note**: AUTH-01 (`AUTH_DEV_MODE_ALLOW_TEST=true` staging) and AUTH-05 (PDF cookie injection) MUST ship in the same plan — closing the cookie seam without staging the dev-mode switch causes silent 401 retry storms (CC-1 hinge). The full Keycloak SAML flip lives in Phase 29.

### Phase 29: Real Keycloak SAML, Role-Aware UI & Escalation
**Goal**: Production runs against the real Keycloak IdP with a four-role JWT, the UI hides what each role cannot reach, and missed deadlines page the head exactly once per cycle.
**Depends on**: Phase 28
**Requirements**: AUTH-01 (full Keycloak SAML in production), AUTH-02, AUTH-06, AUTH-07, AUTH-08, NOTIF-02, NOTIF-05, NOTIF-06
**Success Criteria** (what must be TRUE):
  1. Real Keycloak SAML SSO is the only authentication path in production; `AUTH_DEV_MODE` is removed from non-test code paths; the integration suite continues to pass against a mock IdP container declared in `docker-compose.test.yml`.
  2. JWT carries a `role` claim drawn from a Keycloak SAML attribute mapper (`lead` | `head` | `admin` | `viewer`); the SAML attribute mapper is verified to send `role`; `ctx.user.role` is populated for every tRPC procedure.
  3. `app-shell.tsx` hides `/admin` and `/head/*` for non-head users and `/lead/*` for viewers via `useSession()`; SSR layout files at `apps/web/src/app/(app)/{admin,head,lead,reports}/layout.tsx` read the session via `cookies()` + `auth.me` and render a `403` page if the role is missing (proxy.ts stays cookie-presence only).
  4. `AppLoggerImpl` emits structured audit events `{event, userId, role, attemptedRole?, ip}` for login success/fail, logout, and role-denied requests; an integration test asserts a viewer hitting `/admin` produces a `role-denied` audit line.
  5. Heads receive one T+2h `kind='escalation'` digest per cycle aggregating ALL leads still in `draft` 2h after deadline; idempotent on `${rule.id}:escalation:${cycleDate}:${recipientEmail}`; the digest is NOT opt-outable; lead `kind='deadline'` reminders ARE opt-outable per `User.notificationOptOut` flag.
  6. The `email-reminder` BullMQ queue enforces `{ max: 5, duration: 60_000 }` rate-limiting below corporate SMTP quota; failed deliveries land in DLQ with an admin-visible badge in the UI.
**Plans**: TBD
**Plan note**: AUTH-06 commits last in this phase — the navigation hide is cosmetic and must not ship before the layout-level gate (AUTH-07) and the SAML cut-over (AUTH-01) are both green, otherwise users see disabled links to pages they are still authorised to reach.

### Phase 30: Mobile Polish & Trend Analytics
**Goal**: All seven product pages are usable on a 375px viewport, and the head + viewers can see how traffic lights, velocity, and risk delta have moved across the last 12 periods.
**Depends on**: Phase 29
**Requirements**: MOB-01, MOB-02, MOB-03, MOB-04, MOB-05, MOB-06, MOB-07, ANAL-01, ANAL-02, ANAL-03, ANAL-04
**Success Criteria** (what must be TRUE):
  1. Playwright `mobile-ios` + `mobile-android` projects (using `devices['iPhone 14']` / `devices['Pixel 7']`) run against `/lead/report`, `/lead/history`, `/head/dashboard`, `/head/report`, `/reports/history`, `/reports/[reportId]`, `/admin/*` and assert no horizontal scroll at 375px width on each page.
  2. `packages/ui/src/components/ui/button.tsx` exposes a `size='touch'` variant (`h-11 min-w-11`) replacing `h-9` on mobile breakpoints so every tap target is ≥44px (iOS HIG); `head/dashboard` portfolio table converts to a card list at `md` and below; `admin/*` tabs convert to a native `<select>` at narrow widths; `lead/report` risk editor opens as full-screen `Dialog` on mobile; PDF preview is replaced by an "Open PDF" button on mobile; the top app shell renders a hamburger menu while keeping the brand mark visible.
  3. `analytics.trafficLightHistory({projectId?, leadId?, periodFrom, periodTo})` returns server-aggregated `[{periodStart: ISOString, status, projectId}]` via `GROUP BY` over `Report × ReportSection × ProjectStatus`, cached in Redis with 1h TTL, invalidated on `period.publish` and `period.reopen`.
  4. `analytics.leadVelocity` and `analytics.periodComparison` tRPC procedures return correctly-typed payloads sourced via Prisma `GROUP BY` and pass an integration test under both `TZ=Europe/Moscow` and `TZ=UTC` (server pre-formats ISO `YYYY-MM-DD` labels — no client-side `new Date()`).
  5. `/reports/trends` is a viewer-accessible RSC page that lazy-imports three client-boundary components from `apps/web/src/components/charts/` (`traffic-light-history.chart.tsx` sparkline of last 12 periods, `lead-velocity.chart.tsx` stacked bar, `period-comparison.chart.tsx` delta table) built on shadcn-ui Chart over `recharts`; null and zero are visually distinct (gaps vs zero-bars).
**Plans**: TBD
**UI hint**: yes

### Phase 31: AI Insights
**Goal**: Heads get a 2–3 sentence executive summary on each assembled report, every risk row carries a sentiment badge, and lead traffic-light cells show a smart on-track advisory icon — without any AI ever overwriting human content or changing a chosen colour.
**Depends on**: Phase 30 (and AI-SPEC.md)
**Requirements**: AI-01, AI-02, AI-03
**Success Criteria** (what must be TRUE):
  1. The assembled report renders a 2–3 sentence executive summary card ABOVE the head's narrative textarea (never overwriting it); the card is dismissible per session and exposes a head-only "Regenerate" button; computed by Haiku 4.5 via `betaZodTool` and cached read-through on `contentHash = sha256(JSON.stringify(reportContent))` so re-renders cost zero Anthropic tokens.
  2. Each Risk row carries a `low` / `medium` / `high` sentiment badge produced by Haiku 4.5 with a structured Zod tool output (no free-text); cached per Risk content hash; an `AiInsight` Prisma row records every call with `usage.{input,output,cache_creation,cache_read}_tokens` for cost-tracking.
  3. Lead traffic-light cells overlay a ✓ / ⚠ / ✗ on-track advisory icon ALONGSIDE (never replacing) the lead's chosen colour; computed by Sonnet 4.6 with pre-computed counts injected into the system prompt under `DO NOT change these numbers`; an eval-step CI threshold gates the prompt rubric (≥1024 tokens) against an 8–12 report golden-set signed off by the head.
  4. ESLint `no-restricted-imports` blocks raw Prisma usage in `apps/api/src/modules/ai/**`; logging middleware excludes `ai.*` procedures; a lint rule bans `logger.*` of `prompt` / `messages` / `response.content` inside the AI module; Anthropic data-retention is verified OFF.
**Plans**: TBD
**Plan note**: **Plan blocked until /gsd-ai-integration-phase 31 produces AI-SPEC.md.** Decisions required: cost-vs-confidentiality (hosted vs on-prem), model assignment confirmation (Haiku 4.5 / Sonnet 4.6 — Opus 4.7 explicitly NOT used), prompt rubric ≥1024 tokens, golden-set fixtures (8–12 reports), eval-step CI threshold.
**AI hint**: yes

</details>

---

*Roadmap created: 2026-04-06*
*v1.0 shipped: 2026-04-10*
*v2.0 shipped: 2026-04-11*
*v3.0 shipped: 2026-04-21*
*v4.0 shipped: 2026-04-25*
*v5.0 shipped: 2026-04-25*
*v6.0 planning started: 2026-04-28*
