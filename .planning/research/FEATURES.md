# Feature Landscape: CustomReport v4.0

**Domain:** Corporate weekly status reporting tool — internal, desktop-first, 3 roles
**Researched:** 2026-04-21
**Supersedes:** v3.0 FEATURES.md (2026-04-11)
**Sources:** PROJECT.md, ROLES.md, REGRESSION-SCENARIOS.md, codebase audit of apps/web/src/, UX audit memory

---

## Context: What Already Exists

This is a redesign + completion milestone, not a greenfield build. What's already functional:

**Working backend (422 unit tests passing):**
- 20+ tRPC endpoints across 7 namespaces: reports, review, pdfExport, admin, archive, reminders, carryOver
- SAML SSO via Keycloak, dev-login bypass for testing
- BullMQ async jobs for PDF export and email reminders
- Auto-create weekly report on lead login

**Working frontend components:**
- `ReportSectionForm` — lead form with 5 collapsible sections, 300ms autosave debounce, submit dialog
- `SubmissionDashboard` — card grid showing lead submission status with submitted/draft badges
- `AssembledReportReview` — head review page (currently incomplete — shows only first project + first item per section)
- `AdminPanel` — tabbed CRUD for users/projects/periods/reminders with DataTable + CrudSheet
- `PublishedReport` — archive detail view with PDF export controls
- `AppShell` — collapsible sidebar, breadcrumb header, role-aware nav

**Existing design infrastructure:**
- Dark theme CSS tokens applied, Tailwind v4 `@theme` directive in use
- shadcn/ui components: Card, Badge, Button, Collapsible, DataTable, CrudSheet, TrafficLightBadge, ConfirmDialog, AutosaveIndicator, Separator, Avatar, Tabs, and more

**Core user complaint (from UX audit 2026-04-20):**
- "Куцо, как 90-е" — functional but visually bare, no visual hierarchy, elements don't feel interactive
- P0: Delete item/risk/decision without confirmation (accidental data loss)
- P1: Traffic light buttons have no hover effect, not obviously clickable; new item does not auto-focus; no focus-visible rings
- P1: Assembled report review shows only first project/item — head cannot actually review the full report

---

## Table Stakes

Features a professional corporate reporting tool must have. Missing = tool feels unfinished.

### Lead Workflow

| Feature | Why Expected | Current State | What Needs Work |
|---------|--------------|---------------|-----------------|
| Dynamic add/remove for all content types | Items/risks/decisions grow unpredictably per week; user explicitly requested this | Implemented in all editors | P0: No deletion confirmation — accidental data loss. Add `ConfirmDialog` before remove |
| Autosave with visible feedback | Form data must not be lost on nav | 300ms debounce + AutosaveIndicator | Indicator exists; add unsaved-changes warning on navigation away |
| Traffic light picker — clearly interactive | Traffic lights are the core status signal read by the director | Plain radio text buttons | P1 (UX audit): needs colorful circular buttons with hover ring; currently looks like an unstyled form |
| Submit-gate validation that guides, not blocks | Lead must know what's missing before submit | Errors shown after submit attempt only | Add per-section completeness indicator in collapsible header; show "complete / incomplete" visually alongside count badge |
| Draft vs submitted state — strong visual mode switch | Submitted section is immutable; UI must make this obvious | Badge + isReadOnly flag | "Section submitted and locked" badge is too subtle; need full form visual dimming, section headers greyed, submit button replaced by locked state |
| New item auto-focus | After "Add item", cursor should land in the new field | Missing (P1 UX audit) | `useEffect` + `ref.focus()` on add event |
| Keyboard navigation — focus-visible rings | Weekly power users rely on keyboard | Missing (P1 UX audit) | Add `focus-visible:ring-2 ring-ring ring-offset-2` to all interactive elements |
| Section completeness summary | Lead sees at a glance which of the 5 sections need attention | Count badges only | Distinguish "count > 0" from "section complete for submit"; show green checkmark on section header when complete |

### Head Workflow

| Feature | Why Expected | Current State | What Needs Work |
|---------|--------------|---------------|-----------------|
| Dashboard: at-a-glance status with count | Head's Friday question: "Who's done?" — needs immediate answer | Card grid with badges | Missing: "N of 6 submitted" summary at top; no visual urgency for near-deadline |
| Assembled report: full section display | Head reviews all content before publishing; currently reviewing blind | Shows only first project + first item per section | Critical functional gap — full items/risks/decisions/priorities must be visible for all leads. This is the most important feature fix in v4.0 |
| Portfolio overview — visual traffic light | Worst-case traffic light is the department's headline signal | Text badge only | Replace with `TrafficLightBadge` component (already exists) + summary counts (green/yellow/red totals) |
| Publish confirmation with irreversibility warning | Publishing is irreversible; must be explicit | ConfirmDialog exists with correct warning text | Good; verify it's clear enough |
| PDF export — clear status tracking | Head needs to know when the PDF is ready for download | Request + poll pattern exists | Status polling UX is undefined — needs progress indicator or toast chain: "Export requested → Processing → Ready. Download." |
| Admin CRUD ergonomics — all 4 entities | Users/projects/periods/reminders management | DataTable + CrudSheet pattern implemented | Verify delete project uses soft-delete (archived: true, not hard delete); verify success toasts fire for all mutations |
| Reminder execution feedback | Manual trigger must show if already sent (deduplication) | Implemented at backend | Front-end must distinguish "queued" vs "already sent (deduplicated)" in the execution list |
| Carry-over trigger with feedback | One-click carry of next items; head must know it succeeded | Implemented | UX unverified — needs success toast with count of items/decisions carried |

### Viewer Workflow

| Feature | Why Expected | Current State | What Needs Work |
|---------|--------------|---------------|-----------------|
| Archive list — chronological, scannable | Viewers browse historical reports | List sorted by publishedAt desc | Sufficient for v4; no filter needed (small dataset) |
| Archive detail — full report content | Viewers need complete data, not a summary | PublishedReport component exists | Content fidelity needs verification; must match what head saw before publishing |
| PDF download | Primary distribution artifact for director and other units | Download button in PublishedReport | Async job polling UX same concern as head's PDF export |
| No edit affordances rendered | Viewer must never see edit controls | Enforced at tRPC middleware level | Front-end must not render edit buttons/forms when role is viewer; verify in code |

### Cross-Role / Global

| Feature | Why Expected | Current State | What Needs Work |
|---------|--------------|---------------|-----------------|
| Loading skeletons on every data fetch | Network calls take time; blank screens feel broken | `page-skeleton.tsx` exists | Wire into all 6+ pages consistently; verify not showing after data loads |
| Error states with actionable messages | tRPC errors must surface meaningfully, not as 500 screens | `query-error.tsx` exists | Verify all pages handle error state; include retry action |
| Empty states wired into all pages | First-time use, no-data conditions need clear messaging | `empty-state.tsx` exists but not wired into all pages | Phase 15 handoff: wire into 6 pages — this is in-progress |
| Toast notifications for all mutations | Save/submit/publish/admin CRUD must confirm success or failure | Sonner used in form + review; not verified everywhere | Audit: admin CRUD mutations, reminder execution, carry-over — all need toasts |
| SAML login error handling | Login failure must be comprehensible, not a blank page | Auth error page exists | Verify error messages are human-readable |

---

## Differentiators

Features that elevate the tool beyond "functional form." Not expected by users who have never had this, but valued once seen.

### Visual Design

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Professional dark theme with proper visual hierarchy | Replaces "wall of cards" — content breathes, sections are visually distinct | Medium | Design token pass needed; tokens exist but not consistently applied |
| Traffic light buttons as colored circular indicators | Core status signal becomes immediately legible — green circle = safe, red = crisis | Low | CSS-only change; UX audit explicitly requests this |
| Micro-animations on add/remove | Items fade in/out instead of snap-appearing; feels polished | Low | Tailwind `animate-fade-in` already exists in codebase; apply to new/removed items |
| Section header with completion state | Header shows green checkmark when section is ready for submit | Low | New logic in collapsible header; no new components needed |
| Submission readiness bar | Lead sees "3 of 5 sections ready" before hitting Submit | Medium | New component; sticky summary near the Submit button area |

### Head-Specific Intelligence

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Dashboard: "N of M submitted" summary header | Instant answer to the head's primary question — no counting cards | Low | Computed from `rows.length` and `rows.filter(r => r.status === 'submitted').length` |
| Portfolio overview as large visual traffic light | "Department is YELLOW this week" is a one-second message | Low | `TrafficLightBadge` already exists; just needs prominent placement |
| Section jump navigation in assembled report | 6 sections is a lot to scroll; sticky left index with smooth scroll-to | Medium | Sticky `<nav>` with `scrollIntoView` — no library needed |
| Deadline proximity indicator | If period.deadline is configured, "Due in 2 hours" on dashboard adds urgency | Medium | Requires period.deadline surfaced in the dashboard query response |

### E2E Testing Infrastructure

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Page Object Model (POM) per role | 81 test scenarios remain maintainable when tests are organized by role with shared selectors | Medium | `tests/e2e/pages/lead.page.ts`, `head.page.ts`, `viewer.page.ts` |
| Auth session fixtures via dev-login | Pre-authenticated sessions bypass SAML in tests — fast, reliable, no IdP dependency | Medium | Playwright `storageState` + `GET /auth/dev-login?email=...` endpoint (already exists) |
| Seed database fixtures | Deterministic test data prevents flaky tests from state pollution | Medium | Playwright `globalSetup` runs Prisma seed: 2 leads, 1 head, 1 viewer, 3 projects, 1 period |
| Visual regression baselines | Capture design baseline after redesign; catch accidental style regressions | Low-Medium | `expect.toHaveScreenshot()` — establish after redesign is stable |
| PDF output validation | Assert that PDF export completes and produces a non-empty file | Medium | Playwright downloads API + file size assertion; text content via pdf-parse if needed |

---

## Anti-Features

Things to explicitly NOT build in v4.0.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time collaborative editing | Each lead has their own section — no shared editing conflict exists; adds WebSocket/CRDT complexity for zero benefit | Autosave is sufficient; leads work in isolation |
| Drag-and-drop item reordering | Priorities have explicit ranks; items have no user-visible order requirement | Rank field for priorities; append-only for items |
| Custom theme switcher (light/dark toggle) | Internal tool, not a consumer product; one dark theme, done | Enforce dark theme globally; no toggle |
| Jira/GitLab integration | External auth, webhooks, error handling for zero-requested-feature in v4 | Manual entry is the intentional v4 design; defer to v5+ |
| Trend analytics / history charts | Data model supports it; UI does not — this is v5 work | Archive exists; analytics deferred per PROJECT.md |
| Mobile app or true mobile layout | Desktop-first internal tool; 6 leads use corporate workstations | Sidebar collapses on small screens; min-width ~1024px acceptable |
| Telegram/Slack notifications | Email SMTP is the notification channel; messaging integrations are out of scope | Email reminders via BullMQ already implemented |
| Rich text / Markdown in item fields | Plain text keeps data clean for PDF rendering; Markdown adds parsing complexity | Plain textarea with 500-char max |
| Inline comments / back-and-forth review | No review dialogue is defined; head edits sections directly in draft mode if needed | Head can edit sections via AssembledReportReview before publish |
| pgvector / semantic search / RAG | Listed in v3.0 FEATURES.md as differentiators; v4.0 scope is completeness + redesign, not analytics | Defer to v5+ per PROJECT.md |
| Submission deadline countdown | Requires period.deadline surfaced in dashboard query — schema change | Defer unless period.deadline already flows through to the frontend |

---

## Feature Dependencies

```
Backend edge-cases passing (all 81 regression scenarios)
  → E2E tests (tests will fail if backend responses are wrong)

Auth fixture (dev-login + Playwright storageState per role)
  → All E2E test suites (no test can run without a session)

Seed database fixtures (globalSetup)
  → All E2E test suites (deterministic data required for assertions)

Assembled report full display (all sections, all fields)
  → Head publish flow (head cannot properly review a partial view)
  → PDF content fidelity (PDF must mirror the full assembled report)
  → E2E: head journey tests (tests that assert section content will fail on partial display)

Design token pass (spacing, color, typography consistency)
  → Traffic light circular buttons
  → Section completion state
  → Visual regression baselines (baselines must be established after design is final)

Empty states wired into pages
  → Visual regression baselines (baselines must capture empty state correctly)

Delete confirmation dialogs
  → E2E tests (tests that verify delete must also test the confirmation step)
```

---

## MVP for v4.0 — Priority Order

**Strict sequence: backend first, then UI, then E2E.**

**1. Backend completeness (before anything else)**
- Prisma migration for reminder schema (kind/fireAt/timezone/status/version)
- Fix all remaining edge-cases to make 81 regression scenarios pass
- Do not start UI redesign until backend is stable — E2E tests will catch regressions

**2. Assembled report full display (critical functional fix, not cosmetic)**
- `AssembledReportReview` must show all items/risks/decisions/priorities per section
- This is the most important UI fix — head cannot do their job without it

**3. UI redesign — highest-value surfaces first**
- Traffic light buttons → colorful circular indicators
- Section headers → completion state (checkmark when ready)
- Delete confirmation for all destructive actions
- New item auto-focus
- Focus-visible rings on all interactive elements
- Form visual mode: submitted = dimmed/locked state
- Dashboard summary: "N of 6 submitted"
- Portfolio overview: visual traffic light badge prominently displayed

**4. E2E test suite**
- Auth fixtures (dev-login + storageState per role)
- Seed script (globalSetup)
- Page Object Model classes per role
- Test suites mapped to regression scenarios: L-*, H-*, V-*, X-*, D-*
- PDF output validation

**5. Polish pass**
- Toast audit: verify all mutations have success/error toasts
- Empty state wiring into remaining pages
- Loading skeleton consistency
- Visual regression baselines (after design is stable)

**Defer from v4.0:**
- Section jump navigation in assembled report (useful, not blocking)
- Deadline proximity indicator (needs schema change)
- Trend analytics, pgvector, RAG (v5+)

---

## E2E Test Coverage Map

The 81 regression scenarios map directly to Playwright test suites.

| Suite | Scenarios | Playwright File |
|-------|-----------|-----------------|
| Lead: auth + form | L-001 to L-013 | `tests/e2e/lead/form.spec.ts` |
| Lead: validation | L-014 to L-022 | `tests/e2e/lead/validation.spec.ts` |
| Head: dashboard + review | H-001 to H-012 | `tests/e2e/head/review.spec.ts` |
| Head: admin CRUD | H-013 to H-021 | `tests/e2e/head/admin.spec.ts` |
| Head: reminders + carry-over | H-022 to H-032 | `tests/e2e/head/operations.spec.ts` |
| Viewer | V-001 to V-011 | `tests/e2e/viewer/archive.spec.ts` |
| Cross-role lifecycle | X-001 to X-006 | `tests/e2e/cross-role/lifecycle.spec.ts` |
| Data integrity | D-001 to D-010 | `tests/e2e/data/validation.spec.ts` |

**Auth fixture pattern:** Use existing `GET /auth/dev-login?email=...` endpoint to create sessions. In Playwright `globalSetup`, authenticate once per role and save to `storageState` files. Each test imports the relevant `storageState` via `use: { storageState: 'lead.json' }` in the fixture.

**Seed pattern:** `globalSetup` runs a Prisma seed: 2 lead users (lead1@test.com with 2 projects, lead2@test.com with 1 project), 1 head user, 1 viewer user, 1 active report period. Each suite uses `beforeEach` to reset transient state (draft sections, submissions) while preserving the seeded entities.

**Isolation strategy:** Do not reset the full database between tests — too slow. Reset only the tables affected by the test scenario (ReportSection, Item, Risk, Decision, Priority, ProjectStatus). Keep User, Project, ReportPeriod stable across the suite.

---

## Sources

- `/Users/ap/work/sdlc/customreport/.planning/PROJECT.md` — scope, requirements, decisions
- `/Users/ap/work/sdlc/customreport/docs/api/ROLES.md` — role capability matrix (22 capabilities across 3 roles)
- `/Users/ap/work/sdlc/customreport/docs/api/REGRESSION-SCENARIOS.md` — 81 acceptance scenarios (L-001..L-022, H-001..H-032, V-001..V-011, X-001..X-006, D-001..D-010)
- `/Users/ap/.claude/projects/-Users-ap-work-sdlc-customreport/memory/project_ux_audit.md` — UX audit P0/P1/P2 issues from 2026-04-20 session
- Codebase inspection: `apps/web/src/components/**/*.tsx`, `apps/web/src/app/**/*.tsx`
- Confidence: HIGH — all findings derived from live codebase and project documentation, not from training data or web search
