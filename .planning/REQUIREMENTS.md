# CustomReport v6.0 Requirements

**Milestone:** v6.0 — Roles, Quality, AI & Analytics
**Date:** 2026-04-28
**Source:** `.planning/research/SUMMARY.md` (4 research dimensions + synthesis)

---

## v1 Requirements (this milestone)

### A — Auth & Roles

- [ ] **AUTH-01**: Real Keycloak SAML SSO replaces `AUTH_DEV_MODE` in production; staged via `AUTH_DEV_MODE_ALLOW_TEST=true` for integration suite + mock IdP container in `docker-compose.test.yml`
- [ ] **AUTH-02**: JWT carries `role` claim (`lead` | `head` | `admin` | `viewer`) extracted from Keycloak SAML assertion; SAML attribute mapper verified to send `role`
- [ ] **AUTH-03**: `requireRole(allowed)` tRPC middleware factory in `packages/shared/src/trpc/middleware/role.ts`; emits `leadProcedure` / `headProcedure` / `adminProcedure` / `viewerProcedure`; default-deny — coverage test fails CI if any procedure lacks role declaration
- [ ] **AUTH-04**: Service-layer role filtering — `archive.list` / `archive.detail` / `weeklyReport.get` viewer-scoped to `status: 'published'`; `review.dashboard` becomes `headProcedure`
- [ ] **AUTH-05**: PDF export cookie injection — `requestPdfExport(reportId, requestedBy?, authToken)` signs 5-min scoped JWT at tRPC entry; `pdf-export.processor.ts:69-72` calls `page.context().addCookies(...)` before `page.goto`. **Must ship in same plan as AUTH-01 to avoid silent 401 retry storm.**
- [ ] **AUTH-06**: Frontend role-aware navigation — `app-shell.tsx` hides `/admin`, `/head/*` for non-head; `/lead/*` for viewers; uses existing `useSession()` hook
- [ ] **AUTH-07**: SSR layout-level role gates — `apps/web/src/app/(app)/{admin,head,lead,reports}/layout.tsx` reads session via `cookies()` + tRPC `auth.me`, renders `403` page if role missing (proxy.ts stays cookie-presence only — no JWT verification in Edge runtime)
- [ ] **AUTH-08**: Audit log of role-effecting events (login success/fail, logout, role-denied request) — emitted via `AppLoggerImpl` with structured fields `{event, userId, role, attemptedRole?, ip}`

### B — Quality Polish

- [ ] **QA-01**: Root-cause investigation + fix of 5 Playwright integration test timeouts (`admin-crud:94`, `cross-role-lifecycle:24`, `lead-journey:92`, `lead-journey:143`, `status-risk-sync:23`); all share `TimeoutError: page.waitForResponse 15000ms` on tRPC POST — likely autosave debounce racing test assertions; fix the root cause, NOT 5 bandages
- [ ] **QA-02**: `prisma generate` postinstall hook in `apps/api/package.json` (NOT root) so `pnpm install` on fresh checkout produces working `@prisma/client` types; `turbo.json` has `prisma generate` as `build` predecessor for CI runs that skip postinstall
- [ ] **QA-03**: Delete dead `apps/web/src/proxy.ts` (verified unused via grep); active proxy is `apps/web/proxy.ts`; leave a comment in active file: `// Next.js 16 proxy.ts must live here, NOT under src/`
- [ ] **QA-04**: Doc-sync — rename `userId` → `_userId` in `apps/api/src/modules/period/period.contract.test.ts:65`; flip `.planning/phases/22-*/22-VERIFICATION.md` frontmatter `status: gaps_found` → `status: passed`

### C — AI Features (gated by AI-SPEC.md)

- [ ] **AI-01**: Auto-generated 2-3 sentence executive summary card on assembled report — appears ABOVE head's narrative textarea, never overwrites it; dismissible per session; "Regenerate" button (head-only)
- [ ] **AI-02**: Sentiment badge (`low` / `medium` / `high`) on each Risk row; computed via Haiku 4.5 with structured `betaZodTool` output (no free-text from LLM); cached per Risk content hash
- [ ] **AI-03**: Smart "on-track" advisory icon overlaying lead's traffic-light cell — shows ✓ / ⚠ / ✗ alongside (NOT replacing) lead's chosen colour; computed via Sonnet 4.6 with pre-computed counts in system prompt ("DO NOT change these numbers")

### D — Trend Analytics

- [ ] **ANAL-01**: `analytics.trafficLightHistory` tRPC procedure — input `{projectId?, leadId?, periodFrom, periodTo}`, returns `[{periodStart: ISOString, status, projectId}]`; aggregated server-side with `GROUP BY` over `Report` × `ReportSection` × `ProjectStatus`; cached in Redis 1h TTL, invalidated on `period.publish` / `period.reopen`
- [ ] **ANAL-02**: `analytics.leadVelocity` tRPC procedure — `[{periodStart, completedItems, plannedItems, completionRate}]`; sourced from `Item where type='current' AND completed=true` grouped by report
- [ ] **ANAL-03**: `analytics.periodComparison` tRPC procedure — diff metrics between two specific reports (risk delta, traffic-light delta, velocity delta)
- [ ] **ANAL-04**: `/reports/trends` page — RSC page with three client-boundary chart components in `apps/web/src/components/charts/`: `traffic-light-history.chart.tsx` (sparkline of last 12 periods), `lead-velocity.chart.tsx` (stacked bar), `period-comparison.chart.tsx` (delta table); built with shadcn-ui Chart wrapping `recharts`; null-vs-zero distinction visualised as gaps not zero-values

### E — Email Reminders (extend existing)

- [ ] **NOTIF-01**: T-24h pre-deadline reminder for each lead with `ReportSection.status='draft'` — extends existing `reminders.service.ts` BullMQ pipeline; `kind='deadline'` enum value
- [ ] **NOTIF-02**: T+2h escalation digest to head — fires when lead's section is still `draft` 2h after deadline; aggregates ALL late leads in one email; `kind='escalation'` (NEW enum value); idempotent per `${rule.id}:escalation:${cycleDate}:${recipientEmail}` dedupe key
- [ ] **NOTIF-03**: react-email `.tsx` templates in `apps/api/src/modules/email/templates/` — `deadline.template.ts`, `follow-up.template.ts`, `escalation.template.ts`; each renders both HTML and plaintext (corporate spam filters score multipart higher); `<Tailwind>` wrapper compiles utility classes to inline styles
- [ ] **NOTIF-04**: NestJS `@Cron` scheduler in `apps/api/src/modules/reminders/reminders.scheduler.ts` (`@nestjs/schedule` install) — runs hourly, reads `WHERE status='active' AND fireAt <= now()`, calls existing `requestReminderExecution`; reuses existing dedupeKey
- [ ] **NOTIF-05**: Per-user opt-out flag on `User` model for NOTIF-01 deadline reminders only; **NOTIF-02 escalation NOT opt-outable** (heads must always be notified of misses)
- [ ] **NOTIF-06**: BullMQ rate-limiter on `email-reminder` queue (`{ max: 5, duration: 60_000 }`) below corporate SMTP quota; failed deliveries route to DLQ with admin badge in UI

### F — Mobile Polish

- [ ] **MOB-01**: All 7 pages (`/lead/report`, `/lead/history`, `/head/dashboard`, `/head/report`, `/reports/history`, `/reports/[reportId]`, `/admin/*`) have **no horizontal scroll** at 375px viewport width
- [ ] **MOB-02**: Tap targets ≥44px (iOS HIG) — add `size='touch'` button variant to `packages/ui/src/components/ui/button.tsx` (`h-11 min-w-11`); replaces `h-9` defaults on mobile breakpoints
- [ ] **MOB-03**: `head/dashboard` portfolio table converts to card list at narrow widths (md and below) — desktop wide-table preserved at `lg+`
- [ ] **MOB-04**: `admin/*` tabs convert to native `<select>` dropdown at narrow widths; full tab strip at `md+`
- [ ] **MOB-05**: `lead/report` side-panel risk editor opens as full-screen `Dialog` on mobile (current desktop pattern is a side-panel that overflows)
- [ ] **MOB-06**: PDF preview embed replaced with "Open PDF" button on mobile (8.5×11" embedded PDF unreadable at 375px); real-device iOS Safari pass required before sign-off
- [ ] **MOB-07**: Top app shell — sticky nav becomes hamburger on mobile; brand mark stays visible

### G — Release Checklist

- [ ] **REL-01**: Root `/CHECKLIST.md` template — markdown with sections (Functional Smoke, Auth, PDF, Email, Mobile, AI Insights, Analytics) and signoff line
- [ ] **REL-02**: Per-milestone fill stored under `.planning/milestones/v{N}-CHECKLIST.md` with date-stamp + signoff line
- [ ] **REL-03**: Each checklist item maps 1:1 to a row in `.planning/REGRESSION-TEST-SCENARIOS.md` (cross-link by ID, e.g. `[ ] AUTH-LOGIN-001 — Login as lead`)
- [ ] **REL-04**: At least one checklist item gated by CI (e.g. `pnpm test:ai-eval` green for AI insights row) — prevents pure rubber-stamp culture (G-2 anti-pattern)
- [ ] **REL-05**: HANDOFF.md `## Pending Manual Smoke` section auto-generated from CHECKLIST.md unticked items via small script in `tools/handoff-sync.ts`

---

## Future Requirements (deferred to v6.1+)

### Differentiators (not table stakes)

- **AUTH-09**: Delegated admin (head can promote viewer → lead) — not justified for ~6 leads
- **AUTH-10**: MFA in our app — delegated to Keycloak
- **AI-04**: Period-over-period diff narrative — depends on stable AI-01..03 first
- **AI-05**: Risk theme clustering across leads
- **AI-06**: Head's narrative auto-draft (lead-side equivalent: NEVER)
- **ANAL-05**: Custom dashboard builder
- **ANAL-06**: Item-level drilldown
- **ANAL-07**: Cross-departmental comparison
- **NOTIF-07**: Telegram/Slack channels
- **NOTIF-08**: Recurrence patterns (weekly/biweekly cycles)
- **MOB-08**: Native iOS/Android app
- **MOB-09**: Offline mode

### Plan-time gaps surfaced by research

- **AI-SPEC.md outstanding** — required before C-phase planning. Owner: `/gsd-ai-integration-phase` workflow. Decisions: cost-vs-confidentiality, model assignment confirmation, prompt rubric ≥1024 tokens, golden-set fixtures (8–12 reports), eval-step CI threshold.
- **Real-device iOS Safari pass for MOB-06** — Playwright `devices['iPhone 14']` covers most but PDF embed needs human-on-device confirmation.
- **Golden-set rubric (C-5)** — head/Belyaev domain-expert sign-off required before AI quality CI gate locks in.

---

## Out of Scope (this milestone)

- Self-service role request UI (anti-feature — overkill for internal tool)
- Custom user CRUD beyond samlId-cache (Keycloak owns user identity)
- Password reset (Keycloak)
- Real-time dashboards (poll-based is sufficient)
- AI replacing or auto-filling human narrative textareas (anti-feature — head's narrative is sacred)
- AI changing traffic-light colour autonomously (anti-feature — lead owns colour)
- Sentiment auto-escalation (anti-feature — false positives kill trust)
- Director-level escalation (out-of-scope organisationally)
- "Nag mode" multi-reminder spam (anti-feature)
- Storybook (200+ MB; Playwright projects cover visual regression)
- LangChain.js / Vercel AI SDK / separate Python AI service (use Anthropic SDK directly)
- MJML / hand-rolled email HTML (use react-email)
- Tremor / Plotly / D3 / raw SVG charts (use shadcn-ui Chart over recharts)
- `trpc-shield` (custom middleware factory is simpler)
- Materialised SQL view for analytics (1h Redis cache + GROUP BY is sufficient at 6 leads × 100 periods)

---

## Traceability

Phases → REQ-IDs map will be filled in by the roadmapper agent (Step 10 of `/gsd-new-milestone`).

| Phase | Wave | REQs |
|---|---|---|
| 27 | 1 | (TBD by roadmapper — expected: B + A1 → QA-01..04 + AUTH-03) |
| 28 | 2 | (expected: A2 + A4 + E1+E3 + G → AUTH-04, AUTH-05, NOTIF-01, NOTIF-03, NOTIF-04, REL-01..05) |
| 29 | 3 | (expected: A3 + A5 + A6 + E2 + F + D → AUTH-01, AUTH-02, AUTH-06..08, NOTIF-02, NOTIF-05..06, MOB-01..07, ANAL-01..04) |
| 30+ | 4 | (expected: C — gated by AI-SPEC.md → AI-01..03) |

---

*v1 requirement count: 8 (A) + 4 (B) + 3 (C) + 4 (D) + 6 (E) + 7 (F) + 5 (G) = **37 REQ-IDs***
*Future deferred: 12 differentiators + 3 plan-time gaps*
