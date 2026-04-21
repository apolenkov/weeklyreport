# Domain Pitfalls — v4.0

**Domain:** CustomReport v4.0 — Backend edge-cases, UI redesign from scratch, E2E tests
**Researched:** 2026-04-21
**Scope:** Pitfalls specific to this milestone. v3.0 pitfalls (Next.js 16 upgrade, shadcn/ui setup, pgvector) are resolved and NOT repeated here.

---

## Critical Pitfalls

### Pitfall 1: Another Full Redesign Rejected Because No Early User Validation

**What goes wrong:** An agent completes a full UI redesign pass (all 8+ pages, all components, dark theme, animations) and delivers the final result — only for the user to reject the entire aesthetic direction again, as happened before ("куцо, как 90-е").

**Why it happens:** "Redesign from scratch via design skills" is interpreted as "produce final result, then show." The user has strong visual opinions (the UX audit captured them: flat design, modern feel, colorful traffic lights, micro-animations, no wall-of-cards). Without a checkpoint on the very first styled surface, the entire effort can miss the aesthetic target.

**Consequences:**
- Complete rework of all styled components
- Wasted E2E test effort if selectors were written against the rejected design
- User trust erosion in the redesign phase

**Prevention:**
1. Do NOT redesign all pages before showing the user anything. Style one high-visibility surface first — the lead report form (the primary weekly-use surface) — and show it to the user before continuing.
2. The UX audit's specific complaints (P0-P2) are the success criteria: confirmation before delete, collapsible sections, colorful traffic light buttons, focus-visible rings, micro-animations on add/remove.
3. Get explicit user sign-off on the first page before starting the remaining 7 pages.
4. Do the full-page screenshot comparison so the user can see the visual direction, not just describe it.

**Detection:** The user has not seen any rendered output before a complete redesign pass is submitted.

**Phase:** Redesign Phase — address on first plan, not at the end.

**Confidence:** HIGH — this happened in this exact project; the UX audit memory records it.

---

### Pitfall 2: Existing E2E Tests Are Invalidated by Redesign and Become Noise

**What goes wrong:** The 8 existing E2E spec files (lead-report-entry, head-journey, lead-journey, head-dashboard, admin-panel, etc.) use ARIA selectors tied to the current DOM structure — headings like `'My Report'`, group names like `'Project Statuses'`, `'Items'`, `'Risks'`. After a redesign, heading text, ARIA group names, and component structure change. All these tests fail. The visual regression baselines in `screenshots.spec.ts-snapshots/` fail from pixel 1.

**Why it happens:** The redesign changes the semantic structure (new section names, different heading hierarchy, potentially redesigned traffic light from radio inputs to button groups). The specs are not resilient to these changes.

**Consequences:**
- E2E test suite fails entirely during redesign — 0 signal about actual breakage
- Visual baselines are all stale — any comparison produces a failure
- Developers either ignore failures (worse) or spend time updating specs mid-redesign (fragile)

**Prevention:**
1. Before starting the redesign: delete all `screenshots.spec.ts-snapshots/` baseline images. These will be regenerated after redesign is complete.
2. Decide upfront: either (a) freeze existing E2E specs and accept they fail during redesign, then update them after; or (b) update specs incrementally with each redesigned page. Option (a) is lower risk.
3. After redesign is complete: do a single full E2E spec update pass. Do not interleave spec updates with component changes.
4. New E2E journeys for v4.0 (lead journey, head journey, viewer journey, cross-role lifecycle) should be written AFTER redesign is stable — same principle as v3.0.
5. Add `data-testid` attributes during redesign so selectors are not ARIA-structure-dependent.

**Detection:** Run `pnpm exec playwright test` at start of redesign phase. If more than 3 tests fail for reasons unrelated to backend, the specs are already stale.

**Phase:** Redesign Phase — plan for baseline deletion at start; E2E update at end.

**Confidence:** HIGH — the specific ARIA selectors in the current specs (`getByRole('group', { name: 'Project Statuses' })`, `getByRole('radiogroup')`) will break if traffic light moves from native radio to shadcn/ui Button group.

---

### Pitfall 3: Prisma Reminder Migration Requires Data Transformation, Not Just Schema Rename

**What goes wrong:** The migration for the reminder schema (`kind/fireAt/timezone/status/version` replacing `cronExpression/name`) is treated as a simple column rename. The generated migration SQL drops the old columns and adds new ones, silently deleting all existing reminder rule rows in the database.

**Why it happens:** `prisma migrate dev` does not automatically generate `UPDATE` statements to migrate existing data. A schema rename generates `DROP COLUMN` + `ADD COLUMN`, which loses all data. If the dev/staging database has seed reminder rules or user-created rules, they are gone after migration.

**Consequences:**
- Silent data loss of all reminder rules in non-empty databases
- Seed data must be re-run after migration
- If production database is migrated (future), reminder rules are lost
- Integration tests fail with `ReferenceError: reminder rule not found` until re-seeded

**Prevention:**
1. Use `--create-only` flag: `prisma migrate dev --create-only --name reminder-schema-v2`.
2. Manually edit the generated SQL to add `UPDATE` statements that map old field values to new fields before dropping old columns. Example: `UPDATE "ReminderRule" SET "kind" = 'absolute', "fireAt" = ...` derived from the old `cronExpression` value.
3. If no existing data needs preservation (dev-only database), document this explicitly in the migration SQL with a comment: `-- No data migration needed; dev database only`.
4. Run the migration against a copy of the current database schema first (`prisma migrate dev --name test-reminder` on a clean branch) to verify the generated SQL is correct before applying to the actual dev database.
5. Verify via `prisma studio` that reminder rules table is populated after migration.

**Detection:** After `prisma migrate dev`, check `SELECT COUNT(*) FROM "ReminderRule"`. If count drops to 0 and seed data had rules, data was lost.

**Phase:** Backend Phase — first migration task.

**Confidence:** HIGH — standard Prisma behavior; `migrate dev` generates schema diff, not data migration.

---

### Pitfall 4: jsdom Test Failures Multiply During Redesign if Root Cause Is Not Fixed First

**What goes wrong:** 24 pre-existing unit test failures in `apps/web` ("React is not defined" / jsdom errors) become worse during redesign. New components added during redesign inherit the broken test environment and generate additional failures. By the end of redesign, the test suite has grown from 24 failures to 40+, making it impossible to distinguish regressions from pre-existing issues.

**Why it happens:** The root cause is the Vitest React plugin configuration or the `void React;` workaround in test files. The Phase 15 handoff notes that a `@vitejs/plugin-react` fix was committed (Wave 1 of Phase 15). However, if that fix was incomplete or reverted, any new component files that don't include the `void React;` workaround will fail.

**Consequences:**
- Unable to run a clean test suite against redesigned components
- Redesign verification is blocked — you cannot tell if a new component works
- The 24 failures hide actual regressions introduced during redesign

**Prevention:**
1. Before touching any component files: run `pnpm --filter @customreport/web test` and record the exact failure count.
2. If the count is >0, fix the Vitest React configuration FIRST. The vitest.config.ts already has `plugins: [react()]` per the Phase 15 memory — verify this is in the committed file before assuming it is fixed.
3. The `void React;` pattern is fragile (it is a workaround, not a fix). The correct fix is `@vitejs/plugin-react` in vitest.config.ts AND `@vitejs/plugin-react` in devDependencies — both must be present.
4. After fixing, run the full test suite and verify 0 failures (or document any remaining known failures) before starting redesign.

**Detection:** `pnpm --filter @customreport/web test 2>&1 | grep -c "FAIL"` — non-zero means pre-existing failures are still present.

**Phase:** Backend Phase (fix before redesign), or first step of Redesign Phase.

**Confidence:** HIGH — directly observed in Phase 14 verification gap (STATE.md records "24 pre-existing jsdom failures — not regressions from Phase 14").

---

### Pitfall 5: MSW Handlers Diverge from Real API After Backend Edge-Case Fixes

**What goes wrong:** The 81 regression scenarios require backend fixes — reminder schema, new error codes, changed response shapes. The MSW handlers in `apps/web/src/test/msw-handlers.ts` are hardcoded to return specific shapes. After backend fixes change error codes or add new fields, unit tests pass against stale mocks while the actual app integration fails. The divergence is invisible until E2E tests run against real services.

**Why it happens:** MSW handlers have no type safety against the real backend. They return hardcoded objects that matched the API at time of writing. Backend changes that add fields, rename fields, or change error shapes do not propagate to MSW handlers automatically.

**Consequences:**
- Unit tests give a false green signal — they test "does the component handle the old mock shape" not "does the component handle the current API"
- Integration bugs are only caught in E2E, which requires running services
- The more backend fixes applied, the more diverged MSW becomes

**Prevention:**
1. After each backend fix that changes an API response shape, update the corresponding MSW handler in the same commit.
2. Use the Zod schemas from `packages/shared` to generate or validate MSW mock data — if the schema changes, TypeScript will catch divergence. The current MSW handlers import from `@customreport/shared` implicitly via type `as const` — add explicit typed assertions.
3. For new endpoints added during backend completeness phase, add corresponding MSW handlers before writing unit tests for the frontend consumers.
4. Before starting E2E tests: do a manual spot-check — navigate to the page in the browser with real services running and compare the network tab response shape to what the MSW handler returns.

**Detection:** A frontend unit test passes in `vitest` but the same page throws a runtime error when running against real services. TypeScript errors in MSW mock data creation (if you add typed return assertions) will catch divergence at compile time.

**Phase:** Backend Phase — synchronize MSW with each API fix.

**Confidence:** HIGH — observed in this project (superjson mismatch was a direct consequence of MSW divergence).

---

### Pitfall 6: Backend 81 Regression Scenarios Need Integration Test Infrastructure, Not Browser E2E

**What goes wrong:** The 81 regression scenarios (L-001 to D-010) are planned for Playwright E2E coverage. But many scenarios test pure backend behavior: deduplication (H-023), carry-over filtering (H-031, H-032), status transition blocking (D-010), validation boundaries (D-001 to D-009). Writing these as browser E2E tests is 10-50x slower per scenario, requires seeding specific database states before each test, and makes tests brittle (UI changes break business logic tests).

**Why it happens:** "E2E test coverage" is interpreted as "Playwright browser tests" for all scenarios. But the regression scenarios were written as acceptance criteria for backend behavior, not UI behavior.

**Consequences:**
- E2E suite takes 30+ minutes for 81 scenarios
- Test reliability drops because browser startup, auth setup, and page load are involved for pure API tests
- Scenarios that require specific data states (carry-over source report, deduplication keys) are very difficult to set up via browser interactions

**Prevention:**
1. Separate the 81 scenarios into two layers:
   - **API integration tests** (Vitest + real Prisma + real database, no browser): all D-0xx data integrity, all validation scenarios (L-019 to L-022), status transitions, error codes (L-006, L-007, L-009, L-010, L-013, H-008, H-023 to H-025, H-028 to H-032). These already exist as 191 contract tests — the gaps are the edge cases.
   - **Browser E2E tests** (Playwright): full user journeys (X-001 to X-006), role-based access control UI behavior (L-016 to L-018, V-007 to V-011), and UI state rendering (form shows submitted state, dashboard shows correct lead count).
2. The NestJS test environment with a real test database is already set up (see `apps/api/src/test-utils/`). Extend that infrastructure rather than creating browser tests for backend logic.
3. Reserve Playwright for: journeys that require actual browser interaction (fill form, click submit, see toast, navigate to next page) and role-based UI enforcement (does the button disappear for the correct role).

**Detection:** If a planned Playwright test would need `page.request.post()` (API call, not UI interaction) to set up state, that scenario belongs in the API integration layer instead.

**Phase:** E2E Phase — split test plan into API integration vs browser E2E before writing any tests.

**Confidence:** HIGH — the 191 existing contract tests already cover the service layer; extending them is cheaper than rewriting as browser tests.

---

### Pitfall 7: Backend-First Ordering Creates a Broken Frontend Window

**What goes wrong:** Backend edge-case fixes change API response shapes (reminder schema migration, new error codes, changed field names). The existing frontend was built against the pre-fix API. During the backend phase, the frontend is broken — pages throw TypeScript errors or runtime exceptions against the changed API. This makes local development harder and can block verification.

**Why it happens:** The priority is "backend first, then UI." Backend fixes are committed. The redesign hasn't started yet. The old frontend code references fields that were renamed or error codes that changed.

**Consequences:**
- Cannot visually verify backend fixes in the browser during development
- TypeScript compilation may fail if shared Zod schemas change
- Increased risk of carrying over frontend bugs into the redesign (the redesign starts from broken components)

**Prevention:**
1. When a backend fix changes a `packages/shared` Zod schema, fix all TypeScript compilation errors in `apps/web` in the same commit — even if the fix is minimal (add a null check, rename a field reference). Do not allow `tsc --noEmit` to fail between commits.
2. If a backend schema change is large (reminder model restructure), do it in one atomic commit: schema migration + shared Zod update + frontend type fix.
3. Run `pnpm typecheck` (from monorepo root, not per-package) after each backend commit to catch cross-package type breakage immediately.
4. This is explicitly NOT "do the full redesign now." It is "keep TypeScript green while backend fixes land."

**Detection:** After a backend fix commit, run `pnpm --filter @customreport/web typecheck`. Any errors are the broken window.

**Phase:** Backend Phase — enforce per-commit.

**Confidence:** HIGH — tRPC shares types via `packages/shared`; schema renames propagate to the frontend as TypeScript errors immediately.

---

## Moderate Pitfalls

### Pitfall 8: Visual Regression Baseline Workflow Is Inverted

**What goes wrong:** `screenshots.spec.ts` baselines are created before the redesign is complete. Individual pages are baselined as they are redesigned. Then subsequent redesign passes (based on user feedback) invalidate the early baselines. Each feedback cycle deletes and regenerates a subset of baselines, creating inconsistent snapshot history.

**Prevention:**
1. Do NOT create visual regression baselines during the redesign.
2. Baselines belong only at the end: one baseline-creation run against the final approved design.
3. Use `--update-snapshots` flag as a single batch operation after user sign-off, not incrementally.
4. The `screenshots.spec.ts-snapshots/` directory should be deleted at redesign start and left empty until the final baseline pass.

**Phase:** Redesign Phase (start), E2E Phase (final baseline creation).

**Confidence:** HIGH — the existing snapshots will be stale from the first redesigned page onward.

---

### Pitfall 9: BullMQ Re-enablement Required Before E2E PDF Tests

**What goes wrong:** BullMQ is disabled in AppModule (as of v3.0 handoff — `BullModule.forRoot` commented out, PDF and reminder queue injection removed). E2E scenarios H-009 (PDF export), H-022 (reminder execute), and X-006 (reminder flow) require BullMQ to be functional. Running these E2E tests against a backend with disabled BullMQ will result in jobs being created in the database but never processed — tests waiting for `status: 'sent'` or `status: 'completed'` will timeout.

**Prevention:**
1. Fix BullMQ DI before writing E2E tests that cover PDF or reminder flows.
2. The v3.0 memory identifies the issue: `@nestjs/bullmq BullExplorer ModuleRef` DI bug. The fix is likely `@nestjs/bullmq@latest` or downgrade to a compatible version — check the NestJS/BullMQ compatibility matrix.
3. Verify BullMQ is working by running the NestJS API locally and calling `pdfExport.request` — the job status must transition from `queued` to `completed` within 30 seconds.
4. If BullMQ re-enablement is complex, stub the queue in E2E test environment only (use `AUTH_DEV_MODE` parallel to a `QUEUE_DEV_MODE` that synchronously executes jobs).

**Detection:** Call `pdfExport.request` via the browser or API client. If `pdfExport.status` stays `queued` indefinitely, BullMQ is disabled.

**Phase:** Backend Phase (fix BullMQ) before E2E Phase.

**Confidence:** HIGH — directly documented in v3.0 handoff memory.

---

### Pitfall 10: Seed Data State Dependency Makes E2E Fragile

**What goes wrong:** The existing E2E specs depend on specific seed data state: Lead 1 has `status: submitted`, there are 6 leads, there is 1 head user with a specific UUID. Backend edge-case fixes and Prisma migrations may require re-seeding. If re-seeding changes UUIDs, user names, or submission state, E2E tests that check for `getByText('Lead 1')` or expect `status: submitted` start failing.

**Why it happens:** Seed data is not isolated per test — all E2E tests share the same database state. Tests that modify state (submit a section, create a user, trigger carry-over) pollute the database for subsequent tests. With parallel execution (`fullyParallel: true`), the order is non-deterministic.

**Prevention:**
1. E2E tests that are read-only (checking text, navigating pages) are safe as-is.
2. E2E tests that mutate state (fill form, submit, delete user, trigger PDF) must reset to known state before and after. Use database seeding hooks (`beforeEach` reset) or dedicated test-isolated database snapshots.
3. For the full lifecycle scenario (X-001), run it with `workers: 1` serialized, not in parallel.
4. The seed script should be idempotent — running it twice produces the same state, not double the data.
5. After Prisma migration, always re-run seed and verify E2E auth setup produces valid session cookies.

**Detection:** Run E2E suite twice sequentially without resetting the database. If the second run has different results than the first, tests are modifying shared state.

**Phase:** E2E Phase — design test isolation upfront.

**Confidence:** MEDIUM-HIGH — the current specs assume `status: submitted` for Lead 1, which is set only by seed data; any test that submits another section for Lead 1 breaks this assumption.

---

### Pitfall 11: superjson Transformer Must Stay Synchronized Across MSW, tRPC Client, and tRPC Server

**What goes wrong:** MSW handlers wrap data with `superjson.serialize()`. The tRPC client uses `transformer: superjson`. The tRPC server uses `transformer: superjson`. If any one of these three is changed or missing, Date fields serialize to strings at runtime but TypeScript still expects `Date` — causing 17+ TS2322 errors across page components (this exact bug was already fixed once in this project).

**Prevention:**
1. Never change the tRPC server transformer (`initTRPC.create({ transformer: superjson })`) without updating the client and MSW handlers in the same commit.
2. When adding a new tRPC procedure that returns `Date` fields, add a corresponding MSW handler that uses `superjson.serialize()` wrapping — not plain `HttpResponse.json()`.
3. After any backend schema change that adds `Date` fields, run `pnpm typecheck` — TS2322 on `Date` vs `string` is the diagnostic.

**Detection:** TypeScript error `Type 'string' is not assignable to type 'Date'` in any page component after a backend change.

**Phase:** Backend Phase — enforce per-commit type check.

**Confidence:** HIGH — this already caused 17 errors in this project (feedback memory: `feedback_trpc_superjson.md`).

---

## Minor Pitfalls

### Pitfall 12: Playwright `auth.setup.ts` Depends on Seed Data Being Present

**What goes wrong:** `auth.setup.ts` calls `/auth/dev-login?role=lead` which creates or finds a user with `role=lead` in the database. If the database is empty (migration just ran, seed not yet applied), dev-login creates a new user but may fail if the seed data (projects, report period) that the lead's section depends on doesn't exist. The E2E auth setup passes but subsequent tests fail with "no active report" errors.

**Prevention:**
1. Always run seed BEFORE running E2E tests: `prisma db seed` must be a prerequisite in the E2E startup script.
2. In `playwright.config.ts` `webServer` config, add a seed step to the API startup command, or use a `globalSetup` script that runs seed before auth setup.
3. Verify by checking that `reports.getActive` returns a valid section for the lead after auth setup.

**Phase:** E2E Phase setup.

**Confidence:** MEDIUM — depends on whether dev-login is resilient to missing seed data (it may auto-create a section, or it may throw).

---

### Pitfall 13: Collapsible Sections Must Not Hide Required Fields from Playwright

**What goes wrong:** The UX audit requested collapsible sections to reduce scroll. If sections are collapsed by default, Playwright tests that look for `getByRole('textbox', { name: 'Priority 1' })` or `getByRole('group', { name: 'Risks' })` will return 0 visible elements. The test fails with "element not visible" rather than "element not found."

**Prevention:**
1. Sections should be expanded by default on first load (collapsed is a user preference, not the initial state).
2. If sections are collapsed by default, E2E tests must explicitly click the section header to expand before interacting with child elements.
3. Add `data-testid="section-toggle-risks"` etc. to collapsible triggers so tests can expand them reliably regardless of label text.

**Detection:** After adding collapsible sections, run `pnpm exec playwright test lead-report-entry.spec.ts`. Any "element not visible" failures for form fields indicate hidden elements.

**Phase:** Redesign Phase — when implementing collapsible sections.

**Confidence:** MEDIUM — depends on whether default state is open or closed.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Prisma reminder migration | Silent data loss (P3) | Use --create-only, hand-edit SQL with data transform |
| Backend schema changes | Frontend TypeScript breakage (P7) | Run pnpm typecheck after every backend commit |
| Backend fixes + MSW | MSW diverges from real API (P5) | Update MSW handler in same commit as API change |
| BullMQ re-enablement | PDF/reminder E2E blocked (P9) | Fix BullMQ before any queue-dependent E2E |
| UI redesign — first page | User rejects aesthetic direction (P1) | Show first styled page, get sign-off before continuing |
| UI redesign — existing specs | E2E specs break immediately (P2) | Delete baselines at redesign start, freeze specs |
| UI redesign — jsdom failures | Failures multiply (P4) | Fix Vitest React config before touching components |
| E2E — 81 regression scenarios | All as browser tests is too slow (P6) | Split: API integration tests vs browser journeys |
| E2E — seed data | State contamination across tests (P10) | Read-only tests are safe; mutating tests need isolation |
| E2E — auth setup | Fails on empty database (P12) | Seed before auth setup in startup sequence |
| E2E — collapsible sections | Hidden elements cause false failures (P13) | Default-open sections OR explicit expand in tests |
| superjson everywhere | Date → string type errors (P11) | Never change transformer without syncing MSW + client |
| Visual baselines | Stale snapshots from redesign start (P8) | Delete all baselines at start, recreate only at end |

## Recommended Phase Ordering Based on Pitfalls

1. **Backend Phase first** — Fix Prisma migration + BullMQ + edge-cases + MSW sync. Keep TypeScript green after every commit.

2. **Vitest fix before Redesign** — Fix `@vitejs/plugin-react` root cause so redesigned components can be unit tested from day one. This is a 5-minute fix that prevents 40+ test failures accumulating.

3. **Redesign Phase with checkpoint** — Style first page, show user, get sign-off, then continue. Delete visual baselines and freeze existing E2E specs at the start of this phase.

4. **E2E Phase last** — Write new E2E tests after redesign is approved and stable. Split 81 regression scenarios into API integration tests (extend existing 191 contract tests) vs browser E2E journeys. Recreate visual baselines at the very end of this phase.

## Sources

- Project memory files (confirmed from current codebase): `project_phase15_handoff.md`, `project_ux_audit.md`, `project_v3_handoff.md`, `feedback_trpc_superjson.md`
- Current codebase: `apps/web/e2e/*.spec.ts`, `apps/web/src/test/msw-handlers.ts`, `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts`
- Project STATE.md: Phase 14 verification gap — 24 pre-existing jsdom failures documented
- REGRESSION-SCENARIOS.md: 81 scenarios, categorized as backend vs frontend behavior
- General Playwright patterns: official auth docs, `auth.setup.ts` pattern with storageState
