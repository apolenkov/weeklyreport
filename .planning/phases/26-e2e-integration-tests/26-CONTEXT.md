# Phase 26: E2E Integration Tests - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning
**Mode:** Auto-generated for autonomous flow

<domain>
## Phase Boundary

Playwright E2E tests run against real API (not mock). Dual webServer config (API + Web). Database seeded before tests, cleaned after. Existing 339 mock-based tests preserved (separate directory).

**Key deliverables:**
1. Playwright config with dual webServer: API on :3002 + Web on :3005
2. Global setup: seed DB → run tests → cleanup
3. New `e2e/integration/` directory with 20-30 core tests
4. Lead journey: login → fill → submit → locked
5. Head journey: dashboard → report → publish → PDF
6. Cross-role lifecycle: lead submits → head publishes → lead sees locked
7. Existing 339 tests in `e2e/` (mock-based) untouched

</domain>

<decisions>
## Implementation Decisions

### Playwright Config
- Two configs: existing `playwright.config.ts` (mock UI) + new `playwright.integration.config.ts` (real API)
- Dual webServer in integration config:
  - API: `pnpm --filter @customreport/api dev` on :3002
  - Web: `NEXT_PUBLIC_AUTH_STUB=true pnpm --filter @customreport/web dev` on :3005
- testDir: `apps/web/e2e/integration/`
- timeout: 60s per test
- workers: 1 (shared DB state)

### Database Strategy
- Global setup runs `prisma/seed.ts` before tests
- Each test relies on seeded baseline (no per-test seeding)
- Cleanup: TRUNCATE + reseed between test runs (not per test — fast)

### Test Categories (20-30 tests)
- 4-5 lead journey scenarios
- 4-5 head journey scenarios  
- 3-4 cross-role lifecycle scenarios
- 2-3 admin CRUD scenarios
- 2-3 Status↔Risk sync scenarios
- 2-3 PDF export scenarios
- 2-3 auth guard scenarios

### Existing Tests
- e2e/ directory KEEPS its 339 mock-based tests
- run via `pnpm --filter @customreport/web test:e2e` (existing script)
- New script: `pnpm --filter @customreport/web test:e2e:integration` for real-API tests
- CI runs both — mock tests fast, integration tests slow

### Claude's Discretion
- Exact test scenarios (must cover happy path + 1-2 errors per area)
- Use existing fixtures/helpers from e2e/ where applicable
- Auth via AUTH_STUB=true — direct navigation to role pages

</decisions>

<code_context>
## Existing Code Insights

### Already Built
- apps/web/playwright.config.ts — existing config for mock-based tests
- apps/web/e2e/ — 22 spec files, 339 tests
- apps/web/e2e/fixtures.ts — auth setup (leadPage, headPage helpers)
- apps/web/e2e/helpers/ — utility helpers
- prisma/seed.ts — idempotent seed (Phase 20)

### Established Patterns
- Playwright test structure: describe → test → page assertions
- Fixtures via @playwright/test
- Auth via NEXT_PUBLIC_AUTH_STUB direct navigation (no SAML in dev)

### Integration Points
- Create: apps/web/playwright.integration.config.ts
- Create: apps/web/e2e/integration/ directory + 8-10 spec files
- Modify: apps/web/package.json — new test:e2e:integration script
- New: apps/web/e2e/integration/global-setup.ts (DB seed)
- New: apps/web/e2e/integration/fixtures.ts (real API auth)

</code_context>

<specifics>
## Specific Ideas

- Use `test.beforeAll` for expensive setup (e.g., publish a report once)
- Use `page.waitForResponse(url => url.includes('/trpc/'))` to wait for tRPC calls
- Visual regression: skip in integration (mock baselines invalid for real data)

</specifics>

<deferred>
## Deferred Ideas

- Per-test DB transactions/rollback → v6.0+ (overkill, full reseed is fast)
- Performance benchmarks → v6.0+
- Cross-browser testing → currently chromium only

</deferred>
