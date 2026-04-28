# Architecture Research — v6.0

**Mode:** Architecture (subsequent milestone — integration points for features A–G)
**Confidence:** HIGH (verified against actual file contents at exact line numbers)

> **Note:** Persisted by orchestrator from architecture-researcher inline findings (researcher was blocked from writing by an operator note in its prompt). Existing `ARCHITECTURE.md` is v5.0 historical research — kept untouched.

---

## Baseline (already exists, do NOT rebuild)

| Concern | Location | Shape |
|---|---|---|
| tRPC procedure helpers | `apps/api/src/infrastructure/trpc/trpc.middleware.ts:59,69,83` | `publicProcedure`, `protectedProcedure`, `headProcedure` (chained on `loggingMiddleware`) |
| Session shape | `packages/shared/src/schemas/auth.ts:5-12` | `userSessionSchema` with `role: 'lead'\|'head'\|'viewer'` |
| tRPC context | `apps/api/src/infrastructure/trpc/trpc.context.ts:18-21` | `{ session: UserSession \| null, logger }` — role propagation works today |
| Dev-bypass session | `trpc.context.ts:9-16` | `DEV_SESSION` (head) when `AUTH_DEV_MODE=true` |
| Active proxy.ts | `apps/web/proxy.ts` | Allowlist matcher + cookie-presence check; **role-naive** |
| Dead proxy.ts | `apps/web/src/proxy.ts` | Confirmed unused — `grep -rn "from.*src/proxy" apps/web` empty |
| BullMQ queues | `apps/api/src/infrastructure/bullmq/bullmq.module.ts:21-22` | `pdf-export`, `email-reminder` |
| Worker pattern | `pdf-export.processor.ts:28-40`, `email-reminder.processor.ts:28-40` | **Raw `Worker` (not `@Processor`)** — DI bug in `@nestjs/bullmq 11`. New queues MUST follow this. |
| Cookie-injection seam | `pdf-export.processor.ts:69-73` | `TODO(Phase 24)` block; `PdfExportService.buildAuthCookies()` already at `pdf-export.service.ts:121-145` |
| Reminder idempotency | `reminders.service.ts:55` | `dedupeKey = ${rule.id}:${rule.fireAt.toISOString()}:${recipientEmail}` — extend, don't reinvent |

---

## Feature A — Auth & Roles

### A1. Role-aware tRPC middleware
- **Modify** `trpc.middleware.ts`: refactor inline `isHead` (lines 71-81) into `requireRole(allowed: Role[])` factory.
- **Add** `leadProcedure`, `viewerProcedure`, `adminProcedure` (admin === head for v6.0).
- `headProcedure` becomes `requireRole(['head'])`; `leadProcedure` is `requireRole(['lead','head'])`.

### A2. Per-query role filtering
- **Modify** `trpc.router.ts`:
  - `archive.list`/`archive.detail`: `where: { status: 'published' }` for viewers.
  - `weeklyReport.get`: viewers see only published.
  - `review.dashboard` (line 123): `protectedProcedure` → `headProcedure`.
- Push role checks into services for testability.

### A3. proxy.ts role-aware variant
- **Modify** `apps/web/proxy.ts`: per-prefix role table — `/admin → head`, `/head → head`, `/lead → lead|head`, `/reports → any auth`.
- **Recommendation:** keep proxy.ts minimal (cookie presence) and push fine-grained role to SSR layout (`apps/web/src/app/(app)/admin/layout.tsx`) reading session via `cookies()` + tRPC `auth.me`. Avoids JWT verification in Edge runtime.

### A4. PDF cookie injection (independent)
- `pdf-export.service.ts:46`: `requestPdfExport(reportId, requestedBy?, authToken)`.
- Job data shape (currently `{reportId, jobId}`) gains `authToken: string`.
- `pdf-export.processor.ts:67`: `page.context().addCookies(...)` before `page.goto`.
- Token: short-lived (5-min) JWT signed at `requestPdfExport` call-site in `trpc.router.ts:170`.

### A5. Frontend role-aware navigation
- `apps/web/src/components/navigation/app-shell.tsx` — hide `/admin`, `/head/*` for non-head; `/lead/*` for viewers.
- Use existing `useSession()` at `apps/web/src/lib/use-session.ts`.

### A6. Real Keycloak SAML
- `apps/api/src/modules/auth/saml.strategy.ts` exists; environment switch from `AUTH_DEV_MODE=true` to real Keycloak metadata is config.
- Verify Keycloak attribute-mapper sends `role` SAML claim.

---

## Feature B — Quality Polish

### B1. `prisma generate` postinstall
- **Location:** root `/package.json`. Schema is at `/prisma/schema.prisma`; `@prisma/client` and `prisma` are root deps.
- Add `"postinstall": "prisma generate"` to root scripts.
- Add `prisma generate` as `build` predecessor in `turbo.json` for CI builds skipping postinstall.

### B2. Delete `apps/web/src/proxy.ts`
- Verified safe: grep returns empty. Active proxy is `apps/web/proxy.ts`.

### B3. 5 integration test failures (single root cause likely)
- Symptom: `TimeoutError: page.waitForResponse Timeout 15000ms` on tRPC POST in 5 specs.
- **Hypothesis:** autosave race or wrong URL pattern in `r.url().includes('/trpc/')`.
- **Investigation:** run ONE failing test in headed mode (`playwright test status-risk-sync --headed --workers 1`), watch trace.

### B4. Tech-debt items
- `apps/api/src/modules/period/period.contract.test.ts:65`: rename `userId` → `_userId`.
- Phase 22 VERIFICATION.md: flip `status: gaps_found` → `status: passed`.

---

## Feature C — AI Features (NEW MODULE)

### C1. Module location
**NEW:** `apps/api/src/modules/ai/`
- `ai.service.ts`, `ai.router.ts`, `ai.module.ts`, `ai.prisma-repository.ts`.
- Co-located in `apps/api` (not separate package) — AI calls latency-bound, not CPU-bound.

### C2. Sync vs async (HYBRID)
- **Sync tRPC** for short calls (<3s with caching): `ai.judgeOnTrack` per section.
- **NEW BullMQ queue `ai-summarize`** for full-report (5–15s).
- Worker: `apps/api/src/infrastructure/bullmq/ai-summarize.processor.ts` — raw `Worker` pattern.
- Trigger: `period.publish` → enqueue `ai-summarize` job.

### C3. NEW Prisma model `ReportSummary`
```prisma
model ReportSummary {
  id          String   @id @default(uuid())
  reportId    String   @unique
  contentHash String                       // sha256 — cache key
  summary     String   @db.Text
  sentiment   Json
  onTrackJudgement Json
  modelVersion String
  promptTokens Int
  completionTokens Int
  costUsdCents Int
  generatedAt DateTime @default(now())
  report      Report   @relation(fields: [reportId], references: [id], onDelete: Cascade)
  @@index([contentHash])
}
```

### C4. Cost tracking
- Reuse `AppLoggerImpl` — emit `{phase, model, promptTokens, completionTokens, costUsdCents, reportId}`.
- Optional Prometheus counter `ai_tokens_total{model,kind}`.
- Daily budget cap via `AI_DAILY_BUDGET_USD_CENTS` + Redis INCRBY.

### C5. tRPC endpoints (under `ai.*`)
- `ai.getSummary` (`protectedProcedure`) — read-through cache.
- `ai.regenerate` (`headProcedure`) — bust cache, enqueue.
- `ai.judgeOnTrack` (`headProcedure`) — sync.

### C6. Requires AI-SPEC.md per project rules.

---

## Feature D — Trend Analytics

### D1. Module
**NEW:** `apps/api/src/modules/analytics/` — service + router + repo.

### D2. tRPC procedures
- `analytics.trafficLightHistory` — `[{periodStart, status, projectId}]`.
- `analytics.velocity` — `[{periodStart, completedItems, plannedItems, completionRate}]`.
- `analytics.periodOverPeriod` — diff between two reports.

### D3. NO new Prisma model
- Derived from `Report`/`ReportSection`/`ProjectStatus`/`Item`/`Risk`.
- Add indexes: `@@index([reportId, projectId])` on `ProjectStatus`, `@@index([periodStart])` on `Report`.
- Cache aggregations in Redis (TTL 1h), invalidate on `period.publish`/`period.reopen`.

### D4. Frontend
- **NEW** `apps/web/src/app/(app)/reports/trends/page.tsx` (RSC) + client `<Chart>` components.
- **Library:** `recharts` (verified Tailwind v4 + React 19 + Next 16 RSC compatible via `'use client'` boundary).
- Page is RSC, calls tRPC server-side via `createCallerFactory`, passes data into `'use client'` chart.

---

## Feature E — Email Reminders (EXTEND)

### E1. Scheduling
- **NEW** `apps/api/src/modules/reminders/reminders.scheduler.ts` — NestJS `@Cron` (`@nestjs/schedule`) hourly, reads `WHERE status='active' AND fireAt <= now()`, calls existing `requestReminderExecution`. Reuses `dedupeKey`.

### E2. Escalation
- Add `escalation` to `ReminderRule.kind` enum (`schema.prisma:218`).
- Logic: deadline reminder + `ReportSection.status='draft'` 24h after `fireAt` → enqueue `kind='escalation'` to head's email.

### E3. Templates
- **NEW** `apps/api/src/modules/reminders/templates/`: `deadline.template.ts`, `follow-up.template.ts`, `escalation.template.ts`.
- Replace inline template at `email-reminder.processor.ts:65-74` with switch on `job.data.kind`.

### E4. Idempotency
- Existing: `${rule.id}:${rule.fireAt.toISOString()}:${recipientEmail}`.
- Escalation: `${rule.id}:escalation:${cycleDate}:${recipientEmail}`.

---

## Feature F — Mobile Polish

### F1. Pure CSS/Tailwind
- 7 pages: `/lead/{report,history}`, `/head/{dashboard,report}`, `/reports/{history,[reportId]}`, `/admin/*`.
- Tailwind v4 breakpoints `sm:`, `md:`, `lg:` — mobile-first.

### F2. Optional new component
- `packages/ui/src/components/page-container.tsx` — `<main className="px-4 sm:px-6 lg:px-10">`.
- **No Storybook** — adds 200+ MB. Use Playwright + viewport variants.

### F3. Touch targets
- Button default `h-9` (36px) → add custom `size='touch'` → `h-11 min-w-11` (44px iOS).

---

## Feature G — Release Checklist

### G1. Location
**Recommend root `/CHECKLIST.md`** (mirrors `HANDOFF.md`/`README.md`).

---

## Build Order

```
Sprint 1 (parallelizable):
  ├── B1 (postinstall prisma generate)
  ├── B2 (delete apps/web/src/proxy.ts)
  ├── B3 (fix 5 integration test failures — root cause first)
  ├── B4 (TS6133 + VERIFICATION.md status)
  └── A1 (leadProcedure/viewerProcedure)

Sprint 2:
  ├── A2 (Prisma role filters)               — depends on A1
  ├── A4 (PDF cookie injection)              — depends on B (green tests)
  ├── E1+E3 (scheduler + templates)          — independent
  └── G  (CHECKLIST.md)                      — anytime

Sprint 3:
  ├── A3 (proxy.ts allowlist OR layout-level checks)
  ├── A5 (frontend nav role hiding)
  ├── A6 (real Keycloak SAML)                 — last in Sprint 3
  ├── E2 (escalation)
  ├── F  (mobile polish)
  └── D  (analytics module + endpoints + UI)

Sprint 4 (gated by AI-SPEC.md):
  └── C  (ai module, queue, summary model)
```

**Critical path:**
- A1 must precede A2/A3/A5 (consume new procedures).
- B precedes A4 (test suite green before modifying pdf-export.processor).
- A6 last in Sprint 3 (real SAML after every guard surface tested).
- C gated by AI-SPEC.

---

## Open Questions for Roadmapper

1. **A3:** verify JWT in `proxy.ts` (Edge, requires `jose`) vs SSR-layout-level role gates. Recommend layout-level.
2. **C:** requires `/gsd-ai-integration-phase` per project rules.
3. **D:** confirm `recharts` works with React 19 + Next 16 RSC. Fallback: `visx` or client-only render.
4. **A4:** 5-minute scoped JWT — verify `jwt.sign` `expiresIn` overload exists.

---

## Files Inspected

**API:** `trpc/{trpc.context,trpc.middleware,trpc.router}.ts`, `auth/{auth.controller,auth.routes,jwt.strategy,roles.guard}.ts`, `bullmq/{bullmq.module,pdf-export.processor,email-reminder.processor}.ts`, `pdf-export/pdf-export.service.ts`, `reminders/reminders.service.ts`, `apps/api/package.json`.

**Web:** `apps/web/proxy.ts`, `apps/web/src/proxy.ts`, `components/navigation/app-shell.tsx`, `components/weekly-report/weekly-report-page.test.tsx`, `e2e/integration/admin-crud.integration.spec.ts`.

**Shared:** `packages/shared/src/schemas/auth.ts`, `prisma/schema.prisma`, root `package.json`, `.planning/PROJECT.md`, `CLAUDE.md`, `graphify-out/GRAPH_REPORT.md`.
