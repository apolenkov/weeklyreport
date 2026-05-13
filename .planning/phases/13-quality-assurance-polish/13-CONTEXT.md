# Phase 13: Quality Assurance & Polish - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning
**Source:** Regression Test Analysis (1788 scenarios, 25 bugs found)

<domain>
## Phase Boundary

This phase transforms the functional CustomReport app into a production-quality product by:

1. Fixing all discovered bugs from regression analysis
2. Adding comprehensive test coverage (Vitest unit + Playwright E2E)
3. Conducting UX/UI review and fixing accessibility/localization/visual gaps
4. Ensuring all E2E tests pass in CI

**Input artifacts:**

- `.planning/REGRESSION-TEST-SCENARIOS.md` — 1788 scenarios in 48 categories
- BUG-001..BUG-025 — discovered bugs with severity and location

</domain>

<decisions>
## Implementation Decisions

### Bug Fixes (BUG-001..BUG-025) — ALL LOCKED

**P0 bugs (must fix first):**

- BUG-001: saveDraft must check parent report's published status before allowing edits
- BUG-002: Add Zod refinement for unique priority ranks in submitSectionSchema
- BUG-003: Carry-over must use findMany (not findFirst) to process ALL sections
- BUG-004: Carry-over Prisma repo must check existingExecution before create()
- BUG-010: Add `-webkit-print-color-adjust: exact` to print CSS
- BUG-011: Add try/catch to autosave useEffect
- BUG-012: Add try/catch to handleConfirmSubmit
- BUG-021: Logout must use AUTH_JWT_COOKIE_NAME env (not hardcoded)
- BUG-022: PDF processor must set auth cookie before Playwright navigation

**P1 bugs:**

- BUG-005: Add markExportFailed method and wire to BullMQ onFailed
- BUG-006: Expand carryOverStatusSchema to include pending/failed
- BUG-007: Fix toRuleDomain to read kind from DB field (not hardcode 'deadline')
- BUG-008: Fix removeUser to actually delete from DB (not just in-memory)
- BUG-009: Change JWT activeReportId to nullable().optional() or ensure null is always explicit
- BUG-013: Add Zod .trim() or .refine() to reject zero-width-space-only strings
- BUG-014: Add Zod .refine() to reject null bytes in text fields
- BUG-015: Add .max(100) to items/risks/decisions arrays
- BUG-017: Standardize all date formatting to ru-RU locale
- BUG-018: Add timeZone: 'UTC' to all period date formatters
- BUG-019: Add tabIndex + onKeyDown to DataTable sortable headers
- BUG-020: Remove toSubmitInput fallback to 'red' — let validation catch null
- BUG-023: Fix reminder dedupeKey to include recipientEmail
- BUG-024: Guard head item edit against empty items array
- BUG-025: Replace RoleNav <a> with Next.js <Link> for client-side navigation

### Vitest Unit Tests — LOCKED

- Schema boundary tests (ZOD-001..080 + EDGE-BV scenarios)
- Business logic tests (carry-over, submit validation, portfolio overview, error mapping)
- Service tests (state machines, concurrency guards)
- Target: cover every if-branch in services

### Playwright E2E Tests — LOCKED

- Expand existing 4 journeys with edge cases from regression scenarios
- Add visual regression screenshots of every page state (loading, error, empty, populated, submitted, published)
- Add accessibility audit (keyboard navigation, ARIA attributes)
- Add responsive checks (320px, 375px, 768px, 1024px, 1920px)

### UX/UI Polish — LOCKED

- Fix A11Y gaps: sidebar <nav> landmark, aria-current on desktop nav, aria-disabled on read-only groups
- Fix skeleton contrast (accent vs background nearly invisible)
- Fix dark mode gap (add token overrides or explicitly disable)
- Fix hardcoded green/destructive in decisions-editor (use design tokens)
- Add -webkit-print-color-adjust: exact for PDF backgrounds

### Localization — LOCKED

- All dates: ru-RU with timeZone: 'UTC' for period dates
- Validation messages: keep English (API layer, not user-facing in practice)
- UI labels: keep English (explicit decision — project uses English UI)

### Claude's Discretion

- Test file organization (directory structure, naming conventions)
- Test utilities and fixtures (shared helpers)
- Exact Playwright screenshot breakpoints
- Which additional ARIA attributes to add beyond identified gaps
- Whether to add visual regression comparison (baseline screenshots)

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Regression Scenarios

- `.planning/REGRESSION-TEST-SCENARIOS.md` — Full 1788-scenario test plan with priorities

### Existing Tests

- `apps/web/e2e/` — Existing Playwright E2E tests (4 journeys)
- `apps/web/playwright.config.ts` — Playwright configuration
- `apps/api/src/**/*.spec.ts` — Existing Vitest unit tests

### Bug Locations

- `apps/api/src/modules/report-sections/` — BUG-001 (saveDraft immutability)
- `apps/api/src/modules/carry-over/` — BUG-003, BUG-004 (findFirst, idempotency)
- `apps/api/src/modules/pdf-export/` — BUG-005, BUG-022 (markFailed, auth cookie)
- `apps/api/src/modules/reminders/` — BUG-007, BUG-023 (kind, dedupeKey)
- `apps/api/src/modules/admin/` — BUG-008 (removeUser)
- `apps/api/src/modules/auth/auth.routes.ts` — BUG-021 (logout cookie name)
- `packages/shared/src/schemas/` — BUG-002, BUG-006, BUG-009, BUG-013, BUG-014, BUG-015
- `packages/ui/src/styles/globals.css` — BUG-010 (print-color-adjust)
- `packages/ui/src/components/ui/data-table.tsx` — BUG-019 (keyboard sort)
- `apps/web/src/components/report-section/report-section-form.tsx` — BUG-011, BUG-012, BUG-020
- `apps/web/src/components/navigation/role-nav.tsx` — BUG-025 (<a> vs <Link>)
- `apps/web/src/components/head/assembled-report-review.tsx` — BUG-024 (empty items)

### Design System

- `packages/ui/src/styles/globals.css` — OKLCH tokens, print fallbacks
- `packages/ui/src/styles/traffic-lights.css` — Traffic light colors

</canonical_refs>

<specifics>
## Specific Ideas

- Use Playwright `page.screenshot()` for visual regression of every page state
- Use `@axe-core/playwright` for automated accessibility audit
- Group Vitest tests by module (report-sections, carry-over, admin, etc.)
- Run bug fixes as Wave 1, tests as Wave 2, UX polish as Wave 3

</specifics>

<deferred>
## Deferred Ideas

- Full i18n framework (react-intl/next-intl) — overkill for internal tool
- Dark mode implementation — defer until user requests
- Performance benchmarking — defer to production deployment
- Storybook for design system — defer, not enough components to justify

</deferred>

---

_Phase: 13-quality-assurance-polish_
_Context gathered: 2026-04-12 via regression analysis_
