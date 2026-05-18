# CustomReport v8.2 Requirements

**Milestone:** v8.2 — GSD Closure & Quality
**Date:** 2026-05-18
**Source:** `.planning/v8.1-MILESTONE-AUDIT.md` (TD-01..06) + verification gap analysis + approved plan `pure-mist.md`

---

## v8.2 Requirements

### Verification Closure (Phase 67)

- [ ] **VER-01**: All 5 phases with verification gaps (P14, P16, P35, P37, P39) reach `status: passed` in their VERIFICATION.md files
- [ ] **VER-02**: Phase 14 (Backend Containerization) — gaps from audit closed or retired with documented rationale
- [ ] **VER-03**: Phase 16 (Backend Hardening) — SC2 PDF runtime gap retired (low ROI vs manual PDF flow) with SUMMARY.md rationale
- [ ] **VER-04**: Phase 35 (UX Polish) — hover geometry + activity drill-down regression gaps closed
- [ ] **VER-05**: Phase 37 (Observability) — metrics/traces validation evidence provided or retired
- [ ] **VER-06**: Phase 39 (Performance) — k6/perf benchmarks evidence provided or retired
- [ ] **VER-07**: V1 todo (skeleton/right-rail smoke) addressed or explicitly deferred with rationale
- [ ] **VER-08**: V3 todo (DevRoleSwitcher prod guard) verified or explicitly deferred
- [ ] **VER-09**: V5 todo (admin group-period wipe/preview UX decision) documented

### Tech Debt Sweep (Phase 68)

- [ ] **TD-01**: `scopeDenied` audit event wired in Phase 46-05 audit emit path
- [ ] **TD-02**: Prisma cross-group integration matrix test added (Phase 46-05)
- [ ] **TD-03**: `search.service.ts:63` refactored to use canonical `groupScopeFilter` helper
- [ ] **TD-04**: Playwright e2e spec for ReminderPolicy editor UI flow created (Phase 44)
- [ ] **TD-05**: Performance test for `PolicyApplicatorService` fan-out with many active policies (Phase 47)
- [ ] **TD-06**: `PolicyApplicatorService` injected in `period.service.ts` + `period-creator.scheduler.ts`; `.applyToPeriod()` called after `prisma.report.create(...)` (line 119 in scheduler)

### E2E Coverage (Phase 69)

- [ ] **E2E-01**: `admin-advanced.spec.ts:358` describe.skip SC-227 (Create New Period) resolved or retired with documented reason
- [ ] **E2E-02**: `admin-advanced.spec.ts:422` describe.skip SC-228 (Period Date Entry) resolved or retired
- [ ] **E2E-03**: `admin-panel.spec.ts:118` describe.skip (Admin Panel — Periods Tab) resolved or retired
- [ ] **E2E-04**: Critical-path TODO stubs implemented: Reopen+Revoke flow (`publish-revoke.spec.ts`, 11 stubs)
- [ ] **E2E-05**: Critical-path TODO stubs implemented: page-title / Esc / focus-trap (`a11y-advanced.spec.ts`, 7 stubs)
- [ ] **E2E-06**: `lead-form-foreign-author.spec.ts` runs in regression config and passes
- [ ] **E2E-07**: `e2e/README.md` created with mandatory vs advisory scenario inventory (V4 todo)

### Planning Hygiene (Phase 70)

- [ ] **HYG-01**: 7 historical plans moved from `.planning/plans/` to `.planning/plans/done/`
- [ ] **HYG-02**: `.planning/todos/pending/2026-05-18-lock-icon-foreign-section.md` moved to `done/`
- [ ] **HYG-03**: `.png` artefacts from repo root moved to `.planning/ui-reviews/2026-05-17-18/`
- [ ] **HYG-04**: `NEXT-ACTIONS.md` refreshed with current timestamp and accurate items
- [ ] **HYG-05**: `TODO(HEAD-CONSOLIDATE-01)` resolved — redirect `/head/slides → /head/history?mode=slides`
- [ ] **HYG-06**: `TODO(UFB-061)` — version surfacing in login footer via `NEXT_PUBLIC_APP_VERSION` build-time inject
- [ ] **HYG-07**: Phase 43 GAP-01 — retroactive SUMMARY.md created in `.planning/phases/43-tooling-leaf-fix-sweep/`

### Coming Soon Visibility (Phase 71)

- [ ] **CS-01**: Shared `<ComingSoonCard>` component created in `packages/ui` with `feature`, `role`, `icon`, `title`, `description`, `status` props
- [ ] **CS-02**: Role-gate logic: component renders only when current user role is in the `role` prop array
- [ ] **CS-03**: AI Integration card (`settings-tab.tsx:1140`) migrated to shared component
- [ ] **CS-04**: Telegram cards (`settings-tab.tsx:1033,1071`) migrated to shared component
- [ ] **CS-05**: Slack integration card (`settings-tab.tsx:1114`) migrated to shared component
- [ ] **CS-06**: Draft version history sidebar (`lead-history-sidebar.tsx:128,157`) migrated to shared component
- [ ] **CS-07**: Language switcher parked badge (`nav-bar.tsx:184`) migrated to shared component
- [ ] **CS-08**: Screenshots of Coming Soon cards captured to `.planning/ui-reviews/v8.2/`

---

## Out of Scope (v8.2)

| Feature                       | Why deferred                                   |
| ----------------------------- | ---------------------------------------------- |
| AI/RAG activation (P54)       | Budget, LLM choice not made                    |
| Telegram bot activation (P55) | Bot identity, auth binding                     |
| Dark mode / rebrand (P40)     | UX research, brand decisions                   |
| CSP/k8s deploy (P53)          | Infra cost, k8s ops                            |
| Multi-org hierarchy (P59)     | BU model decision pending                      |
| i18n / language switching     | Translation lane not started                   |
| CI/CD расширения beyond P38   | auto-deploy/GitOps/matrix builds — infra scope |
| Slack integration activation  | Slack app registration pending                 |

---

## Traceability

| REQ-ID     | Phase    |
| ---------- | -------- |
| VER-01..09 | Phase 67 |
| TD-01..06  | Phase 68 |
| E2E-01..07 | Phase 69 |
| HYG-01..07 | Phase 70 |
| CS-01..08  | Phase 71 |
