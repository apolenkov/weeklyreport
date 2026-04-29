# CustomReport — Session Handoff

**Last session:** 2026-04-26
**State:** v5.0 Production Integration shipped (tech_debt — runtime verification deferred)
**Branch:** main
**Last commit:** see `git log -1`

## Quick Start on New Machine

```bash
# 1. Clone + install
git clone <repo-url> customreport
cd customreport
pnpm install

# 2. Start infra
docker compose up -d postgres redis

# 3. Apply migrations + seed
pnpm exec prisma migrate deploy
apps/api/node_modules/.bin/tsx prisma/seed.ts

# 4. Run dev servers
NEXT_PUBLIC_AUTH_STUB=true pnpm dev
# API: http://localhost:3002
# Web: http://localhost:3005
```

## Pending Tag Push

```bash
git push origin main
git push origin v5.0   # local annotated tag, not yet pushed
```

## v5.0 Tech Debt (deferred runtime verification)

Code-complete but not runtime-verified end-to-end. Address in v6.0 or before tagging final release:

### 1. Phase 26 integration suite — first-run completed   [FIRST-RUN-DONE 2026-04-26 — 8/21 pass, 5 fail (assertion-level timeouts on tRPC POST), 8 skip; 5 failures opened as v6.0 backlog. See .planning/quick/260426-vxp-v5-0-tech-debt-integration-suite-first-r/260426-vxp-SUMMARY.md; commit cc1a0ec includes 5 infra-fixes (proxy.ts matcher, global-setup.ts Prisma 7 reset, playwright config /health/live, .env created, chromium installed)]

```bash
createdb customreport_e2e
cp .env.test.example .env.test
# Edit .env.test: set E2E_DATABASE_URL=postgresql://customreport@localhost:5432/customreport_e2e
pnpm --filter @customreport/web test:e2e:integration
```

Expected: 21 tests across 7 spec files (lead-journey, head-journey, cross-role-lifecycle, admin-crud, status-risk-sync, pdf-export, auth-guards).

### 2. Phase 22 human-verify items (4 items)

Manual smoke test through UI at http://localhost:3005:

- **SYNC-01:** Click stage chip → set to At Risk → empty risk row appears with required field highlight
- **SYNC-03:** Fill risk severity field → confirmation toast offers stage update → confirm → stage updates
- **INT-01:** Submit section → form locks, "Submitted" badge appears
- **INT-04/06:** Edit field → wait 3s → "Saved at HH:MM" indicator appears (autosave)

### 3. Phase 23 PDF E2E smoke

Manual: head/dashboard → publish report → click Export PDF → verify download triggers, file opens correctly.

### 4. weekly-report-page.test.tsx (5 failing tests)   [CLOSED 2026-04-26 — see .planning/quick/260426-vxp-v5-0-tech-debt-integration-suite-first-r/260426-vxp-SUMMARY.md; commit d394832]

Pre-existing failures (incomplete tRPC mock for `pdfExport.request.mutationOptions`). Fix mock to match actual API surface from Phase 23.

### 5. TODO(Phase 24) cookie injection in pdf-export.processor.ts

Inert under `AUTH_DEV_MODE=true`. Real injection needed when SAML SSO is enabled (v6.0+).

## Project Structure

```
apps/
├── api/           NestJS 11 + tRPC + Prisma 7 (port 3002)
└── web/           Next.js 16 + React 19 (port 3005)

packages/
├── shared/        Zod schemas (canonical types)
├── ui/            shadcn/ui + design tokens (Starbucks theme)
└── config/        ESLint/TS/Prettier shared configs

prisma/
├── schema.prisma  19 models
├── seed.ts        Idempotent (12 products, 6 leads, 7 stages, 2 periods)
└── seed-constants.ts  Canonical UUIDs (must match DEV_SESSION)

.planning/
├── PROJECT.md             Project context
├── MILESTONES.md          Shipped milestone summary
├── milestones/            Per-milestone archives (v1-v5)
├── phases/                Phase artifacts (CONTEXT, PLAN, SUMMARY, VERIFICATION)
├── research/              v5.0 research (STACK, FEATURES, ARCHITECTURE, PITFALLS)
└── v5.0-MILESTONE-AUDIT.md
```

## Key Architectural Decisions (v5.0)

- **@trpc/tanstack-react-query** (NOT @trpc/react-query) — React Compiler requires queryOptions pattern
- **useState QueryClient** — never module-level (SSR cross-request leak)
- **Mapper layer** — Zod/Prisma → presentation types (computed states `pending`/`planned`)
- **DEV_SESSION UUIDs** — `prisma/seed-constants.ts` must match `apps/api/src/infrastructure/trpc/trpc.context.ts`
- **SyncSource ref pattern** — prevents Status↔Risk infinite loops (`'user' | 'auto-sync'`)
- **Custom logger enhanced** (NOT replaced with pino) — nestjs-cls correlation IDs + async file rotation
- **Dual Playwright configs** — `playwright.config.ts` (mock UI) + `playwright.integration.config.ts` (real API)

## Environment Variables

`.env` (root):
```
DATABASE_URL=postgresql://customreport:localdev@localhost:5432/customreport
REDIS_URL=redis://localhost:6379
AUTH_DEV_MODE=true              # API: enables /auth/dev-login + DEV_SESSION fallback
NEXT_PUBLIC_AUTH_STUB=true      # Web: skips proxy.ts auth guard, login page direct nav
PDF_OUTPUT_DIR=apps/api/storage/pdf
```

`.env.test` (for integration tests, NOT in git — copy from .env.test.example):
```
E2E_DATABASE_URL=postgresql://customreport@localhost:5432/customreport_e2e
```

## Useful Commands

```bash
# Quality gates
pnpm --filter @customreport/web typecheck
pnpm --filter @customreport/api typecheck
pnpm --filter @customreport/web test           # vitest (web)
pnpm --filter @customreport/api test           # vitest (api)
pnpm --filter @customreport/web test:e2e       # 339 mock E2E tests
pnpm --filter @customreport/web test:e2e:integration  # 21 real-API tests (needs E2E_DATABASE_URL)
pnpm --filter @customreport/web build          # Next.js production build

# Database
pnpm exec prisma migrate dev      # create new migration
pnpm exec prisma migrate deploy   # apply migrations (no shadow db)
apps/api/node_modules/.bin/tsx prisma/seed.ts  # seed (idempotent)
docker compose exec postgres psql -U customreport -d customreport  # SQL shell

# GSD planning
/gsd:progress        # current state
/gsd:new-milestone   # start v6.0 cycle
/gsd:audit-uat       # find pending human verification items
```

## Next Milestone (v6.0) Candidates

- **Role separation** — restrict UI/API by role (lead/head/viewer) — currently admin-only mode
- **Real Keycloak SSO** — replace AUTH_STUB with full SAML flow + JWT refresh tokens
- **Trend analytics** — historical traffic light tracking, velocity metrics
- **Email reminders** — BullMQ job for weekly deadline reminders
- **Mobile-responsive polish** — verify all 7 pages work on mobile

Run `/gsd:new-milestone` to start scoping.

## Contact / Issue Tracking

- See `.planning/v5.0-MILESTONE-AUDIT.md` for detailed milestone audit
- See `.planning/milestones/v5.0-ROADMAP.md` for full v5.0 phase details
- See `.planning/milestones/v5.0-REQUIREMENTS.md` for requirement traceability

<!-- handoff-sync:start -->
## Pending Manual Smoke

Auto-generated by `pnpm gsd:checklist:sync` from `/CHECKLIST.md`. Edit the checklist, not this section.

### Manual (14)
- [ ] **FUNC-LEAD-001** — Lead can save a draft section
- [ ] **FUNC-LEAD-002** — Lead can submit a section after autosave settles
- [ ] **FUNC-HEAD-001** — Head sees the assembled report and publishes it
- [ ] **AUTH-LOGIN-001** — Login as lead via Keycloak (Phase 29 active gate)
- [ ] **AUTH-LOGIN-002** — Login as head; head-only routes accessible
- [ ] **AUTH-VIEWER-001** — Viewer cannot access /admin or /head/* (proxy.ts + SSR layout)
- [ ] **PDF-EXPORT-001** — Head exports a published report; PDF downloads non-empty
- [ ] **PDF-CONTENT-001** — Generated PDF contains the report period text and lead names
- [ ] **EMAIL-DEADLINE-001** — T-24h deadline reminder lands in test inbox; HTML and plaintext both present
- [ ] **EMAIL-DELIVERY-001** — Corporate SMTP accepts and delivers (no spam-folder routing)
- [ ] **MOB-VIEWPORT-001** — All 7 pages have no horizontal scroll at 375px (Phase 30)
- [ ] **MOB-TAP-001** — Tap targets >=44px on iOS (Phase 30)
- [ ] **AI-COST-001** — Anthropic dashboard daily spend <= budget cap (Phase 31)
- [ ] **ANAL-CHARTS-001** — /reports/trends renders without console errors (Phase 30)

### CI-gated (6)
- [ ] **FUNC-INTG-001** — Integration suite green: `pnpm test:e2e:integration`
- [ ] **AUTH-FILTERS-001** — Service-layer role filter unit tests: `pnpm --filter @customreport/api test apps/api/src/modules/archive apps/api/src/modules/weekly-report`
- [ ] **PDF-COOKIE-001** — PDF cookie seam test: `pnpm --filter @customreport/api test apps/api/src/modules/pdf-export/pdf-export.service.test.ts`
- [ ] **EMAIL-IDEMPOTENT-001** — Reminder idempotency test: `pnpm --filter @customreport/api test apps/api/src/modules/reminders/reminders.scheduler.test.ts`
- [ ] **AI-EVAL-001** — AI eval suite green: `pnpm test:ai-eval` (Phase 31)
- [ ] **ANAL-PERF-001** — Analytics query p95 <200ms (Phase 30)
<!-- handoff-sync:end -->
