# Project Research Summary — CustomReport v6.0

**Project:** CustomReport
**Domain:** Internal weekly status-reporting SaaS (CoreDev department, ~6 leads + head + viewers)
**Researched:** 2026-04-28
**Milestone scope:** v6.0 — Roles, Quality, AI & Analytics (additive to shipped v5.0 codebase)
**Confidence:** HIGH overall (strict additive scope; existing stack untouched; AI/charts the only MEDIUM areas)

> **Scope guard.** This synthesis covers only the seven v6.0 feature areas (A–G). The v1.0–v5.0 codebase, validated requirements, and stack (Next.js 16 / NestJS 11 / tRPC 11 / Prisma 7 / Postgres 15 / Redis 7 / BullMQ 5 / Playwright 1.50 / shadcn-ui / Tailwind v4 / Zod 4 / `@node-saml/passport-saml` 4 / Keycloak 26 / nodemailer) are NOT re-evaluated. They are the baseline.

---

## Executive Summary

v5.0 shipped a structurally complete CustomReport (50 commits, 48/48 requirements, 21-test integration suite first-running on 2026-04-26) but in **admin-only mode**: every authenticated user is treated as `head`, real RBAC is stubbed, and the `Phase 24` cookie-injection seam in `pdf-export.processor.ts` is inert pending real auth. v6.0 closes that auth debt, stabilises the integration suite as a true CI gate, and layers four product increments (AI insights, trend analytics, email reminders, mobile polish) plus a release-day checklist.

The four research files agree unanimously: **only three v6.0 feature areas need new npm packages** (C: `@anthropic-ai/sdk`; D: `recharts` + shadcn-ui chart wrappers; E: `react-email` + `@react-email/components`). A, B, F, G are config/refactor/cleanup and reuse what's already there — custom tRPC RBAC middleware over existing `protectedProcedure`/`headProcedure`, BullMQ queues we already operate, Playwright projects we already run, Tailwind utilities we already use. **Net: 4 npm packages, zero stack pivots.**

The dominant risk surface is the **auth transition itself**: removing `AUTH_DEV_MODE` while keeping the 21-spec integration suite green requires staging (a narrower `AUTH_DEV_MODE_ALLOW_TEST` switch + mock IdP) rather than a single flag flip, and the same plan that flips real Keycloak SAML on must close the cookie-injection seam in the BullMQ PDF worker — otherwise PDF jobs silently 401 and retry forever. Three other P0s round out the heat map: Anthropic-cost runaway (charge per-content-change, not per-render), AI hallucinated counts (pre-compute numbers in the prompt, never let the LLM invent statistics), and timezone drift in trend aggregation (server-formatted ISO date strings, never `new Date()` on the client). The build order — **B + A1 (parallel) → A2/A4/E1/G (parallel) → A3/A5/A6/E2/F/D (parallel) → C (gated by AI-SPEC.md)** — is the same in all four research files; we adopt it as the roadmap baseline.

---

## Key Findings

### Recommended Stack — Additions Only

Existing stack carries forward unchanged. v6.0 adds four packages:

**Core additions:**

- **`@anthropic-ai/sdk` ^0.90.0** (apps/api) — direct Claude access; ships `betaZodTool` so Zod schemas in `packages/shared` are the single source of truth for tool input. Models: **Haiku 4.5** for sentiment classification + summarisation; **Sonnet 4.6** for multi-signal "on-track" judgement. Opus 4.7 explicitly NOT used (5× cost, marginal lift on these tasks).
- **`recharts` ^3.3.0 + shadcn-ui Chart wrappers** (apps/web) — composable React + SVG, native Tailwind v4 CSS-variable theming (matches Starbucks cream/teal/gold palette automatically). Wrappers installed via `pnpm dlx shadcn@latest add chart`. All chart components live in `apps/web/src/components/charts/` as `'use client'` boundaries; pages stay RSC.
- **`react-email` ^3 + `@react-email/components`** (apps/api) — `.tsx` email templates with the `<Tailwind>` wrapper (utility classes compile to inline styles at render time). Existing nodemailer + BullMQ pipeline carries delivery; templates live in `apps/api/src/modules/email/templates/`.

**Explicitly rejected (do NOT add):** LangChain.js, Vercel AI SDK, separate Python AI service, Tremor, Plotly/D3, raw Tailwind SVG charts, `trpc-shield`, Storybook, MJML, `cron`/`node-cron`, `zod-to-json-schema`. Reasons documented in STACK.md "What NOT to Add".

**No-package features:**

- A (RBAC): custom `requireRole(['head'])` tRPC middleware factory in `packages/shared/src/trpc/`, ~30 LOC, replaces the inline `isHead` check at `trpc.middleware.ts:71-81`.
- B (quality): config/cleanup only.
- F (mobile): new Playwright projects (`mobile-ios`/`mobile-android`) using existing `@playwright/test` `devices` exports.
- G (checklist): Markdown convention.

**Cost-tracking requirement:** new `AiInsight` Prisma model is mandatory — without it `message.usage.{input,output,cache_creation,cache_read}_tokens` are lost. Architecture proposes `ReportSummary` with `contentHash` cache key — these reconcile cleanly: `ReportSummary` is the read-through cache (one row per report content version), `AiInsight` is the per-call audit log. Keep both.

### Expected Features (per theme)

**A — Auth & roles (foundational for C/E):**

- AUTH-01..03: real Keycloak SAML, four-role JWT (`lead`/`head`/`admin`/`viewer`), role assertion on every tRPC procedure (default-deny).
- AUTH-04: role-aware UI hiding (cosmetic only).
- AUTH-05: cookie injection in BullMQ pdf-export — same plan as `AUTH_DEV_MODE` removal (CC-1 hinge).
- AUTH-06..08: 401/403 routing, silent JWT refresh, audit log of role-effecting events.
- Anti: self-service role request, custom user CRUD beyond samlId-cache, MFA in our app, password reset (delegated to Keycloak).

**B — Quality polish:**

- QA-01: single root cause behind 5 integration-suite Playwright timeouts (likely autosave debounce racing).
- QA-02: `prisma generate` postinstall (NOT root — see B-2 pitfall).
- QA-03: delete `apps/web/src/proxy.ts` (dead duplicate; live = `apps/web/proxy.ts`).
- QA-04: rename `_userId` in `period.contract.test.ts:65`; flip Phase 22 VERIFICATION.md status.

**C — AI features (gated by AI-SPEC.md):**

- AI-01: 2-3 sentence executive summary card on assembled report (dismissible, never auto-fills narrative).
- AI-02: sentiment badge per Risk row.
- AI-03: smart "on-track" advisory icon overlay (lead's colour stays authoritative).
- Differentiators: AI-04 period-over-period diff narrative, AI-05 risk theme clustering, AI-06 head's narrative auto-draft.
- Anti: AI replaces narrative; auto-fills lead's textarea; changes traffic-light; sentiment auto-escalates.

**D — Trend analytics:**

- ANAL-01..04: per-project sparkline of last N periods, stacked bar of green/yellow/red counts, period-over-period delta table, carry-over rate per lead.
- Operates on immutable published data; viewer access acceptable.
- Anti: real-time dashboards, item-level drilldown, cross-departmental comparison.

**E — Email reminders (extend, don't duplicate):**

- NOTIF-01..06: T-24h pre-deadline reminder, T+2h escalation digest to head, plaintext+HTML parity, per-user opt-out (head escalation NOT opt-outable), idempotent jobIds, DLQ.
- Most infra exists from v1.0–v2.0.
- Anti: nag mode, head deadline reminders, director escalation, Telegram/Slack.

**F — Mobile polish:**

- MOB-01..07: no horizontal scroll at 375px; ≥44px tap targets; `head/dashboard` portfolio grid → card list; admin tabs → select; PDF embed → "Open PDF" button on mobile; top shell → hamburger.
- Anti: native iOS/Android, mobile-first redesign, offline mode.

**G — Release checklist:**

- REL-01..05: `CHECKLIST.md` template + per-release fills under `.planning/milestones/v{N}-CHECKLIST.md`; each item maps 1:1 to `REGRESSION-TEST-SCENARIOS.md` IDs; signoff line.

### Architecture Approach

**Integration-by-extension.** Every v6.0 surface lands inside an existing seam:

1. **tRPC middleware factory** (`packages/shared/src/trpc/middleware/role.ts`) — `requireRole(['head'])` pattern. Generates `leadProcedure`/`headProcedure`/`adminProcedure`/`viewerProcedure`. Default-deny: any procedure without role declaration returns FORBIDDEN.
2. **Per-query role filtering at service layer** — `archive.list`/`archive.detail`/`weeklyReport.get` viewer-scoped; `review.dashboard` becomes `headProcedure`.
3. **PDF cookie injection** — `pdf-export.service.ts:46` accepts 5-min scoped JWT; processor at `pdf-export.processor.ts:69-72` calls `page.context().addCookies(...)`. Cookie domain from `PDF_BASE_URL`.
4. **AI module** (`apps/api/src/modules/ai/`) — `ai.service.ts`, `ai.router.ts`, `prompts/*.md` (rubric content as imported strings so prompt diffs show in git), `processors/ai-summary.processor.ts` (BullMQ queue, raw `Worker` pattern per `@nestjs/bullmq 11` DI bug).
5. **Analytics module** (`apps/api/src/modules/analytics/`) — three procedures aggregate via server-side `GROUP BY`. NO new model; add composite indexes on `(reportId, projectId)` and `(periodStart)`. Redis cache 1h TTL invalidated on `period.publish`/`period.reopen`.
6. **Email scheduler** — extend `reminders.service.ts` with `kind='escalation'` + three react-email templates. Render to both HTML + plaintext.
7. **Frontend chart layer** (`apps/web/src/components/charts/`) — three components wrap shadcn-ui Chart over recharts; pages stay RSC and lazy-import.
8. **Mobile coverage** — single new Playwright config with `mobile-ios` + `mobile-android` projects.

**Data-flow critical path:** Login (Keycloak SAML) → JWT with `role` claim → tRPC context populates `ctx.user` → `requireRole()` middleware enforces → service layer filters → Prisma → Zod-typed response → tRPC client → `useSession()` hides/shows UI. **Every link is touched by Theme A.**

### Critical Pitfalls (top P0s)

1. **CC-1** — Phase 24 cookie-injection seam is the hinge for A, C, E. Same plan that removes `AUTH_DEV_MODE` MUST close the seam.
2. **CC-2** — DEV_SESSION fallback removal must be staged (introduce `AUTH_DEV_MODE_ALLOW_TEST` + mock IdP container, then delete).
3. **CC-6** — Two `proxy.ts` files; deleting wrong one kills auth. Plan B explicit path + comment "do NOT add a copy under src/".
4. **A-1** — Role check missing because middleware "already filtered". Cron, BullMQ, tests bypass HTTP. Fix: `roleProcedure(...allowed)` factory enforces at every procedure; coverage test fails CI if role not declared.
5. **C-1** — Anthropic API per-render = $50–100/team/month. Read-through cache keyed on `contentHash = sha256(JSON.stringify(reportContent))`; only `ai.summarize.mutate` (head-only, BullMQ-queued) recomputes.
6. **C-2** — LLM hallucinates counts. Pre-compute counts in system prompt with "DO NOT change these numbers"; structured tool output for sentiment/judgement.
7. **C-3** — PII in prompts. `redactForLogs()`, `loggingMiddleware({ exclude: ['ai.*'] })`, Anthropic data-retention setting OFF, lint rule bans `logger.*` of `prompt`/`messages`/`response.content` in `apps/api/src/modules/ai/`.
8. **D-1** — Aggregation hits full join client-side. Server `GROUP BY` + indexes; Redis cache; NO materialised view in MVP.
9. **D-2** — UTC vs local timezone drift → off-by-one weeks + hydration mismatch. ISO `YYYY-MM-DD` strings only; server pre-formats labels; snapshot test under `TZ=Europe/Moscow` matches `TZ=UTC`.
10. **E-1** — Idempotency key collision after retry → duplicate emails. Read existing `dedupeKey` shape FIRST; extend; integration test simulates SMTP transient → exactly 1 email.

**CC-3 (P1)** — Type-divergence trap re-opens with C/D. ESLint `no-restricted-imports` blocks raw Prisma in `apps/web/src/lib/analytics/**` and `apps/api/src/modules/ai/**`; plans extend `packages/shared/src/mappers/` FIRST.

---

## Implications for Roadmap

All four research files independently converged on the same build order. Adopt it.

### Wave 1 — Foundations (parallelizable)

**Phase 27 — B + A1**

- Rationale: B unblocks integration suite as CI gate; A1 self-contained refactor.
- Delivers: integration suite green ≥3 runs; postinstall hook; dead `proxy.ts` deleted; `_userId` rename; Phase 22 VERIFICATION re-status; `roleProcedure` factory.
- Avoids: CC-6, B-2, B-3, A-1.
- Research flag: skip (standard patterns).

### Wave 2 — Auth depth + adjacent infra (parallel after Wave 1)

**Phase 28 — A2 + A4 + E1+E3 + G**

- Rationale: A2 consumes A1; A4 closes Phase 24 seam (CC-1); E1+E3 reads existing reminder code first (E-1 mitigation); G anytime-clean.
- Delivers: archive/weeklyReport viewer-scoped; PDF worker auth-cookie; 3 email templates; CHECKLIST.md.
- Avoids: A-3, CC-4, CC-3, E-1.
- Research flag: 5-min `jwt.sign expiresIn` check.

### Wave 3 — Auth tail + product surfaces (parallel after Wave 2)

**Phase 29 — A3 + A5 + A6 + E2 + F + D**

- Rationale: A3+A5+A6 close auth loop (A6 LAST); E2 layers escalation; F independent; D operates on immutable published data.
- Delivers: layout-level role gates (recommended); navigation hiding; real Keycloak SAML; staged DEV_SESSION removal via `AUTH_DEV_MODE_ALLOW_TEST`; T+2h escalation; 7 pages mobile-clean at 375px; analytics module + 3 chart components on `/reports/trends`.
- Avoids: CC-2, A-2, D-1, D-2, D-3, D-4, F-1, F-2, E-2, E-3.
- Research flag: shadcn-Chart smoke task (CC-5) in Wave 2; otherwise standard.

### Wave 4 — AI (gated by AI-SPEC.md)

**Phase 30+ — C, preceded by `/gsd-ai-integration-phase`**

- Rationale: depends on Wave 3 finalised role scoping AND AI-SPEC.md (model selection, prompt design, cost/latency, PII boundary, golden-set rubric, on-prem-vs-hosted).
- Delivers: `ai-summary` queue; `AiInsight` audit + `ReportSummary` cache tables; `ai.summary.get`/`ai.sentiment.list`/`ai.judgement.get`; summary card; risk badges; smart on-track advisory; cost-tracking; prompt-caching with ≥1024-token rubric.
- Avoids: C-1..C-6.
- Research flag: AI-SPEC required before phase planning.

### Phase Ordering Rationale

- **Dependency:** A1 (procedures) → A2 (consumers); A4 hinged with `AUTH_DEV_MODE` removal in A6; B precedes A4 (test suite green); A6 last in Wave 3; C gated by AI-SPEC.
- **Grouping by architecture seam:** Wave 2 — API service + BullMQ + email queue. Wave 3 — frontend + analytics + auth tail.
- **Pitfall avoidance:** CC-1/CC-2/CC-6 force B + A1 first. C-1/C-2 force AI cache + golden-set before user-facing surface.

### Research Flags

**Phases needing deeper research during planning:**

- **Phase 30+ (C):** AI-SPEC.md required. Decisions: cost-vs-confidentiality, model assignment, prompt rubric ≥1024 tokens, golden-set fixtures (8–12 reports), eval-step CI threshold.

**Standard patterns (skip phase research):** Phase 27 (B + A1), Phase 28 (A2 + A4 + E1+E3 + G), Phase 29 (A3 + A5 + A6 + E2 + F + D).

---

## Confidence Assessment

| Area         | Confidence                                                | Notes                                                                                                               |
| ------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Stack        | **HIGH**                                                  | Context7-verified; existing untouched. MEDIUM: Sonnet 4.6 sufficiency for on-track judgement (golden-set required). |
| Features     | **HIGH** A/B/E/F/G; **MEDIUM** C/D                        | A/B/E/F/G well-known patterns with exact pointers. C depends on AI-SPEC. D sparkline-vs-bar density a UX call.      |
| Architecture | **HIGH**                                                  | Verified at exact line numbers. Raw-`Worker` requirement grep-confirmed.                                            |
| Pitfalls     | **HIGH** CC-1/CC-2/CC-6/A-1..4/B-1..4; **MEDIUM** C/D/E/F | Cross-cutting + A/B from audit + grep. C/D/E/F best-practice.                                                       |

**Overall confidence:** **HIGH.** Strict additive scope. Two MEDIUM areas deferred to plan-time validation, not roadmap-blocking.

### Gaps to Address

- **AI-SPEC.md outstanding (Theme C blocker).** Cannot enter planning without it. Owner: `/gsd-ai-integration-phase`.
- **Existing reminder code unread (E-1 plan-time gap).** Read `apps/api/src/modules/reminder/*` FIRST in E1+E3 plan.
- **Golden-set rubric needs domain expert sign-off (C-5).** Head/Belyaev review before lock-in.
- **Mobile audit baseline screenshots need real-device pass (F-1, MOB-06).** Real iOS Safari PDF embed.
- **AUTH_DEV_MODE removal sequencing.** A6 commit not before Phase 26 specs run green against mock IdP.

---

## Sources

### Primary (HIGH confidence)

- `.planning/research/STACK.md` (Context7-verified)
- `.planning/research/FEATURES.md`
- `.planning/research/ARCHITECTURE.md` (verified at exact line numbers)
- `.planning/research/PITFALLS.md` (direct quotes from `v5.0-MILESTONE-AUDIT.md`, grep-confirmed)
- `.planning/PROJECT.md`

### Secondary

- Anthropic release notes (Haiku 4.5 / Sonnet 4.6 / Opus 4.7) + prompt-caching docs
- shadcn-ui charts page
- BullMQ + nodemailer best-practice docs

### Tertiary (plan-time validation needed)

- AI quality on real lead data (Sonnet 4.6 sufficiency)
- iOS Safari PDF embed
- Existing reminder dedupe key shape

---

_Research synthesized: 2026-04-28_
_Ready for roadmap: yes_
_Build order locked: B + A1 → A2 + A4 + E1+E3 + G → A3 + A5 + A6 + E2 + F + D → C (gated by AI-SPEC.md)_
