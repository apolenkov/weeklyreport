# Requirements: CustomReport v4.0

**Defined:** 2026-04-21
**Core Value:** Лиды заполняют свои секции независимо через удобную форму, система автоматически собирает единый отчёт — без конфликтов редактирования, с историей и аналитикой.
**Milestone:** v4.0 Backend Completeness & UI Redesign
**Priority:** Backend-first, затем UI, затем E2E

---

## Backend Hardening

- [x] **BE-01**: Prisma migration aligns ReminderRule schema (kind/fireAt/timezone/status/version) with Zod contract
- [ ] **BE-02**: BullMQ re-enabled in AppModule (PDF export + email reminders functional)
- [x] **BE-03**: All 81 regression scenarios pass as API integration tests
- [ ] **BE-04**: MSW handlers updated to match current tRPC contracts (superjson serialization)
- [ ] **BE-05**: Pre-existing 24 jsdom test failures in web package fixed
- [ ] **BE-06**: ThemeProvider wired into layout.tsx (next-themes installed, not connected)

## UI Redesign

- [ ] **UI-01**: AssembledReport displays ALL projects and ALL items per section (functional defect)
- [ ] **UI-02**: Professional dark-theme design system on all pages (OKLCH tokens, consistent)
- [ ] **UI-03**: Navigation redesign: grouped items, active state, responsive sidebar
- [ ] **UI-04**: Lead form: dynamic add/remove with delete confirmations, auto-focus
- [ ] **UI-05**: Head dashboard: status cards, deadline countdown, portfolio overview
- [ ] **UI-06**: Admin panel: polished CRUD with Sonner toast on all mutations
- [ ] **UI-07**: Archive/history: card layout, month grouping, status badges
- [ ] **UI-08**: Print/PDF template consistent with web design
- [ ] **UI-09**: Focus-visible rings on all interactive elements (a11y)
- [ ] **UI-10**: Responsive mobile-first, touch targets min 44px

## E2E Tests

- [ ] **E2E-01**: Lead journey: login → auto-create → fill → draft → submit → locked
- [ ] **E2E-02**: Head journey: login → dashboard → review → publish → PDF
- [ ] **E2E-03**: Viewer journey: login → archive list → report detail
- [ ] **E2E-04**: Cross-role lifecycle: lead submits → head publishes → viewer reads
- [ ] **E2E-05**: Admin CRUD: user → project → period → reminder
- [ ] **E2E-06**: Error paths: invalid submit, 403 wrong role
- [ ] **E2E-07**: Visual regression baselines (Playwright screenshots)

---

## Deferred (v5.0+)

- Analytics/trends (pgvector, charts)
- Telegram/Slack notifications
- Real-time collaboration
- Jira/GitLab integration
- Mobile app
- AppShell centralization (server-side session)

## Out of Scope

- New tRPC endpoints — API contract complete (20+)
- New database models — schema stable (14 models)
- Package upgrades — stack current
- CI/CD pipeline changes

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BE-01 | Phase 16 | Complete |
| BE-02 | Phase 16 | Pending |
| BE-03 | Phase 16 | Complete |
| BE-04 | Phase 16 | Pending |
| BE-05 | Phase 16 | Pending |
| BE-06 | Phase 16 | Pending |
| UI-01 | Phase 17 | Pending |
| UI-02 | Phase 17 | Pending |
| UI-03 | Phase 17 | Pending |
| UI-04 | Phase 17 | Pending |
| UI-05 | Phase 17 | Pending |
| UI-06 | Phase 17 | Pending |
| UI-07 | Phase 17 | Pending |
| UI-08 | Phase 17 | Pending |
| UI-09 | Phase 17 | Pending |
| UI-10 | Phase 17 | Pending |
| E2E-01 | Phase 18 | Pending |
| E2E-02 | Phase 18 | Pending |
| E2E-03 | Phase 18 | Pending |
| E2E-04 | Phase 18 | Pending |
| E2E-05 | Phase 18 | Pending |
| E2E-06 | Phase 18 | Pending |
| E2E-07 | Phase 18 | Pending |

---

*Created: 2026-04-21*
