# Phase 30: Mobile Polish & Trend Analytics - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning
**Mode:** Auto-generated (workflow.skip_discuss=true) — using ROADMAP phase goal as spec

<domain>
## Phase Boundary

Wave 4 of v6.0: all 7 product pages usable on 375px viewport; head + viewers see how traffic lights, velocity, risk delta moved across last 12 periods.

**In scope (11 REQ-IDs):**

- MOB-01..07: mobile polish — Playwright mobile-ios/mobile-android projects, 375px no-horizontal-scroll assertions, touch targets ≥44px, head dashboard table → card list at md-, admin tabs → native select on narrow, lead risk editor full-screen Dialog on mobile, PDF preview → "Open PDF" button on mobile, hamburger menu in app-shell
- ANAL-01: `analytics.trafficLightHistory` tRPC procedure with Redis cache + invalidation hooks on period.publish/period.reopen
- ANAL-02: `analytics.leadVelocity` Prisma GROUP BY, TZ-stable
- ANAL-03: `analytics.periodComparison` delta table
- ANAL-04: `/reports/trends` RSC page with shadcn-ui Chart + recharts (sparkline, stacked bar, delta table); null vs zero visually distinct

**Out of scope:**

- AI features (Phase 31)
- Email reminder UX (Phase 29 closed it)

**UI hint:** YES — Phase 30 has UI work; if `workflow.ui_phase=true`, a UI-SPEC.md should be drafted before plan-phase. We will skip the UI-SPEC ceremony in autonomous mode and produce plans directly.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices at Claude's discretion — discuss skipped per workflow.skip_discuss=true. Use ROADMAP phase description, success criteria, ARCHITECTURE.md, Phase 27/28/29 PHASE artifacts.

### Locked Decisions from Research

- `recharts` + shadcn-ui Chart (Tailwind v4 CSS-variable theming; Tremor/Plotly/D3 rejected per StackResearch)
- TZ-stable: server pre-formats ISO 'YYYY-MM-DD' labels — no client-side `new Date()` (per D-2 pitfall)
- Redis cache TTL 1h, key `analytics:traffic-light:${query-hash}`; invalidate on `period.publish` + `period.reopen` (already-existing publish/reopen flows in `apps/api/src/modules/period/`)
- iOS HIG tap target ≥44px → `h-11 min-w-11`
- shadcn-ui Chart on top of recharts: lazy-import client boundaries, RSC page wrapper

### Phase Sequencing (suggested)

- Plan 30-01 — ANAL-01 trafficLightHistory tRPC + Redis cache + invalidation hooks (foundation; depends on Phase 28 role middleware)
- Plan 30-02 — ANAL-02/03 leadVelocity + periodComparison tRPC + integration tests under TZ=Moscow/UTC
- Plan 30-03 — ANAL-04 `/reports/trends` RSC page + 3 chart client-boundary components
- Plan 30-04 — MOB-01 Playwright mobile-ios/mobile-android projects + 7 pages no-horizontal-scroll assertion (test infra ground truth)
- Plan 30-05 — MOB-02..07 mobile polish (button touch variant, head dashboard card list, admin select, lead risk Dialog, PDF mobile button, app-shell hamburger)

</decisions>

<code_context>

## Existing Code Insights

### Reusable Assets

- `apps/web/playwright.config.ts` (mock E2E) and `apps/web/playwright.integration.config.ts` — base for adding mobile-ios/mobile-android projects
- `packages/ui/src/components/ui/button.tsx` — shadcn-ui Button (extend with size='touch')
- `apps/web/src/components/navigation/app-shell.tsx` — current nav (Phase 29 added role hides; extend with mobile hamburger)
- `apps/api/src/modules/period/period.service.ts` — publish/reopen flows for cache invalidation
- `apps/web/src/lib/trpc.ts` — TRPCProvider with httpBatchLink (analytics queries piggyback)

### Established Patterns

- Prisma GROUP BY queries: see Phase 28 `archive.service.ts` for shape
- Redis caching: ioredis already in stack; key `${prefix}:${query-hash}` pattern from Phase 28 PDF cookie work
- shadcn-ui Chart: install via `pnpm dlx shadcn@latest add chart` if not already present; uses CSS variables from Tailwind v4 @theme
- RSC + lazy client boundary: `'use client'` directive on chart components only, RSC page imports them via dynamic import

### Integration Points

- Phase 28 role filters: `analytics.*` procedures must use `headProcedure` or `viewerProcedure` per role
- Phase 31 (AI) consumes `analytics.*` data for AI summaries
- Mobile tests require Playwright Chromium installed (already done from Phase 27)

</code_context>

<specifics>
## Specific Ideas

- **30-01 cache invalidation:** subscribe via NestJS event emitter or directly call `redis.del(prefix:*)` in period.service publish/reopen handlers. Keep it simple — full prefix invalidation, not per-query targeted.
- **30-02 TZ stability:** integration test runs vitest with `process.env.TZ='Europe/Moscow'` and `process.env.TZ='UTC'`; both must produce identical labels.
- **30-03 chart components:** one file each, max 100 LOC, props-driven. Sparkline uses `<Line>` with `connectNulls={false}` so gaps render visibly.
- **30-04 mobile project config:** Playwright `devices['iPhone 14']` + `devices['Pixel 7']` give 390x844 / 412x915. Assert `await expect(page.locator('html')).toHaveCSS('overflow-x', /(hidden|clip|visible)/)` AND `await expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)`.
- **30-05 hamburger:** Sheet from shadcn-ui (mobile-friendly drawer) — install if not already.

</specifics>

<deferred>
## Deferred Ideas

- iOS Safari real-device PDF embed test (MOB-06 verification gate per STATE.md blocker — needs human-on-device)
- A11y audit of charts (color-blind-safe palettes) — Phase 31+ if requested
- Server-side rendering of charts to SVG for crawlers — out of scope

</deferred>
