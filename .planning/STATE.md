---
gsd_state_version: 1.0
milestone: v8.1
milestone_name: Visual Identity & AI Maturity
status: in_progress
shipped_tag: v8.0.0
shipped_at: "2026-05-06"
last_updated: "2026-05-07T12:00:00.000Z"
last_activity: 2026-05-07 -- v8.1 promoted from backlog and started (phases 40-42)
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 12
  completed_plans: 0
  percent: 0
backlog:
  - none
---

# Project State: CustomReport

**Project:** Team Status Reporting Web App
**Status:** v8.1 IN PROGRESS (v8.0 shipped)
**Last Updated:** 2026-05-07

---

## Project Reference

See: .planning/PROJECT.md

**Core Value:** Leads fill their sections independently via structured forms; system auto-assembles a unified report -- no editing conflicts, with history and analytics.

**Current Focus:** v8.1 polish, role regression hardening, and UI polish

**Resume context:** Per-project Claude memory at `.planning/memory/`. v8.1 promote flow: `git mv .planning/backlog/v8.1-*.md .planning/milestones/` then `/gsd-new-milestone v8.1` and plan the first promoted v8.1 phase.

---

## Current Position

Milestone: v8.1 (IN PROGRESS, tag parent v8.0.0)
Phases: 0/3 complete (40..42)
Plans: 0/12 complete
Status: active polish wave started, v8.0 is production baseline.
Last activity: 2026-05-07 -- promote v8.1 roadmap/requirements and open polish planning.

### v8.0 phase progress

- Phase 34 ✓ Quality Foundation (7 plans) — husky + lint-staged, vitest coverage, DOM-walker CI, prisma reset gate, TS rollup, ESLint sweep 272→0, push-guard
- Phase 35 ✓ UX Polish (8 plans) — 0/7 stages fix, /reports tabs merge, stage ownership e2e, Risk/Item/Decision/Priority stageName, 44px CSS token, DLQ admin tab, addressable URLs, RU seed + role-default redirect
- Phase 36 ✓ Security & Audit (4 plans) — rate-limit, audit-trail middleware, secrets fail-fast, CORS prod whitelist + helmet
- Phase 37 ✓ Observability (4 plans) — OTel HTTP + Prisma, DLQ alert counter, Prometheus + Grafana, log-sink docs
- Phase 38 ✓ Infra & Deploy (4 plans) — prod migrate init, Caddy auto-TLS, SAML mock IdP, RUNBOOK + INCIDENT-PLAYBOOK
- Phase 39 ✓ Performance (5 plans) — PgBouncer prod, Turbopack, pg_stat_statements + index audit, k6 baseline, FTS поиск (бонус)
- Visual baseline (post-tag patch) — Playwright toHaveScreenshot 5 routes + CI gate

### v6.0 phase progress

- Phase 27 ✓ (5/5) — pushed (Quality Stabilisation & Role Middleware Factory)
- Phase 28 ✓ (4/4) — pushed (Role Filters, PDF Cookie Seam, Reminders, Release Checklist)
- Phase 29 ✓ (6/6) — local 7 commits (Real Keycloak SAML, Role-Aware UI, Escalation)
- Phase 30 ✓ (5/5) — local 12 commits (Mobile Polish & Trend Analytics)
- Phase 31 ✓ (3/3 + AI-SPEC) — local 8 commits (AI Insights — Haiku-only per user pick)

## Quick Tasks Completed

| #          | Description                                                                                                                                                                              | Date       | Commit           | Directory                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| 260426-vxp | v5.0 tech debt: integration suite first-run + weekly-report mock fix (MAJOR-PROGRESS — HANDOFF #4 CLOSED, #1 first-run completed 8/21 pass + 5 fail to v6.0, Phase 24 matcher gap fixed) | 2026-04-26 | d394832, cc1a0ec | [260426-vxp-v5-0-tech-debt-integration-suite-first-r](./quick/260426-vxp-v5-0-tech-debt-integration-suite-first-r/) |

---

## Performance Metrics

**Velocity:**

- Total plans completed: 54 (v1.0: 12, v2.0: 15, v3.0: 6, v4.0: 21)
- Average duration: ~10 min
- Total execution time: ~15 hours

**By Milestone:**

| Milestone | Phases | Plans | Status   |
| --------- | ------ | ----- | -------- |
| v1.0      | 4      | 12    | Shipped  |
| v2.0      | 3      | 15    | Shipped  |
| v3.0      | 3      | 6     | Shipped  |
| v4.0      | 4      | 21    | Shipped  |
| v5.0      | 7      | 15    | Shipped  |
| v6.0      | 5      | TBD   | Planning |

**Plan Executions (v5.0):**

| Plan                                           | Duration | Tasks   | Files    |
| ---------------------------------------------- | -------- | ------- | -------- |
| Phase 20-seed-type-foundation P02              | 2min     | 2 tasks | 7 files  |
| Phase 21 P04                                   | 50m      | 3 tasks | 11 files |
| Phase 22 P03                                   | 24min    | 3 tasks | 8 files  |
| Phase 22-interactivity-status-risk-sync P22-01 | 75min    | 3 tasks | 12 files |
| Phase 23 P01                                   | 25min    | 3 tasks | 10 files |
| Phase 25 P01                                   | 50min    | 3 tasks | 9 files  |
| Phase 24 P01                                   | 10m      | 4 tasks | 12 files |
| Phase 26 P01                                   | 6m 35s   | 3 tasks | 15 files |

---

## Accumulated Context

### Key Decisions

| Decision                                                     | Rationale                                                                                                                                           | Status                        |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Admin-only mode for v5.0                                     | Full access for regression testing; role separation in v6.0                                                                                         | Closing in v6.0 (Phase 28-29) |
| @trpc/tanstack-react-query (not classic)                     | React Compiler is enabled; classic proxy hooks break                                                                                                | Active                        |
| Enhance custom logger, not replace with pino                 | Existing AppLoggerImpl already handles JSON/rotation; add nestjs-cls                                                                                | Active                        |
| Mapper layer for type translation                            | Mock types diverge semantically from Zod/Prisma types -- not find-and-replace                                                                       | Active                        |
| Self-contained mapper modules                                | Type aliases declared inline in mapper files                                                                                                        | Active                        |
| Asymmetric mapper signatures (Exclude<ItemStatus,'planned'>) | Computed presentation states become compile-time errors                                                                                             | Active                        |
| AUTH-01 split across Phase 28 + Phase 29                     | PDF cookie path requires `AUTH_DEV_MODE_ALLOW_TEST` staging (Phase 28); full Keycloak SAML flip lands in Phase 29 to avoid silent 401 storms (CC-1) | Active                        |
| `requireRole` factory over `trpc-shield`                     | ~30 LOC custom middleware; default-deny coverage test gates CI                                                                                      | Active (Phase 27)             |
| `recharts` + shadcn-ui Chart for v6.0 analytics              | Native Tailwind v4 CSS-variable theming; Tremor / Plotly / D3 rejected                                                                              | Active (Phase 30)             |
| `react-email` for email templates                            | `<Tailwind>` wrapper compiles utilities to inline styles; MJML rejected                                                                             | Active (Phase 28)             |
| Anthropic SDK direct (no LangChain / Vercel AI SDK)          | Haiku 4.5 + Sonnet 4.6; Opus 4.7 explicitly NOT used (5× cost, marginal lift)                                                                       | Active (Phase 31)             |

### Critical Pitfalls

1. **DEV_SESSION UUID mismatch** -- seed must create users/reports with exact hardcoded UUIDs or queries return empty
2. **React Compiler breaks @trpc/react-query** -- must use @trpc/tanstack-react-query with queryOptions pattern
3. **Status-Risk sync infinite loops** -- SyncSource ref flag ('user' | 'auto-sync') prevents cascading
4. **Type divergence is semantic** -- on-track vs green, computed states (pending/planned) need mapper logic
5. **CC-1 (v6.0)** — PDF cookie injection MUST land same plan as `AUTH_DEV_MODE_ALLOW_TEST` staging (Phase 28)
6. **CC-6 (v6.0)** — Two `proxy.ts` files; deleting wrong one kills auth (Phase 27 plan must be explicit)
7. **A-1 (v6.0)** — Default-deny coverage test required; cron / BullMQ / tests bypass HTTP middleware
8. **C-1 (v6.0)** — Anthropic per-render cost runaway; read-through cache on `contentHash` mandatory
9. **C-2 (v6.0)** — LLM hallucinated counts; pre-compute numbers in prompt with "DO NOT change these numbers"
10. **D-2 (v6.0)** — Timezone drift in trend aggregation; server-formatted ISO strings only

### Active Blockers

- **Push pending** — 55+ commits ahead of origin/main. VPN/DNS unstable; `forge.example.org` resolves intermittently. User to verify VPN + run `https_proxy="" command git push origin main` when network is back.

### v6.1 Backlog (deferred, NOT blocking v6.0 deploy)

- **AI features feature-flagged off until ANTHROPIC_API_KEY provisioned** — Phase 31 ships AI summary card, sentiment badges, on-track icons. All 3 features gracefully degrade ("AI unavailable") when key missing. Decision: ship code, defer activation until ops + head approve API key + cost. Confirmed in live-test 2026-04-30.
- **Mock IdP container REMOVED from local plan** — Decision 2026-04-30: `/auth/dev-login?role=X` already fully imitates SAML callback (issues identical JWT cookie + session). Mock Keycloak container would only cover SAML XML parsing which is `@node-saml/passport-saml` library code, not ours. Local + integration tests use AUTH_DEV_MODE_ALLOW_TEST. Production uses real corp Keycloak. No middle layer needed.
- **OnTrackIcon UI mount on traffic-light cells** — pre-v8 mockup parity work shipped the mount via `weekly-report.ts` mapper UUID threading; activates when `ANTHROPIC_API_KEY` is set.
- **Real-device iOS Safari PDF embed (MOB-06)** — Playwright virtual `devices['iPhone 14']` covers; human-on-device confirmation outstanding.
- **Golden-set rubric head sign-off (C-5)** — AI-SPEC ships with draft fixtures; CI threshold loose until head/Barkhanov approves. `pnpm test:ai-eval` runs on-demand.
- **Pre-existing test lint warnings** — non-null assertions in test files (api ~185 warnings, web ~87) — not v6.0 work; cleanup later.

### Phase 27/28/29/30 closing notes (cumulative)

- **QA-03 invariant inverted (27-05b)** — proxy.ts MUST live at `apps/web/src/proxy.ts` (Next 16 src-layout, empirically proven via curl test).
- **Prisma 7 + prisma.config.ts does NOT auto-seed after `migrate reset`** — e2e global-setup chains explicit `prisma db seed` (27-05a).
- **CC-1 enforced (28-02)** — AUTH-05 PDF cookie + AUTH-01 staging in ONE commit; splitting causes 401 retry storms.
- **CC-1 ordering enforced (29-06)** — AUTH-06 nav hides committed LAST after AUTH-07 layout gate + AUTH-01 SAML cut-over.
- **shadcn Chart hand-rolled (30-03)** — 34-LOC wrapper around recharts (CLI install skipped per watchdog budget).
- **MOB-05/06 simplified (30-05)** — risk editor stays inline (already 375px-clean); ExportPdfButton already opens via window.open (no iframe).

---

## Session Continuity

Last session: 2026-04-28T17:00:00.000Z
Stopped at: v6.0 roadmap drafted (Phases 27-31)
Resume file: None

---

_State initialized: 2026-04-06_
_v1.0 shipped: 2026-04-10_
_v2.0 shipped: 2026-04-11_
_v3.0 shipped: 2026-04-21_
_v4.0 shipped: 2026-04-25_
_v5.0 shipped: 2026-04-25_
_v6.0 planning started: 2026-04-28_
