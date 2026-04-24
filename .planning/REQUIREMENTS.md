# Requirements: CustomReport v4.0

**Defined:** 2026-04-21
**Updated:** 2026-04-22
**Core Value:** Лиды заполняют свои секции независимо через удобную форму, система автоматически собирает единый отчёт — без конфликтов редактирования, с историей и аналитикой.
**Milestone:** v4.0 Backend Completeness & UI Redesign
**Priority:** Mockup-first → Schema migration → Backend API → Frontend → E2E
**Spec Sources:** MANIFEST.md (D-1→D-70), REGRESSION-SCENARIOS.md (223 scenarios), mockup-v17-v14.html

---

## Backend Hardening (Phase 16 — COMPLETE)

- [x] **BE-01**: Prisma migration aligns ReminderRule schema (kind/fireAt/timezone/status/version) with Zod contract
- [x] **BE-02**: BullMQ re-enabled in AppModule (PDF export + email reminders functional)
- [x] **BE-03**: All 81 regression scenarios pass as API integration tests
- [x] **BE-04**: MSW handlers updated to match current tRPC contracts (superjson serialization)
- [x] **BE-05**: Pre-existing 24 jsdom test failures in web package fixed
- [x] **BE-06**: ThemeProvider wired into layout.tsx (next-themes installed, connected)

## Schema & Data Model (Phase 17 — NEW)

- [x] **SCH-01**: Period lifecycle states enum: Open, Published, Reopened (D-56)
- [x] **SCH-02**: Period `publishedAt`, `publishedBy`, `reopenedAt` fields
- [x] **SCH-03**: LeadSubmission `revokedAt`, `revokedBy` fields for Revoke Submit (D-57)
- [x] **SCH-04**: VersionSnapshot model — autosave snapshots per lead per period (D-67)
- [x] **SCH-05**: Stage assignment unique constraint (userId + stageId + productId) (D-63)
- [x] **SCH-06**: Period model extended: auto-create flag, default deadline settings (D-68 admin settings)
- [x] **SCH-07**: Migration preserves all existing v3 data without loss

## Backend API (Phase 17 — NEW)

- [x] **API-01**: `period.publish` — Publish & Lock: set period to Published, lock all lead forms (D-56)
- [x] **API-02**: `period.reopen` — Reopen: return period to Open state (D-56)
- [x] **API-03**: `leadSubmission.revoke` — Revoke: return specific lead's form to Draft (D-57)
- [x] **API-04**: `leadSubmission.requestReopen` — Lead requests reopen, notification to Head (D-56)
- [x] **API-05**: `report.weekly` — Auto-compiled Weekly Report from all submitted leads (D-58)
- [x] **API-06**: `report.weekly.byPeriod` — Historical Weekly Report by period param (D-66)
- [x] **API-07**: `leadForm.fillFrom` — Fill current form from past period's data (D-65)
- [x] **API-08**: `leadForm.versions` — List autosave version snapshots (D-67)
- [x] **API-09**: `leadForm.restoreVersion` — Restore to a specific version snapshot (D-67)
- [x] **API-10**: `leadForm.byPeriod` — Lead form data for specific period (read-only for past) (D-64)
- [x] **API-11**: `admin.settings` — CRUD for general settings (deadline, auto-create, department name) (D-68)
- [x] **API-12**: Stage assignment validation — reject duplicate user+stage+product (D-63)
- [x] **API-13**: Login stub — mock JWT with role selection, guarded by env flag (D-68)

## UI Redesign (Phase 17 — UPDATED)

- [x] **UI-01**: Lead Form — SDLC pipeline with 7 stages, product ownership, locked/editable stages (MANIFEST §2-3)
- [x] **UI-02**: Lead Form — period navigator (← combobox →), past periods read-only (D-64)
- [x] **UI-03**: Lead Form — "Fill from Previous" split button with searchable dropdown (D-65)
- [x] **UI-04**: Lead Form — version history (← v3 →) with diff preview and rollback (D-67)
- [x] **UI-05**: Dashboard — central hub: KPIs, Alert bar, Blocked & At Risk, Lead Reports, Report Archive (D-59)
- [x] **UI-06**: Dashboard — Lead Reports: own card clickable, others locked with 🔒, traffic light dots (D-62)
- [x] **UI-07**: Dashboard — Report Archive with pagination, integrated (no separate Archive page) (D-60)
- [x] **UI-08**: Dashboard — Toggle All button for collapsible sections
- [x] **UI-09**: Weekly Report — auto-compiled, period navigator, Toggle All, Export PDF, Publish & Lock (D-58)
- [x] **UI-10**: Weekly Report — per-lead accordions with full data (Current/Next Week, Risks, Decisions, Priorities)
- [x] **UI-11**: Admin Panel — 5 tabs: Users, Products, Periods, Reminders, Settings (D-63)
- [x] **UI-12**: Login — split-screen: PEO brand left, SSO/stub right, all English (D-61, D-68)
- [x] **UI-13**: Lead History — traffic light dots per report card
- [x] **UI-14**: URL-based routing — every state in URL, no SPA, query params for period/tab (D-69)
- [x] **UI-15**: Nav bar teal border constrained to content width (D-70)
- [x] **UI-16**: All pages: max-w-6xl standardized, padding uniform, alignment consistent
- [x] **UI-17**: Starbucks design system: cream canvas, teal primary, gold accents, Lexend + Source Sans 3
- [x] **UI-18**: Accessibility: skip-link, aria-labels, focus rings, touch targets 44px, reduced motion
- [x] **UI-19**: UI States: all modals/dialogs per mockup s7 (Submit, Publish, Reopen, Revoke, Fill, Version, etc.)
- [x] **UI-20**: Print/PDF template consistent with web design

## E2E Tests (Phase 18)

- [x] **E2E-01**: Lead journey: login stub → select period → fill all sections → submit → locked
- [x] **E2E-02**: Head journey: login → dashboard KPIs → weekly report → publish & lock → PDF
- [x] **E2E-03**: Admin journey: login → admin panel → CRUD users/products/periods/settings
- [x] **E2E-04**: Cross-role lifecycle: lead submits → head publishes → lead sees locked → head reopens
- [x] **E2E-05**: Revoke flow: admin revokes → lead re-edits → re-submits
- [x] **E2E-06**: Period navigation: lead switches periods → past read-only → current editable
- [x] **E2E-07**: Fill from: lead fills from Week 15 → warning on overwrite → data populated
- [x] **E2E-08**: Version history: autosave creates versions → rollback → linear discard
- [x] **E2E-09**: Error paths: 403 wrong role, 404 invalid period, network disconnect
- [x] **E2E-10**: Visual regression baselines (Playwright screenshots, 223 scenarios as reference)

---

## Deferred (v5.0+)

- Analytics/trends (pgvector, charts)
- Telegram/Slack notifications
- Real-time collaboration
- Jira/GitLab integration
- Mobile app
- Full Keycloak SAML SSO (replacing login stub)
- Dark theme

## Out of Scope for v4.0

- Real-time WebSocket updates
- Multi-department support
- i18n (UI stays English per D-61)
- Offline mode

---

## Traceability

| Requirement | Phase | MANIFEST | Scenarios | Status |
|-------------|-------|----------|-----------|--------|
| BE-01..06 | 16 | — | SC-01..SC-19 | Complete |
| SCH-01..07 | 17 | D-56,D-57,D-63,D-67,D-68 | SC-100..SC-116 | Complete |
| API-01..13 | 17 | D-56..D-68 | SC-100..SC-310 | Complete |
| UI-01..20 | 17 | D-01..D-70 | SC-01..SC-311 | Complete |
| E2E-01..10 | 18 | All | All 223 | Complete |

---

*Created: 2026-04-21*
*Updated: 2026-04-25 — all requirements complete (v4.0 milestone)*
