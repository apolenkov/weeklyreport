# Architecture Patterns: v4.0 Backend Completeness & UI Redesign

**Domain:** Weekly status report system (Next.js 16 + NestJS 11 + Prisma + tRPC monorepo)
**Researched:** 2026-04-21
**Focus:** How UI redesign and E2E testing integrate with the already-wired v3.0 architecture

---

## Current Architecture Baseline (Post-v3.0)

v3.0 delivered a fully styled, fully wired application. This is the starting point for v4.0 — not a blank canvas.

```text
apps/web (Next.js 16)
├── 9 pages (layout + 7 route pages + auth error page + print page)
├── components/
│   ├── navigation/: AppShell, RoleNav, MobileNav, NavUser
│   ├── report-section/: ReportSectionForm + 6 sub-editors
│   ├── head/: SubmissionDashboard, AssembledReportReview
│   ├── report/: PublishedReport, ArchiveReportList
│   ├── admin/: AdminPanel
│   ├── common/: QueryError, PageSkeleton, EmptyState
│   └── providers/: TRPCProvider (wraps all pages in root layout)
├── tRPC client: httpBatchLink + superjson transformer
│   credentials: 'include', proxied through /trpc (Next.js rewrites)
├── proxy.ts: cookie-based auth redirect (renamed from middleware.ts)
├── styles/app.css: @import "tailwindcss" + @source directives
├── e2e/: Playwright test infrastructure + spec files
└── Design system: OKLCH deep navy palette, Geist fonts, animation tokens

packages/ui
├── src/
│   ├── components/: shadcn/ui primitives (Button, Card, Badge, Dialog,
│   │   Table, Input, Select, Textarea, Alert, Tabs, Sidebar,
│   │   Avatar, Progress, Separator, Collapsible, ConfirmDialog, ...)
│   ├── styles/globals.css: Tailwind @theme tokens (OKLCH palette)
│   └── index.ts: all primitives re-exported
└── components.json: shadcn CLI config (Tailwind v4, monorepo-aware)

apps/api (NestJS 11)
├── 8 domain modules: reportSections, review, publication, pdfExport,
│   admin, reminders, carryOver, archive
├── tRPC router: 7 namespaces, 20+ procedures
│   protectedProcedure: any authenticated user
│   headProcedure: head role only
├── Prisma repositories: 8 *PrismaRepository implementations
├── BullMQ: pdf-export + email-reminder queues (pdf-export active,
│   email-reminder wired but requires SMTP config)
├── Auth: SAML + JWT + dev mode (AUTH_DEV_MODE=true bypasses SAML)
│   dev-login endpoint: /auth/dev-login?role={lead|head|viewer}
└── Health endpoint: /health/live (used by Playwright webServer)

packages/shared
├── Zod schemas: report.ts, auth.ts — all domain types
├── tRPC router type: AppRouter (exported for frontend type inference)
└── Validation schemas: paginationInputSchema, draftSaveSchema,
    submitSectionSchema, adminUserSchema, adminProjectSchema,
    reportPeriodSchema, adminReminderRuleSchema, myHistoryEntrySchema

prisma/
├── schema.prisma: 14 models (Report, ReportSection, Item, Risk,
│   Decision, Priority, ProjectStatus, Project, User, ReminderRule, ...)
├── seed.ts: 1 head + 6 leads + projects + sample report with Lead 1 submitted
└── Prisma 7 (TypeScript-based, no Rust, 3x faster queries)

E2E infrastructure (apps/web/e2e/)
├── playwright.config.ts: dual webServer (API port 3101, Web port 3100),
│   reuseExistingServer in dev, AUTH_DEV_MODE=true, LOG_LEVEL=warn
├── auth.setup.ts: visits /auth/dev-login?role= per role, saves storageState
├── fixtures.ts: leadPage, headPage, viewerPage (per-role browser contexts)
├── helpers/test-utils.ts: waitForAutosave, expectToast, submitSection,
│   publishReport — reusable helpers
├── *.spec.ts (root level): shallow smoke tests — page navigation,
│   heading visibility, basic data assertions
└── journeys/*.spec.ts: role journey stubs (lead, head, admin, carry-over,
    pdf-export, archive) — mostly shallow, need depth
```

---

## Component Boundaries for UI Redesign

### What "redesign" means in v4.0 context

v3.0 installed shadcn/ui, defined OKLCH design tokens, animated all transitions, and added skeletons/empty states. The current UI is styled and functional. The v4.0 "UI redesign" targets visual overhaul and UX polish — not structural rewiring.

The 35-item audit from v3.0 (P1/P2/P3 findings) drove changes through `4ec7415`. Eight P3 items were explicitly deferred. The v4.0 redesign addresses remaining deficiencies and a ground-up design refresh.

**What does NOT change during UI redesign:**
- tRPC data flow — all `trpc.*.useQuery()` / `trpc.*.useMutation()` call sites
- Route structure — `(app)/lead/report`, `(app)/head/dashboard`, etc.
- Component boundaries — AppShell > [page content], ReportSectionForm > [6 sub-editors]
- packages/shared Zod schemas (unless backend fixes require new fields)
- packages/ui primitive APIs (Button, Card, Badge, etc.) — only design tokens change

**What changes during UI redesign:**

```text
packages/ui/src/styles/globals.css
  Purpose: Design tokens only. Palette, typography scale, radius, shadows.
  Change type: MODIFY — update OKLCH values, add new semantic tokens if needed.
  Owner: UI redesign phase.

apps/web/src/styles/app.css
  Purpose: @import chain, @source directives, Tailwind utility safelist.
  Change type: MODIFY only if new packages need @source, or safelist grows.
  Owner: UI redesign phase (if needed).

All components in apps/web/src/components/**
  Purpose: Business components with shadcn/ui primitives.
  Change type: MODIFY className strings, layout proportions, icon choices.
  Critical: No component API changes unless backend contract changes.
  Owner: UI redesign phase.

apps/web/src/app/(app)/*/page.tsx (all pages)
  Purpose: Page-level layout wrappers using AppShell.
  Change type: MODIFY className on outer divs, spacing tokens.
  Not in scope: Moving AppShell into (app)/layout.tsx — see tech debt note below.
  Owner: UI redesign phase.

apps/web/src/app/(app)/reports/[reportId]/print/page.tsx
  Purpose: PDF print template — rendered by Playwright's headless Chromium.
  Change type: MODIFY — visual quality improvements only.
  Constraint: Must use print-color-adjust: exact, no navigation elements,
    break-inside: avoid on sections. printBackground: true in PDF options.
  Owner: UI redesign phase.
```

### Component dependency graph (build order within UI redesign)

```text
Step 1: packages/ui/src/styles/globals.css (design tokens)
  ↳ Everything depends on tokens. Change tokens first.

Step 2: AppShell + RoleNav (navigation/app-shell.tsx, navigation/role-nav.tsx)
  ↳ Wraps every page. Changes here affect all pages.
  ↳ Deferred P3 items: nav grouping, collapsed sidebar padding, POST logout.

Step 3: Lead form components (report-section/ directory — 7 files)
  ↳ Primary user-facing surface (6 leads use this weekly).
  ↳ Priority: ProjectStatusGrid (traffic lights), ReportSectionForm (outer shell),
    AutosaveIndicator, ItemsEditor, RisksEditor, DecisionsEditor, PrioritiesEditor.

Step 4: Head views (head/ directory — 2 files)
  ↳ SubmissionDashboard (KPI cards + lead cards grid).
  ↳ AssembledReportReview (full report preview + publish flow).

Step 5: Report views (report/ directory — 2 files)
  ↳ PublishedReport (public-facing, director sees this).
  ↳ ArchiveReportList (table with date sorting, status badges).

Step 6: Admin panel (admin/admin-panel.tsx)
  ↳ Tabs + DataTable + Dialog pattern. Most complex, least user-visible.

Step 7: Print template (/reports/[reportId]/print/page.tsx)
  ↳ PDF output. Visual quality matters — this is delivered to director.
  ↳ Validate with: pnpm playwright -- test --grep pdf
```

### Tech debt note: AppShell ownership

Every page (`head/dashboard/page.tsx`, `lead/report/page.tsx`, etc.) imports and renders `<AppShell role="..." currentPath="...">` itself. The `(app)/layout.tsx` is an explicit passthrough with a code comment: "When server-side session extraction is implemented, this layout will read the session cookie and provide AppShell here."

v4.0 UI redesign does NOT move AppShell into the shared layout. That requires server-side session reading, which is a separate architectural concern. Phases should treat each page independently wrapping AppShell as the stable pattern.

---

## E2E Test Architecture

### Current state (what exists and works)

The E2E infrastructure is operational. Auth, fixtures, dual-server config, and utility helpers are wired. The gap is test depth, not plumbing.

```text
What works today:
  auth.setup.ts     — authenticates all 3 roles, saves storageState to .auth/
  fixtures.ts       — provides leadPage, headPage, viewerPage (isolated contexts)
  playwright.config — dual webServer (API on 3101, Web on 3100)
  test-utils.ts     — waitForAutosave, expectToast, submitSection, publishReport
  journeys/         — directory exists with stubs for all major flows

What needs depth:
  Root-level *.spec.ts — shallow (navigation + heading check only)
  journeys/*.spec.ts   — shallow (same pattern as root specs, not actual journeys)
```

### Seed data contract (hard dependency for all E2E)

All E2E tests depend on `prisma/seed.ts` being run before tests. The seed creates deterministic users and data that assertions rely on.

```text
Seed contract (must remain stable across all phases):
  Users:   lead1@customreport.dev → "Lead 1" (role: lead)
           head@customreport.dev  → "Head"   (role: head)
           viewer@customreport.dev → "Viewer" (role: viewer)
           (+ 5 more leads: Lead 2 through Lead 6)

  Report:  1 active report period
  Lead 1 section: status = submitted (HARD constraint — tests assert on this)
  Lead 2-6 sections: status = draft

  Auth dev mode:
    /auth/dev-login?role=lead   → authenticates as Lead 1
    /auth/dev-login?role=head   → authenticates as Head
    /auth/dev-login?role=viewer → authenticates as Viewer
```

Any changes to seed.ts that alter Lead 1's status, user names, or active period must be accompanied by E2E spec updates. Backend edge-case fixes that add new seed rows are safe as long as existing rows are unchanged.

### E2E test organization (established pattern, extend it)

```text
apps/web/e2e/
├── auth.setup.ts              — one-time auth per test run
├── fixtures.ts                — extend here if new roles or contexts needed
├── helpers/test-utils.ts      — add reusable helpers here (not inline in specs)
├── *.spec.ts (root)           — smoke tests: page loads, heading visible, basic data
└── journeys/
    ├── lead-journey.spec.ts   — full lead workflow: view form → fill → autosave → submit
    ├── head-journey.spec.ts   — full head workflow: dashboard → assembled report → publish
    ├── admin-crud.spec.ts     — CRUD: create user, project, period, reminder
    ├── carry-over.spec.ts     — head executes carry-over, verifies items moved
    ├── pdf-export.spec.ts     — head requests PDF, polls status, verifies completion
    ├── archive-history.spec.ts — viewer browses archive, opens report detail
    └── head-publication.spec.ts — isolated publish flow assertions
```

**Root specs vs. journeys distinction:**
- Root specs: single-role, single-page navigation checks. Run fast, always pass.
- Journey specs: multi-step flows that follow a real user workflow. Cross-page, stateful.
- Never put `submitSection()` or `publishReport()` logic in root specs — those belong in journeys.

### E2E selectors: what to use and what to avoid

```text
Stable selectors (use these):
  getByRole('heading', { name: 'My Report', level: 1 })
  getByRole('button', { name: 'Submit Section' })
  getByRole('table', { name: 'Submission dashboard' })
  getByRole('group', { name: 'Project Statuses' })
  getByRole('radiogroup').first()
  getByRole('radio', { name: /green/i })
  getByRole('textbox', { name: 'Priority 1' })
  getByText('Lead 1')
  getByText('Submitted', { exact: true })
  locator('[data-sonner-toast]')   ← toast assertions

Fragile selectors (avoid):
  locator('.bg-success')           ← breaks on any Tailwind refactor
  locator('.text-3xl')             ← no semantic meaning
  locator('div.space-y-8')         ← layout classes change during redesign
  page.evaluate(() => localStorage) ← removed in v3.0, never bring back
```

### E2E and UI redesign ordering constraint

E2E tests must be written or updated AFTER the component they test has its final DOM structure from the redesign. During active UI redesign, component role/aria attributes can shift (e.g., a div converted to a semantic button, a role added to a table). Writing E2E tests against an intermediate state wastes effort.

**Correct ordering:**
```text
1. Backend edge-case fixes (prisma migration, regression scenarios)
2. UI redesign (components get final DOM/aria structure)
3. E2E depth (write journey tests against stable, redesigned UI)
```

### Per-role access matrix (enforced by E2E role fixture)

```text
Page                       lead    head    viewer
/lead/report               own     yes     no (redirect)
/lead/history              own     yes     no (redirect)
/head/dashboard            yes*    yes     no (redirect)
/head/report               no      yes     no (redirect)
/admin                     no      yes     no (redirect)
/reports/[id]              yes     yes     yes
/reports/history           no      yes     yes
/reports/[id]/print        internal (API renders, not user-navigated)

* review.dashboard uses protectedProcedure (any auth user), so lead CAN load
  /head/dashboard — this is intentional and tested in head-dashboard.spec.ts
```

---

## Data Flow: v4.0 (unchanged from v3.0)

```text
User browser
    │
    ├── Auth (SAML or dev-login) ──► JWT cookie stored in browser
    │
    └── tRPC calls via httpBatchLink
           url: '/trpc' (proxied by Next.js to API:3001/trpc)
           transformer: superjson (handles Date serialization)
           credentials: 'include' (sends JWT cookie)
                │
                ▼
           NestJS API (port 3001)
                │
                ├── trpc.context.ts → verifies JWT → attaches session
                │   (or DEV_SESSION when AUTH_DEV_MODE=true)
                │
                ├── protectedProcedure (any role)
                │   or headProcedure (role === 'head' check)
                │
                └── Domain services
                        │
                        ├── PrismaRepositories → PostgreSQL (port 5432)
                        └── BullMQ producers → Redis (port 6379)
                                 │
                                 └── BullMQ workers
                                       ├── pdf-export: Playwright renders
                                       │   /reports/[id]/print → PDF file
                                       └── email-reminder: nodemailer → SMTP
```

No new network paths are added in v4.0. The data flow diagram is identical.

---

## Backend Edge-Case Fix: Ripple Analysis

Backend fixes for the 81 regression scenarios may touch packages/shared Zod schemas. Any schema change propagates:

```text
packages/shared schema change
    │
    ├── apps/api: service input/output types update (must pass TypeScript strict)
    ├── apps/web: component props types update (may require component changes)
    └── apps/web/e2e: assertions that check field values may need update

Specifically:
  adminReminderRuleSchema: reminder kind/fireAt/timezone/status/version
    → Prisma migration required (already identified in v4.0 scope)
    → AdminPanel component reminder tab may need new fields
    → E2E admin-crud.spec.ts assertions on reminder fields need update
```

Build order enforced by this ripple: prisma migrate → backend fix → shared schema → frontend component → E2E assertion.

---

## Phase Structure Recommendations

Based on the dependency analysis above, v4.0 phases should follow this ordering:

```text
Phase A: Backend completeness
  ├── Prisma migration for reminder schema (kind/fireAt/timezone/status/version)
  ├── Backend edge-case fixes for all 81 regression scenarios
  └── Validate: 81 regression scenarios pass, 422+ unit tests still pass

Phase B: UI redesign
  ├── Dependency: Phase A complete (API contract is stable for components to consume)
  ├── Design token update in packages/ui/src/styles/globals.css
  ├── AppShell + navigation (wraps everything — redesign first)
  ├── Lead report form (primary user surface — highest priority)
  ├── Head views (dashboard, assembled report, publish flow)
  ├── Report views (published report, archive — director-facing)
  ├── Admin panel (internal, lower visual priority)
  └── Print template (PDF output — verify with Playwright)

Phase C: E2E journey depth
  ├── Dependency: Phase B complete (DOM structure stable, aria labels final)
  ├── Deepen journeys/lead-journey.spec.ts (fill form fields, verify autosave)
  ├── Deepen journeys/head-journey.spec.ts (submit check, publish, verify viewer)
  ├── Deepen journeys/admin-crud.spec.ts (user + project + period + reminder CRUD)
  ├── Deepen journeys/carry-over.spec.ts (execute carry-over, verify items moved)
  ├── journeys/pdf-export.spec.ts (request PDF, poll status, verify file)
  └── Cross-role scenarios: lead submits → head sees update → viewer can view
```

**Why this order:**
1. Backend fixes first — avoids UI components being built on incorrect API responses.
2. UI before E2E — avoids writing E2E selectors against intermediate DOM structures that will change during redesign.
3. Navigation before content pages — AppShell wraps everything; token changes ripple into it first.

---

## Anti-Patterns to Avoid

### AP-1: E2E tests written during UI redesign
**What goes wrong:** Selectors written against intermediate component structure break when the redesign completes.
**Prevention:** Freeze E2E writing during active redesign phases. Only deepen journeys after final DOM is stable.

### AP-2: Design token changes in apps/web instead of packages/ui
**What goes wrong:** Tokens defined in app layer are not reusable, override the package layer inconsistently.
**Prevention:** All OKLCH palette, radius, and typography variables live exclusively in `packages/ui/src/styles/globals.css`. `apps/web/src/styles/app.css` only adds `@source` directives and utility safelists.

### AP-3: Component API changes during UI redesign
**What goes wrong:** Changing component props (e.g., adding a required field to `<SubmissionDashboard rows={...}>`) during the redesign creates cascading compile errors across the monorepo.
**Prevention:** Treat redesign as className-only changes. If props need to change due to backend API changes, that happens in Phase A (backend fixes), not Phase B (UI redesign).

### AP-4: CSS class selectors in E2E tests
**What goes wrong:** `locator('.bg-success')` breaks on any Tailwind refactor.
**Prevention:** Enforce semantic selectors: `getByRole`, `getByLabel`, `getByText`, `getByTestId`. See selector table above.

### AP-5: Touching seed.ts without updating E2E
**What goes wrong:** Tests that assert `getByText('Lead 1')` or `getByText('Submitted')` break silently if seed data changes.
**Prevention:** Lead 1 stays submitted in seed data. New regression fixtures go into separate seed helpers, not replacing existing rows. Any seed.ts change must be accompanied by E2E spec review.

### AP-6: Moving AppShell into shared layout during redesign
**What goes wrong:** `(app)/layout.tsx` is a passthrough by design — server-side session extraction is not implemented. Centralizing AppShell there requires reading the session cookie in a React Server Component, which is a different architectural undertaking than visual redesign.
**Prevention:** Keep per-page `<AppShell role="..." currentPath="...">` pattern. Document as deferred tech debt for a future phase.

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Current architecture state | HIGH | Read from actual source files |
| tRPC data flow | HIGH | trpc.ts, trpc.router.ts, playwright.config.ts verified |
| E2E infrastructure | HIGH | auth.setup.ts, fixtures.ts, test-utils.ts, playwright.config.ts read directly |
| Seed data contract | HIGH | auth.setup.ts + lead-report-entry.spec.ts assertions confirm "Lead 1" / "Submitted" |
| UI redesign scope | HIGH | globals.css OKLCH tokens, component files, STATE.md v3.0 history all read |
| Build order (A→B→C) | HIGH | Ripple analysis from schema → component → E2E is deterministic |
| AppShell tech debt | HIGH | (app)/layout.tsx passthrough comment is explicit in the file |
