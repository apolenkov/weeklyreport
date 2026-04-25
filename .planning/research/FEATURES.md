# Feature Landscape: CustomReport v5.0

**Domain:** Production integration for weekly status reporting app
**Researched:** 2026-04-25
**Supersedes:** v4.0 FEATURES.md (2026-04-21)
**Confidence:** HIGH (codebase fully inspected, patterns verified against official docs and web research)

---

## Context: What v5.0 Is About

v4.0 shipped a complete UI prototype with 36 tRPC API endpoints (all tested), 339 Playwright E2E tests (all against mock-rendered UI), and 7 frontend pages with the Starbucks design system. But **the frontend does not talk to the backend.** Every page renders hardcoded mock data from 3 `mock-data.ts` files. Every button either does nothing or manipulates local state.

v5.0 turns this prototype into a working application.

---

## Table Stakes

Features that must ship for v5.0 to be called "production integration." Missing any = the app stays a UI prototype.

### TS-1: Type Alignment (Mock Types to Zod Schemas)

| Aspect | Detail |
|--------|--------|
| Why Expected | Without this, useQuery data cannot render in existing components. Compilation will fail or data will silently mismatch. |
| Complexity | **MEDIUM** |
| Dependencies | Must complete BEFORE tRPC wiring begins |
| Confidence | HIGH -- both type systems are in the codebase |

**The problem:** The 3 mock-data files define ~15 custom TypeScript types (`Product`, `KanbanItem`, `RiskEntry`, `LeadInfo`, `KpiData`, `ProductReport`, etc.) that do NOT match the Zod schemas in `packages/shared`. Key divergences:

| Mock Type | Mock Value | Zod Schema Value | Impact |
|-----------|-----------|-------------------|--------|
| Stage status | `'on-track'` / `'at-risk'` / `'blocked'` | `'green'` / `'yellow'` / `'red'` | Every status chip, color mapping, tooltip |
| Item status | `'in-progress'` / `'completed'` / `'blocked'` / `'planned'` | `'done'` / `'in_progress'` / `'blocked'` | Every item badge |
| Section status | `'submitted'` / `'draft'` / `'pending'` | `'draft'` / `'submitted'` (no `'pending'`) | Lead grid status badges |
| Risk severity | `'at-risk'` / `'blocked'` | Derived from stage status | Risk badge rendering |
| ID format | String slugs (`'crm'`, `'analytics'`) | UUIDs | Every lookup, routing |

**Recommended approach:** Write thin adapter functions (`mapApiSectionToLeadForm`, `mapApiDashboardToKpi`) that translate API response shapes to the component prop shapes. Components stay untouched. Adapters are unit-testable. This is faster and lower-risk than refactoring all components to accept Zod types directly (that can happen in v6.0).

### TS-2: Database Seed (Mockup-Aligned)

| Aspect | Detail |
|--------|--------|
| Why Expected | tRPC wiring is meaningless without data in PostgreSQL. The seed must produce the exact scenario shown in mockups so the app looks identical after wiring. |
| Complexity | **MEDIUM** |
| Dependencies | Prisma schema (19 models, all exist) |
| Confidence | HIGH |

**What the seed creates:**
- 6 lead users with real names from mockups (Platanov A., Maria K., Igor V., Dmitry S., Olga N., Sergey T.) + 1 head (Barkhanov) + 1 viewer
- 12 products matching `MOCK_PORTFOLIO` in `dashboard/mock-data.ts`
- 7 SDLC stages (Planning, Analysis, Design, Dev, Testing, DevOps, Support)
- Stage assignments per product per lead (matching mock `StageAssignment[]` arrays)
- 2 report periods (W15 published, W16 active/draft)
- Report sections with items, risks, decisions, priorities matching mock data counts and content
- At least 4 submitted sections and 2 draft/pending sections for W16 (matching dashboard KPI: 4/6 submitted)

**Success criterion:** After `pnpm prisma db seed`, the API returns data that visually matches the current mock-rendered UI.

### TS-3: tRPC Client Wiring (mock-data to useQuery/useMutation)

| Aspect | Detail |
|--------|--------|
| Why Expected | 36 API endpoints exist and are tested. 38 mock-data imports feed the UI. The app does not talk to its own backend. |
| Complexity | **HIGH** |
| Dependencies | TS-1 (type alignment), TS-2 (seed data), existing `apps/web/src/lib/trpc.ts` client |
| Confidence | HIGH -- pattern well-documented for tRPC v11 + Next.js App Router |

**What this involves:**

1. **TRPCProvider + QueryClientProvider in root layout.** The existing `trpc.ts` uses the classic `createTRPCReact` from `@trpc/react-query` with superjson transformer. Stay on this classic client for v5.0 -- migrating to the new `@trpc/tanstack-react-query` with `createTRPCContext` (RSC prefetching) is a separate concern that should not be mixed with the mock-to-real transition. Concretely: wrap root layout children in `trpc.Provider` (passing the client from `createTRPCClient()`) inside a `QueryClientProvider` (passing a `new QueryClient()`). This is the only provider setup needed.

2. **Replace 38 mock-data imports** across 3 mock-data files and ~15 consumer components with `trpc.{namespace}.{method}.useQuery()` / `.useMutation()` calls. The 7 page files (`lead/report`, `lead/history`, `head/dashboard`, `head/report`, `admin`, `reports/[reportId]`, `reports/history`) plus child components must all be converted.

3. **Loading and error states.** Mock data renders instantly. Real API calls need skeleton states (Suspense fallbacks already exist in page.tsx files) and error handling. Every `useQuery` call needs `isLoading` / `isError` handlers.

4. **Optimistic updates for mutations.** Submit, Save Draft, Add Item, Delete Risk should use React Query `onMutate` / `onSettled` / `onError` for instant UI feedback while the API round-trips.

**Expected UX:** User sees the exact same UI, but data comes from PostgreSQL via tRPC. Loading skeletons appear briefly on page transitions. Mutations feel instant via optimistic updates. Errors show toast notifications.

### TS-4: Button Interactivity (72 onClick Handlers)

| Aspect | Detail |
|--------|--------|
| Why Expected | Every button currently does nothing server-side or manipulates local state only. Users will click Submit and nothing persists. |
| Complexity | **HIGH** |
| Dependencies | TS-3 (tRPC wiring) |
| Confidence | HIGH |

**72 interactive elements across all pages need real tRPC mutations:**

| Page | Actions | tRPC Endpoints |
|------|---------|----------------|
| Lead Form | Save Draft, Submit, Add/Edit/Delete Item, Add/Edit/Delete Risk, Add/Edit/Delete Decision, Edit Priority, Change Stage Status | `reports.saveDraft`, `reports.submit`, `leadForm.byPeriod` |
| Lead Form | Fill From, Version Restore, Request Reopen | `leadForm.fillFrom`, `leadForm.restoreVersion`, `leadForm.requestReopen` |
| Head Dashboard | View Report, Navigate Periods | `review.dashboard`, `archive.list` |
| Weekly Report | Publish, Revoke | `period.publish`, `leadForm.revoke` |
| Admin Panel | Save/Delete User, Save/Delete Project, Save Period, Save/Delete Reminder Rule, Save/Delete Stage Assignment | `admin.*` mutations (12 endpoints) |
| Report Archive | List, Detail, PDF Export | `archive.list`, `archive.detail`, `pdfExport.request` |

### TS-5: Auth Session Guard (Route Protection)

| Aspect | Detail |
|--------|--------|
| Why Expected | Without route protection, anyone can access any page by typing the URL. Basic security requirement. |
| Complexity | **LOW** |
| Dependencies | Next.js 16 `proxy.ts` convention, existing SAML auth on backend |
| Confidence | HIGH -- Next.js 16 proxy.ts pattern well-documented |

**What this involves:**

1. **Create `apps/web/src/proxy.ts`** (Next.js 16 renamed `middleware.ts` to `proxy.ts`). The proxy checks for a session cookie. If absent, redirect to `/` (login page). Matcher covers `/(app)/(.*)` routes.

2. **v5.0 scope: session-existence check only.** PROJECT.md constraint: "Working as admin with full access for full regression. Role separation is next milestone." The guard checks: is there a session cookie? Yes -> proceed. No -> redirect to login. No role checking in v5.0.

3. **Design for role expansion.** The proxy should read the session and extract role even though it only checks existence for now. This allows v6.0 to add role-based route restrictions without restructuring.

**Expected UX:** Unauthenticated users hitting `/lead/report` or `/head/dashboard` are immediately redirected to the login page. After login (or AUTH_STUB bypass), navigation works normally.

---

## Differentiators

Features that elevate v5.0 beyond "it works." Not strictly required for production integration, but add significant value.

### DF-1: Status-to-Risk Auto-Sync (Stage -> Risk Direction)

| Aspect | Detail |
|--------|--------|
| Value Proposition | When a lead changes a stage to At Risk or Blocked, the system auto-creates a pre-populated risk entry. Eliminates the "forgot to add a risk" problem. |
| Complexity | **MEDIUM** |
| Dependencies | TS-3 (tRPC wiring), TS-4 (button interactivity) |
| Confidence | MEDIUM -- custom UX, no off-the-shelf pattern |

**How enterprise tools handle the status->risk linkage:**

| Tool | Pattern | Direction | UX |
|------|---------|-----------|-----|
| **Jira** | Automation rules: "When issue transitions to Status X, create linked issue of Type Y" | Unidirectional (status -> new issue) | Rule-based, configurable. New issue appears in backlog. |
| **Smartsheet** | Cell automations: "When column value changes, populate other columns" | Unidirectional per rule | In-row automation. User sees cell auto-fill. |
| **Monday.com** | "When status changes to X, create item in Group Y" | Unidirectional (status -> new item) | Automation recipe. New item appears. |
| **Azure DevOps** | Work item rules: "When State = Active, set Risk field to required" | Conditional validation, not creation | Field becomes required, user must fill. |

**None of these provide inline bidirectional sync within a single form.** CustomReport's SDLC pipeline + risk list are on the same page, making a seamless UX possible.

**Recommended UX:**

1. Lead clicks stage chip for "Dev -- CRM Platform"
2. Lead selects "At Risk" in popover, clicks Save
3. Stage chip turns yellow
4. A new risk row slides in at the bottom of the Risks section, pre-filled:
   - Product: "CRM Platform" (locked)
   - Stage: "Dev" (locked)
   - Severity badge: "At Risk" (auto-inherited from stage)
   - Risk text: empty, cursor focused here
5. Toast: "Risk entry added for CRM Platform / Dev. Describe the risk below."
6. If a risk for this product+stage already exists, no new row is created. Instead, the existing risk row highlights briefly (yellow pulse) and scrolls into view.

**Implementation:** Frontend-only behavior. When the stage status mutation succeeds with a non-on-track value, check if a risk exists for that product+stage. If not, optimistically add a risk row to local state and scroll to it. Saved via standard autosave/draft-save flow.

### DF-2: Risk-to-Status Suggestion (Risk -> Stage Direction)

| Aspect | Detail |
|--------|--------|
| Value Proposition | When a lead adds a risk for an On Track stage, the system suggests updating the stage. Catches inconsistencies proactively. |
| Complexity | **LOW-MEDIUM** |
| Dependencies | DF-1 |
| Confidence | MEDIUM -- no direct enterprise precedent, custom UX |

**Recommended UX:**

When a lead adds a risk and selects a product+stage that is currently On Track:
1. A subtle inline banner appears near the stage status chip: "Stage is On Track but has a risk. Update to At Risk?"
2. "Yes" updates the stage chip. "Dismiss" hides the prompt. Risk stays regardless.
3. Banner auto-dismisses after 10 seconds if no action.

**Key design decision:** This must be a SUGGESTION, not auto-update. Reasons:
- A risk may be low-probability and informational (stage is legitimately On Track)
- Auto-updating stages without consent breaks the lead's ownership model
- Unlike DF-1 (adding a risk row is additive), changing a stage status is a state mutation that ripples to the dashboard, portfolio overview, and assembled report

### DF-3: Production Logging Enhancement

| Aspect | Detail |
|--------|--------|
| Value Proposition | Full request tracing from proxy to database. Every log line in a request chain shares the same correlation ID. |
| Complexity | **LOW-MEDIUM** |
| Dependencies | Existing `logger.ts` and `correlation-id.middleware.ts` |
| Confidence | HIGH -- existing foundation covers most of the work |

**What already exists (do NOT replace):**
- `apps/api/src/lib/logger.ts`: Custom structured JSON logger with daily file rotation, pruning (14-day retention), child loggers, min-level filtering, stdout/stderr + file output. Tested.
- `apps/api/src/infrastructure/middleware/correlation-id.middleware.ts`: Sets `x-request-id` header on request/response from incoming header or generates UUID.

**What is MISSING (the actual work):**
1. **AsyncLocalStorage propagation.** The correlation ID middleware sets headers but does NOT inject the ID into the logger context. Services log without request context. Fix: use Node.js `AsyncLocalStorage` to make a request-scoped child logger available to all service-layer code within a request.
2. **Request/response logging.** Log method, URL, status code, duration for every request. Currently only bootstrap and explicit `logger.info()` calls emit logs.
3. **Error serialization.** Stack traces as structured JSON fields, not console.error string dumps.
4. **Frontend correlation.** The Next.js proxy should generate or forward `x-request-id` to the API, enabling end-to-end browser-to-database tracing.

### DF-4: Playwright Integration Tests (Real API)

| Aspect | Detail |
|--------|--------|
| Value Proposition | Tests that prove the full stack works: browser -> Next.js -> tRPC -> Prisma -> PostgreSQL. Current 339 E2E tests only prove the UI renders mock data. |
| Complexity | **MEDIUM-HIGH** |
| Dependencies | TS-3 (tRPC wiring), TS-2 (seed data), TS-5 (auth guard) |
| Confidence | HIGH -- Playwright + database seed pattern well-established |

**Recommended pattern:**

1. **New test directory:** `apps/web/e2e/integration/` -- separate from existing mock-based tests.
2. **Fixtures with database lifecycle:**
   - `globalSetup`: Ensure Docker Compose stack is running (PostgreSQL + Redis), run migrations, execute seed.
   - Per-test fixture: Reset mutable tables (ReportSection, Item, Risk, Decision, Priority, ProjectStatus, VersionSnapshot) to seed state. Keep stable reference data (User, Project, Stage, Report, Period) untouched.
   - `afterAll`: Optional teardown (or leave stack running for local dev).
3. **Auth fixture:** Call `/auth/dev-login` endpoint (already exists) to get a session cookie, inject into browser context via Playwright `storageState`.
4. **Test structure:** Seed -> Act (browser interaction) -> Assert (UI state AND database state via tRPC queries or direct Prisma calls).

**Isolation strategy:** Do NOT reset the full database between tests -- too slow. Reset only mutable content tables. Keep User, Project, Stage, Report, Period stable across the suite.

**Scope for v5.0:** ~20-30 integration tests covering critical paths:
- Lead fills form and submits (items, risks, decisions, priorities persist in DB)
- Head sees submitted sections on dashboard
- Head publishes report, report appears in archive
- Admin CRUD operations persist (add user, add project)
- Period navigation returns correct data
- Fill From copies data correctly

---

## Anti-Features

Things to explicitly NOT build in v5.0.

### AF-1: Big-Bang E2E Test Migration

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Convert all 339 existing E2E tests to use real API in one pass | Massive effort (weeks), breaks the regression safety net while converting, tests red for the entire duration | Keep existing mock-based E2E tests running as-is for regression. Add NEW integration test files in `e2e/integration/`. Gradually migrate in v6.0+ as confidence grows. Two test suites coexist. |

### AF-2: Role-Based Route Guards in v5.0

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Implement full RBAC in proxy.ts (lead blocked from /admin, viewer blocked from /lead) | PROJECT.md constraint: "admin with full access for full regression." Role separation is explicitly v6.0 scope. | Session-existence guard only. Design to be role-aware (read role from session) but do not enforce role checks yet. |

### AF-3: tRPC Client Migration to @trpc/tanstack-react-query

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Migrate from classic `createTRPCReact` (`@trpc/react-query`) to new `createTRPCContext` (`@trpc/tanstack-react-query`) during v5.0 | Two migrations at once (mock->real AND classic->new client) compounds risk. RSC prefetching is a nice optimization, not critical for 6 users. | Stay on classic client. The existing `apps/web/src/lib/trpc.ts` works. Provider setup is simpler. Migrate to new client in v6.0 when the app is stable on real data. |

### AF-4: Auto-Delete Risk on Stage Status Revert to On Track

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| When stage changes from At Risk/Blocked back to On Track, automatically delete the associated risk entry | Risk text contains valuable context (description, root cause, mitigation plan). Auto-deleting destroys data the lead wrote. | Show a confirmation prompt: "Stage is now On Track. Remove associated risk for [product]/[stage]?" Let the lead decide. If dismissed, risk stays as historical context. |

### AF-5: Replace Custom Logger with Pino/Winston

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Rip out `logger.ts` and install `nestjs-pino` or `winston` | Existing logger handles structured JSON, daily rotation, pruning, child loggers -- everything needed at this scale. It is already tested. Adding a dependency for 6 concurrent users is over-engineering. | Enhance the existing logger with AsyncLocalStorage for correlation ID propagation, add request/response logging, improve error serialization. |

### AF-6: Real-Time Collaborative Updates

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| WebSocket/SSE for live dashboard updates when leads submit | Each lead edits their own section independently. No concurrent editing conflicts exist by design. 6 users, not 6000. | Standard request/response with optimistic updates. Optional polling on dashboard (30s interval) for head to see submission progress. |

### AF-7: Component Refactor to Accept Zod Types Directly

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Rewrite all ~15 consumer components to accept Zod schema return types instead of mock-data types | Large surface area change during the critical mock-to-real transition. Higher risk of visual regressions. | Use adapter layer (TS-1) for v5.0. Components stay untouched. Adapters are testable. Refactor components to use Zod types directly in v6.0 cleanup. |

---

## Feature Dependencies

```
TS-1 (Type Alignment) ---+
                          +--> TS-3 (tRPC Wiring)
TS-2 (DB Seed) ----------+         |
                                    v
                              TS-4 (Button Interactivity)
                                    |
                              +-----+-----+
                              |           |
                              v           v
                         DF-1 (Stage     TS-5 (Auth Guard)
                          -> Risk)            |
                              |               v
                              v          DF-4 (Integration Tests)
                         DF-2 (Risk
                          -> Stage)

DF-3 (Logging) ---- independent, can be done in parallel with any phase
```

**Note:** TS-1 and TS-2 are independent of each other and can run in parallel. Both feed into TS-3.

**Critical path:** max(TS-1, TS-2) -> TS-3 -> TS-4 -> DF-1/DF-4

---

## MVP Recommendation

**Must ship:**

1. **TS-1: Type Alignment** and **TS-2: Database Seed** -- can run in parallel. TS-1 resolves mock-type vs Zod-schema divergence (without this, components cannot render API data). TS-2 populates PostgreSQL to match mockup expectations (without this, API returns empty arrays).
2. **TS-3: tRPC Client Wiring** -- connect frontend to real API. Depends on both TS-1 and TS-2. The core of v5.0.
3. **TS-4: Button Interactivity** -- make every button call real mutations. Completes the "working app" story.
4. **TS-5: Auth Session Guard** -- protect routes. Low effort, high security value.

**Should ship:**

5. **DF-1: Stage-to-Risk Auto-Sync** -- user explicitly requested this. High UX value for leads, medium complexity.
6. **DF-3: Logging Enhancement** -- low effort on top of existing foundation, high production-readiness value.
7. **DF-4: Integration Tests** -- at least 20-30 core tests against real API to prove the stack works end-to-end.

**Defer to v6.0:**

- DF-2 (Risk-to-Stage suggestion) -- UX polish, not critical for launch
- AF-3 (tRPC client migration to new API) -- optimize after stabilization
- AF-2 (Role-based guards) -- requires role separation architecture
- AF-7 (Component refactor to Zod types) -- cleanup after adapter layer proves stable

---

## UX Deep-Dive: Status-to-Risk Bidirectional Sync

### The Two Directions Have Different Complexity

| Direction | Trigger | Action | Complexity | UX Safety |
|-----------|---------|--------|------------|-----------|
| **Stage -> Risk** (DF-1) | Stage chip changed to At Risk or Blocked | Auto-create risk entry (pre-populated, text empty) | MEDIUM | SAFE -- adding a risk row is additive, no data lost |
| **Risk -> Stage** (DF-2) | Risk added for an On Track stage | Suggest updating stage to At Risk (non-blocking prompt) | LOW-MEDIUM | REQUIRES CONFIRMATION -- changing stage status ripples to dashboard and assembled report |

### Edge Cases for Stage -> Risk

| Scenario | Behavior |
|----------|----------|
| Stage set to Blocked, risk already exists for that product+stage | Highlight existing risk row (yellow pulse animation), update severity badge to "Blocked" if it was "At Risk" |
| Stage changed back to On Track, risk exists | Confirmation: "Stage is now On Track. Remove risk for [product]/[stage]?" Yes removes, No keeps |
| Multiple stages At Risk on same product | One risk entry per product+stage pair. Multiple risks shown, each linked to its own stage. |
| Lead deletes a risk that was auto-created | Risk deleted. Stage status NOT changed (stage owns its own state). |
| Locked stage (not owned by this lead) has a risk | Risks can reference any product+stage. But auto-create only triggers for stages the lead owns (ownership = 'mine'). |
| Stage already At Risk, lead clicks At Risk again | No-op. No duplicate risk created. |

### Why Enterprise Tools Only Do One Direction

Enterprise PM tools (Jira, Monday.com, Smartsheet) implement status->action as one-directional automation rules because their data structures are separate entities (an Issue, a Row, a Board Item). A "risk" is a different entity type from a "status," and they live in different views.

CustomReport has an advantage: the SDLC pipeline and risk list are co-located on the same form. The lead sees both simultaneously. This makes bidirectional feedback feasible without context-switching between views -- but it also means the UX must be careful not to feel like "the system is editing my form behind my back." Hence: auto-CREATE risk (additive) but only SUGGEST stage change (requires consent).

---

## Sources

- [tRPC v11 Next.js App Router Setup](https://trpc.io/docs/client/nextjs/app-router-setup) -- Provider setup pattern
- [tRPC React Query Classic Client](https://trpc.io/docs/client/react) -- current client used in codebase
- [Next.js 16 proxy.ts Convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) -- auth guard implementation
- [Next.js 16 Auth Patterns (Auth0)](https://auth0.com/blog/whats-new-nextjs-16/) -- proxy.ts best practices
- [nestjs-pino Request Context Pattern](https://github.com/iamolegga/nestjs-pino) -- AsyncLocalStorage pattern reference
- [NestJS Logging with Correlation IDs](https://medium.com/@jose-luis-navarro/logging-on-nestjs-like-a-pro-with-correlation-ids-log-aggregation-winston-morgan-and-more-d03e3bb56772) -- correlation ID propagation
- [Playwright E2E Best Practices 2026](https://www.browserstack.com/guide/playwright-best-practices) -- test isolation patterns
- [Unified API/DB/E2E Testing with Playwright](https://medium.com/@mahtabnejad/a-unified-approach-to-api-database-and-e2e-testing-with-playwright-daa900908333) -- database lifecycle in tests
- [Jira Automation Triggers](https://support.atlassian.com/cloud-automation/docs/jira-automation-triggers/) -- status->action enterprise pattern
- [Bidirectional Sync Patterns (Unito)](https://unito.io/blog/bidirectional-sync/) -- two-way sync design
- Codebase inspection: `apps/web/src/lib/trpc.ts`, `apps/web/src/components/*/mock-data.ts`, `apps/api/src/infrastructure/trpc/trpc.router.ts`, `apps/api/src/lib/logger.ts`, `apps/api/src/infrastructure/middleware/correlation-id.middleware.ts`
