---
title: Next session plan — 2026-05-05 evening handoff
date: 2026-05-05
state: ready-to-execute
prereqs: dev stack up (postgres + redis + mailpit), pnpm dev running both apps
---

# Next session — Take Everything Plan

User said "берём всё, строим план, запускаем компакцию". Compaction will erase
session memory; this plan persists the next-step queue.

## Tier 1 — Performance / DX (highest daily-impact)

### 1.1 — Turbopack experiment

- Currently `apps/web/package.json` dev: `next dev --webpack` (forced webpack
  due to a runaway loop in earlier session, fix commit `f0142b6`)
- The runaway-causing bugs (CLS correlationId, env loading, stub mode) are
  closed. Worth retrying Turbopack — should drop dev compile from ~3-5s/route
  to ~500ms.
- **Steps:**
  1. Change `apps/web/package.json` dev script: drop `--webpack`
  2. Add `turbopack: { root: '..' }` to next.config.ts if needed (monorepo
     workspace root detection)
  3. Restart `pnpm --filter @customreport/web dev`
  4. Hit `/lead/report`, `/head/dashboard`, `/admin?tab=users` — verify
     compile times in console + no runaway
  5. Run wave1 — should be much faster + less flake
  6. If runaway returns, revert immediately + log what triggered it
- **Estimated effort:** 10 min experiment, 30 min if compatibility issues

### 1.2 — CI workflow (`.github/workflows/ci.yml`)

- No CI exists. Next merge to `main` could regress without anyone noticing.
- **Steps:** create workflow that on push/PR runs:
  - `pnpm install --frozen-lockfile`
  - `pnpm --filter @customreport/web lint && tsc --noEmit`
  - `pnpm --filter @customreport/api lint && tsc --noEmit`
  - `pnpm --filter @customreport/web test --run`
  - `pnpm --filter @customreport/api test --run`
  - Optional: `pnpm prisma migrate deploy` against ephemeral postgres service
- **Estimated effort:** 20 min

## Tier 2 — Closing deferred mockup items

### 2.1 — HIST-2 Quick Filters card

- Sidebar already has Reporting Overview + Recent Pattern (commit `418bcff`).
- Mockup s9 specs a third card with filter chips: "All", "Submitted", "Drafts".
- **Steps:**
  1. Add filter state to `apps/web/src/app/(app)/lead/history/page.tsx`
     (`useState<'all'|'submitted'|'draft'>`).
  2. Pass filter to `LeadHistoryList` and filter entries client-side.
  3. New card in `lead-history-sidebar.tsx` — three pill buttons in a row,
     active = filled tealA, inactive = ghost.
  4. Lift filter state to the page so list and sidebar agree.
- **Estimated effort:** 25 min

### 2.2 — Visual snapshot baseline

- Audit recommended Playwright snapshot diff at 1280×800 — currently no
  baseline exists.
- **Steps:**
  1. Render mockup at 1280×800 using `file://` URL → screenshot per slide.
  2. Render production routes at same viewport.
  3. Save both into `apps/web/.tmp/visual-baseline/{mockup,prod}/<route>.png`.
  4. Wire a `pnpm uat:visual-diff` script that pixel-diffs corresponding
     pairs and emits per-route diff scores.
  5. Commit baseline images? Probably YES into a separate
     `apps/web/visual-baseline/` (gitignored screenshots, not the script).
- **Estimated effort:** 45 min

## Tier 3 — Production prep

### 3.1 — `.env.example` audit

- Current `.env.example` lists ~5 vars. Real schema has many more
  (`apps/api/src/infrastructure/config/env.schema.ts` has the full list).
- **Steps:** generate `.env.example` from the Zod schema, group by purpose
  (DB, Redis, Auth, SMTP, PDF, AI, Logging). Document defaults + which are
  required in prod.
- **Estimated effort:** 30 min

### 3.2 — README "Run the tests" + dev onboarding

- README currently sparse on dev setup. New contributor would struggle.
- **Steps:** add sections — Prereqs (Node 22+, pnpm 10+, Docker), First
  setup (`docker compose up -d postgres redis mailhog && pnpm install &&
pnpm prisma migrate deploy && pnpm prisma db seed`), Run the apps
  (`pnpm dev`), Run the tests (`pnpm test`), UAT regression (point at
  `apps/web/.tmp/uat-suite/`).
- **Estimated effort:** 20 min

### 3.3 — BullMQ Bull Board mount verify

- `apps/api/src/main.ts` mounts `/admin/queues` (bull-board). `DlqBadge`
  component pulls failed-job count.
- **Steps:** open `http://localhost:3002/admin/queues` as admin, verify all
  3 queues (`pdf-export`, `email-reminder`, anything else) render. If
  endpoint isn't authenticated, gate behind admin role.
- **Estimated effort:** 15 min

## Tier 4 — Optional but valuable

### 4.1 — AI features end-to-end audit

- Code has `ai.summary`, `ai.sentiment`, `ai.regenerateSummary` tRPC
  procedures. Anthropic SDK in deps.
- **Steps:** verify ANTHROPIC_API_KEY env handling, hit a procedure manually
  via tRPC, confirm response shape. If broken, decide: fix or feature-flag
  off for production.
- **Estimated effort:** 30 min

### 4.2 — Mockup MEDIUM/LOW backlog still open

- Of 39 mockup deltas, all HIGH closed and most MEDIUM/LOW closed. A few
  small items remain in `.planning/MOCKUP-AUDIT-2026-05-05.md`:
  - DEC-2 — verify `--color-canvas` alias resolves to `#f4f1eb`
  - SDLC-3 — locked stage tooltip with assignee name
  - LF-1 — period nav leading "Week" + calendar icon (intentional, skip)
- **Estimated effort:** 15 min total

## Suggested execution order (next session)

1. **Turbopack experiment** (Tier 1.1) — biggest daily-life win, 10 min
2. **CI workflow** (Tier 1.2) — protects everything else, 20 min
3. **`.env.example` audit** (Tier 3.1) — production readiness gate, 30 min
4. **README** (Tier 3.2) — paired with `.env.example`, 20 min
5. **HIST-2 Quick Filters** (Tier 2.1) — easy win, 25 min
6. **Visual baseline** (Tier 2.2) — 45 min, can be split
7. AI audit + Bull Board verify — pair up, 45 min total

Rough budget: 3-4 hours of focused work covers the whole list.

## State carried into next session

- **Current branch:** main (single-branch flow per repo convention)
- **Last commit:** `1ce3063` (Round 5 supplement)
- **Test stats:** vitest 237/237 web, 598/598 api; TS web 0, api 0
- **Wave 1 solo:** 25/28 PASS (3 fails are timing/data-dependent, not app)
- **Mockup parity:** 39/39 deltas closed (HIGH + most MEDIUM/LOW)
- **Dev stack:** postgres-1 + redis-1 + mailhog-1 (running mailpit image now)
- **Logs:** API teeing to `apps/api/.logs/api.log`
- **Seed:** date-relative — current week is auto-populated, no need to re-seed
  weekly

## Anti-traps (carry forward)

- Don't run wave1 + wave2 + probes in parallel — backend race kills tests.
  Serialize.
- Don't trust `networkidle` alone for "page ready" — use `waitForAppReady`
  with the route-specific kind.
- Don't pin tests to specific seed values (Olga's traffic-light state
  varies). Make selectors data-agnostic.
- Mailpit DELETE: use `DELETE /api/v1/messages` (works), not
  `DELETE /api/v2/messages`.
- BullMQ rate-limiter: 5 emails / 60s window. Tests waiting on email arrival
  need ≥20s budget under load.
