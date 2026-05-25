# CustomReport — Codebase Mental Map (2026-05-25)

> Generated via `/claude-mem:learn-codebase` + `/superpowers:subagent-driven-development`. 13 parallel subagent reads → main-orchestrator synthesis. Source partition summaries: `/tmp/customreport-learn-{A,B,C,D,E,F,G,H,I-comp,I-lib,J,K,L}.md`. Plan: `docs/superpowers/plans/2026-05-25-customreport-codebase-learning.md`.

## §0 — One-paragraph orientation

CustomReport is a pnpm/Turborepo monorepo that automates weekly status reports for a software department. Six leads fill structured sections (project traffic lights, current/next-week items, risks, decisions, priority ranks) per period; one head reviews, publishes, exports a unified PDF. Branch `fix/PRJ-2/shiny-eagle` is ~70+ commits ahead of `main`, milestone **v8.4 "Versioning UX"** is **in review** as PR #7 (autosave→snapshot wire, ★ Pin button, Save Now, FillFrom empty-state, time-based retention). Tests are green: 559/559 web, 926/926 API; 4 pre-existing E2E seed failures are tracked, not regressions. The next gate is human PR approve → `git tag v8.4.2` → Jira PRJ-2 transition.

## §1 — Monorepo layout

```
customreport/
├── apps/
│   ├── web/                Next.js 16 + React 19 + Tailwind v4 + shadcn (App Router)
│   │   ├── src/app/        28 routes across (app)/{admin,head,lead,reports} + auth + print + api
│   │   ├── src/components/ 152 React files in 16 subdirs (lead, dashboard, slides, admin…)
│   │   ├── src/{hooks,lib,server,styles,test}/ 58 non-component files
│   │   ├── src/proxy.ts    auth-guard middleware (NOT in middleware.ts; tested via proxy.test.ts)
│   │   ├── instrumentation.ts + sentry.{server,client,edge}.config.ts
│   │   ├── playwright.{config,integration.config,regression.config}.ts + vitest.{config,setup}.ts
│   │   └── uat-suite/      mutation-audit.mjs, inventory.mjs, helpers.mjs, allowlist.json
│   └── api/                NestJS 11 + tRPC 11 + Prisma 7
│       ├── src/main.ts     26-step bootstrap (Sentry → OTel → env → Nest → middleware chain)
│       ├── src/app.module.ts  imports 23 feature/infra modules
│       └── src/{modules,infrastructure,lib,test-utils}/  ~250 TS files
├── packages/
│   ├── shared/             Zod schemas (~24 src files), tRPC shared-router stub, role middleware
│   └── ui/                 shadcn-new-york v4 design system: 22 primitives + 5 composites + tokens
├── prisma/
│   ├── schema.prisma       28 models + 18 enums
│   ├── migrations/         38 migrations (2026-04-10 → 2026-05-21)
│   ├── seed.ts / seed-simple.ts / wipe-manual-uat.ts / reset-hard.ts / backfill-policy-rules.ts
│   └── _destructive-guard.ts  refuses destructive ops without `_uat`/`_dev`/`_test` suffix
├── tests/e2e/             10 auto-generated Playwright specs (from UAT-SCENARIO/)
├── tests/load/k6-baseline.js  50 VUs, p95 read <300ms / write <800ms
├── tools/uat-extractor/   parse-dom → matrix.json → generate-playwright → coverage gate
├── tools/handoff-sync.ts  injects pending smoke into HANDOFF.md
├── scripts/               docker-local-verify.sh, doctor.sh, push-guard.sh, flaky-rate.mjs
├── deploy/                Caddyfile, Grafana dashboards (3), Prometheus + alert-rules + log-sink
├── docker-compose{,.dev,.prod,.observability,.errors}.yml  layered compose stack
├── docs/                  10 docs incl. API-REFERENCE, DEPLOYMENT, OBSERVABILITY-ONBOARDING, ROLES
└── .planning/             GSD state — 751 files (audits/, milestones/, phases/, plans/, retros/, todos/, regression/)
```

## §2 — Domain model (Prisma)

**28 models / 18 enums.** All IDs are UUID v4. No soft-delete via deletedAt — uses `isActive`/`archived` booleans.

```
auth/users
   User ─┬─ reportingGroupId? → ReportingGroup (SET NULL since 20260521)
         ├─ samlId UNIQUE, email UNIQUE, isActive bool (since 20260512)
         └─ notificationOptOut bool
   ReportingGroup ─ headUserId? → User (SET NULL); archived bool; app-level invariant role ∈ {head,admin}
   ViewerGroupAccess  M:M (viewerUserId × groupId)  unique pair  CASCADE both sides
   UserActionLog  no FK to User (survives deletion); indexed by [userId,createdAt DESC], [procedure,createdAt DESC], [correlationId]

reports / sections / items
   Report ─┬─ periodStart/End/deadline + DUAL STATE MACHINE:
           │   periodState: scheduled|open|published|archived  (new)
           │   periodStatus: open|published|reopened           (legacy)
           │   + tuple (status: draft|published, archived bool)
           ├─ publishedSnapshot Json?  (Phase 65 — immutable read model)
           ├─ autoPublished, autoArchived bool
           └─ PARTIAL UNIQUE INDEX Report_one_open_per_boundary (periodStart,periodEnd) WHERE periodState='open'
              ─ raw-SQL migration only (Prisma DSL cannot express WHERE clause)
   ReportSection  unique [reportId, authorId]; revokedAt/By; late bool stamped on submit-after-deadline
   ProjectStatus  unique [reportSectionId, projectId]; status NULLABLE since 20260502
   StageStatus    unique [reportSectionId, projectId, stageId]
   Item ─┬─ type (current|next), tag, stageName (comma-joined string of stage names, NOT UUIDs)
         ├─ priorityRank Int?  (since 20260520 — replaces dropped `Priority` table)
         ├─ partial idx [reportSectionId, priorityRank] WHERE priorityRank IS NOT NULL
         └─ searchTsv tsvector GENERATED ALWAYS AS STORED USING russian regconfig + GIN
   Risk ─ severity TEXT DEFAULT 'at-risk' CHECK IN ('at-risk','blocked')  (since 20260515)
   Decision ─ productId → Project (NOT NULL, CASCADE since R4-C 20260512)
   VersionSnapshot  data Json; unique [reportSectionId, version]
   ReopenRequest

products / stages
   Project ("Product" in app) ─ leadId; archived; searchTsv + GIN
   GroupProduct  M:M bridge; unique([productId]) (B1 20260513 — one group per product after 3 churn iterations)
   Stage  7 canonical SDLC values (Planning→Support); name UNIQUE
   StageAssignment  unique [stageId, projectId] (since 20260508)

reminders / policies
   ReminderPolicy ─ kind/offsetMinutes/timezone/audience/validFrom/Until; active bool; indexes [kind,active],[validFrom,validUntil]
   ReminderRule  ─ reportId?, policyId? (SET NULL); fireAt; version Int (optimistic); unique [reportId, policyId]
   ReminderExecution  dedupeKey UNIQUE (atomic idempotency)

carry-over / export
   CarryOverExecution  dedupeKey UNIQUE; source/target RESTRICT
   CarryOverRecord  lineage source→target item/decision id
   PdfExportJob  status (queued|processing|completed|failed); requestedBy plain string

ai / integrations (mostly stubs)
   AiInsight  unique [kind, contentHash]; token tracking; result Json
   AiIngestionJob  status TEXT (not enum — extensibility); no unique on reportSectionId
   TelegramBinding  userId UNIQUE, chatId UNIQUE

singletons
   Organization  id default 'singleton'; shortName ≤16, fullName ≤200
   AppSettings   id default 'singleton'; 18 org-wide knobs (period timing, deadlines, late window, working days, reopen window…)
```

**Enums (18):** Role (lead|head|admin|viewer; director added 20260511 then removed 20260514), ReportStatus, ReportSectionStatus, TrafficLightStatus, ItemType, ItemWorkflowStatus, PdfExportStatus, ReminderExecutionStatus, ReminderRuleKind, ReminderRuleStatus, ReminderAudience (SCREAMING_SNAKE on DB; wire is kebab-case), CarryOverStatus, PeriodStatus, PeriodState, ReopenRequestStatus, WorkingDays, AiInsightKind, UserActionStatus.

**Migration history highlights:** 44 migration dirs; biggest hits — 20260424 v4_period_lifecycle (versioning + stages + AppSettings), 20260506 fts_search_indexes (generated tsvector + GIN), 20260508 reporting_groups (groups + backfill), 20260510 reminder_policies (template→rule split), 20260511 51c_period_state (dual state machine), 20260514 phase65_published_snapshot (immutable JSONB), 20260520 drop_priority_add_item_rank (Priority table dropped). Three churn-heavy areas: GroupProduct unique constraint (3 iterations), Director role (added + removed within same week — required full enum recreation), `User.reportingGroupId` (NOT NULL → nullable → SET NULL FK).

## §3 — Roles + authz

```
                          ┌─ NestJS tRPC procedure builders ─┐
                          │                                  │
                          │  publicProcedure   anyone        │
                          │  protectedProcedure  authed      │
                          │  leadProcedure     lead only     │
                          │  headProcedure     head + admin  │
                          │  adminProcedure    admin only    │  ← UFB-038 split from head
                          │  viewerProcedure   viewer only   │
                          │  anyRoleProcedure  all 4         │
                          │  leadershipProcedure  head+admin+viewer (lead excluded)
                          └──────────────────────────────────┘

Role-coverage gate (apps/api/src/infrastructure/trpc/__tests__/role-coverage.test.ts):
  walks appRouter._def.procedures, compares each leaf's _def.middlewares prefix
  against the 7 canonical chains by REFERENCE IDENTITY. A bare `t.procedure`
  or look-alike chain fails CI with the offending path name. Two mutation tests
  prove the gate fires for both cases. Default-deny is structural, not stylistic.

Auth flow:
  prod:  Keycloak SAML → samlify → SamlProfileSchema.strict() → JWT (HS256, 1h)
         cookie: customreport_session (httpOnly, secure in prod, sameSite=lax, maxAge=3600)
  dev:   /auth/dev-login?role=&email= → buildUserSession() → same JWT
         GATED by env.AUTH_DEV_MODE && NODE_ENV!='production'
         Defense-in-depth: assertNoDevAuthInProduction() runs before NestJS init AND superRefine in env.schema.ts.

UserSession JWT payload (packages/shared/src/schemas/auth.ts):
  userId, email, name, role, activeReportId, activeReportSectionId,
  reportingGroupId?, reportingGroupName?, viewerGroupAccess?[],
  organization? (hydrated per-request, NOT signed into JWT)

Per-request hydration (trpc.context.ts createContextFactory):
  1. Read customreport_session cookie
  2. Verify as session JWT → revocation check (Redis fast-path + Prisma isActive)
  3. Fallback: verify as PDF-export JWT → synthetic viewer session bound to reportId
  4. Dev fallback if AUTH_DEV_MODE — hardcoded DEV_SESSION head user
  5. Hydrate viewerGroupAccess, reportingGroupName, organization (5s module-level TTL)
  6. Resolve activeReportSectionId if missing (lead path)

Frontend gate hierarchy (defense-in-depth, 4 layers):
  L1 src/proxy.ts (matcher: /lead, /head, /reports, /admin)
     — heuristic on cookie shape/length; 307 to /?next=<encoded> if missing
  L2 (app)/<role>/layout.tsx — async server component → getServerSession() →
     <ForbiddenPage requiredRoles={...}> in-place (NO redirect)
  L3 client component visibility checks (auth.me query)
  L4 NestJS tRPC procedure middleware — AUTHORITATIVE security boundary

Capability table:
  /admin/*        admin only                   (admin ≠ head — UFB-038)
  /head/*         head + admin                 (admin can impersonate head)
  /head/report/*  nested second gate (head + admin)
  /lead/*         lead + head + admin          (head/admin can impersonate lead)
  /reports/*      any authenticated role       (row-level filtering at API)

Session revocation:
  Redis SET customreport:revoked SADD/SISMEMBER fast-path
  DB User.isActive=false is authoritative fallback
  Fail-OPEN on Redis error — defense relies on isActive check
```

## §4 — API surface (tRPC)

```
appRouter
├── auth         publicProcedure              me → session|null
├── org          publicProcedure              getPublic → {shortName, fullName}
├── dev          public/protected             listUsers, wipeAndReseed (AUTH_DEV_MODE gated)
├── reports      protectedProcedure           getActive, myHistory, compiledHistory(anyRole), saveDraft, submit
├── leadForm     protectedProcedure           byPeriod, versions, getVersion, restoreVersion, fillFrom,
│                                             revokeSubmission(head), revokeAllSubmitted(head),
│                                             requestReopen, createSnapshot, getCrossAuthors, getCrossAuthorSections
├── review       headProcedure                dashboard, assembledReport, publish
├── period       headProcedure                publish, reopen
├── publication  internal                     publishAuto (called by AutoPublisher)
├── pdfExport    headProcedure                request, status
├── admin.*      adminProcedure               snapshot, user/group/project/period/policy CRUD,
│                                             dlqCount, actionLog.list, jobs.*, activate/deactivateUser
├── archive      anyRoleProcedure/headProcedure  list, detail, archiveReport, unarchiveReport
├── reminders    headProcedure                execute, listExecutions, dispatchPending
├── carryOver    headProcedure                execute
├── weeklyReport anyRoleProcedure             get (returns {status:'active',report} | {status:'no-period',report:null})
├── analytics    leadershipProcedure          trafficLightHistory, leadVelocity, periodComparison (cached 3600s)
├── ai           various                      summary, sentiment, onTrack, periodSummary (mock); excluded from audit
├── search       anyRoleProcedure             query (Postgres FTS via tsvector; lead+scope='all' → FORBIDDEN)
├── activity     headProcedure                live (polled 15s)
└── telemetry    leadershipProcedure          summary (KPI bundle for head/admin/viewer)

Middleware stack per procedure (in order):
  metricsMiddleware → loggingMiddleware → auth/role → pdfExportGuard → mutationAuditMiddleware

Error mapping (trpc.error-mapper.ts):
  ReportSectionDomainError, ReminderDomainError, CarryOverDomainError, AdminPeriodOverlapError → BAD_REQUEST
  ReviewAccessError, AdminAccessError, ReportSection/LeadForm AccessError → FORBIDDEN
  PublicationAccessError → CONFLICT
  Pdf/Archive/WeeklyReport/LeadForm DomainError, AdminPeriodNotFoundError → NOT_FOUND
  else → INTERNAL_SERVER_ERROR (cause preserved for logger)

Mutation-audit CI gate (apps/web/uat-suite/mutation-audit.mjs):
  Parses trpc.router.ts → for each mutation checks same-namespace queries + web refs via rg
  VERIFIED / PARTIAL / BLACK HOLE classification. CI exits 1 on unallowlisted BLACK HOLE.
  Current: 26 mutations / 25 queries; 21 verified / 4 partial / 1 allowlisted (carryOver.execute = cron-only).
  Prevents the "reopen-request" pattern — mutation fires, toast appears, row never surfaces in UI.

Role-claim contract test asserts SAML profile → JWT → session.role round-trips cleanly for
all 4 roles + case normalization (HEAD → head) + missing-role rejection.
```

## §5 — Frontend routing + role flow

```
/                          page.tsx — landing/role picker (RSC + LoginPageClient)
/auth/error                page.tsx — SAML failure messages
/print/[reportId]          page.tsx — A4 PDF render target; tRPC fetch with PDF-JWT cookie
/api/client-logs           route.ts — POST proxy to API_URL/api/client-logs
/api/revalidate-org        route.ts — POST (auth+Origin check) → revalidatePath("/","layout")
(app)/                     layout.tsx — TRPCProvider + SessionProvider + NavBar + Suspense
  ├── admin/               layout.tsx → role ∈ [admin]
  │   ├── page.tsx              AdminPanel (9 tabs: users/groups/products/periods/reminders/reopen/jobs/actions/settings)
  │   ├── products/             redirect → /admin?tab=products
  │   └── settings/             redirect → /admin?tab=settings
  ├── head/                layout.tsx → role ∈ [head, admin]
  │   ├── dashboard/page.tsx    DashboardPage + bfcache-recovery; review.dashboard + weeklyReport.get
  │   ├── history/              redirect → /reports?tab=published
  │   ├── slides/               redirect → /head/history?mode=slides (HEAD-CONSOLIDATE-01)
  │   └── report/          layout.tsx → role ∈ [head, admin]   (nested second gate)
  │       ├── page.tsx              WeeklyReportPage; ?period; ?authorId; redirectToCanonical
  │       └── [reportId]/
  │           ├── page.tsx              HeadReportShell; ?mode=form|slides; ?authorId
  │           └── present/page.tsx      HeadPresentClient; keyboard ← → J/K F=fullscreen
  ├── lead/                layout.tsx → role ∈ [lead, head, admin]   (head/admin can impersonate)
  │   ├── history/              redirect → /reports?tab=drafts
  │   └── report/
  │       ├── page.tsx              LeadForm; ?period; ?mode=slides|edit
  │       └── [reportId]/
  │           ├── page.tsx              LeadForm pinned to reportId
  │           └── preview/page.tsx      LeadSectionPreviewAuth (head's view of lead's section)
  └── reports/             layout.tsx → role ∈ [lead, head, admin, viewer]
      ├── page.tsx              client; role-branched (lead→myHistory, head/admin→compiledHistory)
      ├── history/              redirect → /reports?tab=published
      ├── trends/page.tsx       client; Recharts (ssr:false); analytics queries
      └── [reportId]/
          ├── page.tsx              client; WeeklyReportPage + PeriodSummaryTabs (AI stub)
          └── present/page.tsx      reuses HeadPresentClient (different exitHref)

Lead form is the heart (apps/web/src/components/lead/lead-form.tsx, 1871 LoC):
  7 parallel queries on mount: getActive, byPeriod (staleTime:Infinity), versions,
  myHistory (fill-from dropdown), crossAuthors + crossAuthorSections, conditional getVersion.
  All mutations through TanStack Query; createSnapshotMut fires on every autosave success.
  Single draftSection: ReportSectionReadModel | null is local source of truth, merged from
  per-subsection callbacks. LeadFormSyncBridge.Provider wraps Product Status + Risks for
  one-way stage promotion. Foreign cross-author entries (foreign:true) are read-only via
  LOCK-01 — onChange handlers strip them before writing.

Head/lead shell parity (Phase 61):
  Shared report-shell/ components: ReportToolbar (slot-based), ViewModeToggle (Edit|Slides),
  ArchiveToggle, ScopeToggle (allowedScopes per role). Shared renderers: WeeklyReportPage,
  StatusSlideDeck. Lead adds VersionHistoryNav + SaveNowButton + FillFromButton + sync bridge.
  Period nav differs: lead emits path-segment URLs; head uses urlBuilder callback preserving
  ?mode=slides and ?authorId.

Slides:
  status-slide-deck.tsx is dual-mode: mode='lead' → flat article; mode='head' → 2-col + readiness.
  buildSectionSlideModel / buildProductScopedSlides / sortSlidesForReview in section-slide-utils.
  HeadPresentClient = keyboard-navigable presentation reused for /head/.../present and /reports/.../present.
```

## §6 — Cross-cutting infrastructure

```
[boot order — apps/api/src/main.ts]
  1  Sentry.init (if SENTRY_DSN)        ← must precede OTel
  2  startOtel()                        ← monkey-patches http/express/prisma
  3  validateEnv()                      ← Zod superRefine; process.exit(1) on fail
  4  createAppLogger
  5  NestFactory.create(AppModule)
  6  AppModule.onApplicationBootstrap   ← dev-auth fence #2
  7  Sentry global exception filter
  8  ClsService resolved
  9  enableShutdownHooks
  10 helmet + cookieParser + ClsMiddleware + CorrelationIdMiddleware
  11 CORS (FRONTEND_URL + FRONTEND_URLS CSV; wildcards banned in prod)
  12 HTTP access log (skips /trpc)
  13 POST /api/client-logs forwarder
  14 BullMQ queues (outside Nest DI — DiscoveryService bug)
  15 createAppRouter + express.static /pdfs
  16 rate-limit (authLimiter 5/min, trpcLimiter 200/min)
  17 trpc express middleware at /trpc
  18 mountAuthRoutes (SAML + dev-login)
  19 mountBullBoard at /admin/queues (head-only)
  20 process.uncaughtException + unhandledRejection
  21 app.listen(env.PORT)

[env fences — apps/api/src/infrastructure/config/env.schema.ts superRefine]
  fence-1: !AUTH_DEV_MODE && !AUTH_JWT_SECRET                 → exit
  fence-2: NODE_ENV=production && AUTH_DEV_MODE=true          → exit ← critical
  fence-3: NODE_ENV=production && PDF_EXPORT_JWT_SECRET=def   → exit ← critical
  fence-4: NODE_ENV=production && FRONTEND_URLS includes "*"  → exit

[Prisma]
  @prisma/adapter-pg + pg.Pool (Prisma 7 driver-adapter pattern)
  DIRECT_URL: migrations bypass pgbouncer (session-mode DDL); runtime uses pgbouncer at port 5432
  Slow-query threshold 100ms → warn; debug logging only when LOG_LEVEL=debug

[BullMQ — apps/api/src/infrastructure/bullmq]
  Queues: pdf-export, email-reminder, telegram-outbound (Phase 55 seeds-only)
  Connection: { host: REDIS_HOST, port: REDIS_PORT, maxRetriesPerRequest: null }
  Workers use bare new Worker(...) on onModuleInit (NOT @Processor — DiscoveryService DI bug)
  pdf-export processor: launches Chromium headless, injects customreport_session cookie,
                        navigates to PDF_BASE_URL/print/{reportId}, generates A4 PDF, SHA-256 checksum
  email-reminder processor: concurrency 5, limiter 5/min (SMTP throttle); reads notificationFromEmail per job
  DLQ monitor: QueueEvents pub/sub → cr_dlq_failed_total counter + log ERROR
  Bull Board: /admin/queues (head-only) via Express adapter

[OTel — apps/api/src/infrastructure/otel/otel.bootstrap.ts]
  Start condition: OTEL_SDK_DISABLED !== "true" AND OTEL_EXPORTER_OTLP_ENDPOINT set
  Instrumentations: HttpInstrumentation, ExpressInstrumentation, PrismaInstrumentation
  Traces: OTLPTraceExporter → {endpoint}/v1/traces; TraceIdRatioBasedSampler (default 0.1)
  Logs: OTLPLogExporter → {endpoint}/v1/logs; AppLogger.emit() forwards to Loki automatically
  Must be first import in main.ts (monkey-patches http before NestJS/Express)
  Non-fatal if collector unreachable

[AppLogger — apps/api/src/lib/logger.ts]
  Custom JSON-line implementation (NOT pino)
  Per-line shape: { timestamp, level, message, correlationId, traceId?, spanId?, ...baseContext, ...callContext }
  correlationId from ClsService key 'correlationId'; traceId/spanId from active OTel span
  Optional file sink: LOG_DIR → app.log; rotates 50MB → gzip; prunes >30d
  child(context) merges baseContext, shares FileSink (serialized queue, no interleaving)

[Frontend client logger — apps/web/src/lib/client-logger.ts]
  Opt-in via NEXT_PUBLIC_CLIENT_LOG_FORWARDING=true
  Patches console.error/warn + window 'error' + 'unhandledrejection'
  Batches 50 entries or 2000ms → POST /api/client-logs with keepalive
  Flushes on visibilitychange hidden (tab close/background)

[tRPC client — apps/web/src/lib/trpc.ts + trpc-provider.tsx]
  Transformer: superjson; httpBatchLink with credentials:'include'
  Auth-redirect link inserted BEFORE httpBatchLink: intercepts 401/UNAUTHORIZED,
    redirects to /?next=<path>, swallows error (prevents toast during nav)
  No retry config — TanStack default 3× retry applies
  Toaster: sonner top-center 5000ms auto-dismiss

[Server-only helpers — apps/web/src/lib/server/]
  import "server-only"  ← Next.js RSC guard
  get-server-session.ts: cookies() → raw fetch tRPC batched GET → auth.me
                         cache:'no-store' (role downgrades must be visible immediately)
                         dev fallback skips cookie check
                         failure-closed: any error → null → ForbiddenPage
  get-org-public.ts:     cache:'force-cache' + next:{tags:['org-public'], revalidate:60}
                         invalidated via POST /api/revalidate-org after admin org edit

[Caddy — deploy/caddy/Caddyfile]
  /trpc/*, /auth/*, /health/*, /metrics, /admin/queues/*  → api:3001 (5m timeout)
  /*                                                       → web:3000
  HSTS, X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy, CSP-Report-Only
  Removes Server header; Caddyfile.staging uses internal CA

[Compose layers]
  docker-compose.yml              base (postgres + redis + mailpit + api + web)
  docker-compose.dev.yml          dev overrides (hot reload, debug)
  docker-compose.prod.yml         prod (pgbouncer in front of postgres, Caddy edge)
  docker-compose.observability.yml grafana/otel-lgtm + postgres/redis exporters
  docker-compose.errors.yml       Bugsink (Sentry-compatible error tracking)
```

## §7 — AI module (load-bearing)

```
[architecture — apps/api/src/modules/ai/]

tRPC router
  └─ AiService (Phase 31/32) — AI-01/02/03: summary, sentiment, on-track
       ├─ AiFacade interface ← ONLY Prisma seam in ai/** (eslint-enforced)
       │   └─ AiPrismaFacade (concrete) — only class permitted to import @prisma/client
       ├─ AiCache.withCache() — SHA-256 content-hash → AiInsight upsert; unique(kind, contentHash)
       │   computeContentHash = sha256(stableStringify(content))  ← sorted-key JSON
       ├─ AiClient.runStructured — Anthropic SDK; Zod JSON Schema tool-use; cache_control: ephemeral
       └─ AiAuthz (M-02) — Prisma where fragments by role; called before AI service to enforce visibility
              viewer→status:'published'; head/admin→none; lead→published OR sections.some({authorId})

  └─ AiSummaryService (Phase 54) — ai.periodSummary; period-level RAG stub
       ├─ AiAdapter interface (pluggable provider via AI_ADAPTER DI token)
       │   └─ MockAiAdapter (only concrete impl) — "[mock-summary] N sections, period <id>"
       └─ AiSummaryCache — Redis 60s, prefix customreport:ai:summary:; graceful-degrade

  └─ AiIngestionService — fire-and-forget: writes AiIngestionJob rows on publish

[ESLint rule (eslint.config.ts)]
  Inside apps/api/src/modules/ai/**: cannot import @prisma/client (raw)
  EXCEPT in ai-facade.ts, ai-cache.ts, ai-authz.ts, __tests__/**, __fixtures__/**
  Plus: cannot log identifiers `prompt`, `messages`, `response` via logger.* call (AST selector)

[Budget guard — ai.service.ts]
  PER_REPORT_BUDGET_TOKENS = 50_000  (~$0.05 at Haiku 4.5 pricing)
  Before EVERY Anthropic call: isOverBudget(reportId) sums inputTokens+outputTokens from
  AiInsight rows for reportId in last hour. Returns {available:false, reason:'budget_exceeded'}
  if over cap; never throws. Empty reportId → denied (C-01).

[Prompts — apps/api/src/modules/ai/prompts/]
  summary.ts   AI-01 executive summary  | system prompt ≥3500 chars → prompt cache
               output: {narrative:str(20-500), tone, highlights:str[]}
  sentiment.ts AI-02 risk severity      | 3-class: low/medium/high
               output: {level:enum, rationale:str(5-120)}
  on-track.ts  AI-03 cell advisory      | NEVER overrides lead colour; DO NOT change counts
               output: {verdict:enum, confidence:enum, rationale}
  sanitize.ts  prompt-injection guard   | MAX_LEN=2000; 8 patterns redacted (INST, system tags,
               ChatML, backticks, Human:/Assistant:)
  Per-field cap 1000 chars (Phase 32-M6/M-06) on on-track prompt, independent of 2000-char sanitizer cap
  All user-authored text wrapped in <user_content>...</user_content> after sanitization

[Adapter selection — ai.module.ts]
  AI_PROVIDER unset → MockAiAdapter; anything else → throws at boot
  AI_VISUAL_STUB=true → frozen stub responses (Phase 39-06 screenshot baseline stability)

[Golden-set eval — golden-set.eval.test.ts]
  Skipped unless ANTHROPIC_API_KEY set
  Pass thresholds: ≥80% classification match (sentiment + on-track), 0 hallucinated counts
  (narrative digits must all appear in input), summary ≤3 sentences

[AI integration in frontend — apps/web/src/components/ai/]
  AiSummaryCard      trpc.ai.summary; head-only Regenerate button
  OnTrackIcon        trpc.ai.onTrack; Check/AlertTriangle/X badge; advisory only
  RiskSentimentBadge trpc.ai.sentiment; low/medium/high pill
  PeriodSummaryTabs  trpc.ai.periodSummary (Phase 54 seeds-only); shows "(заглушка)" badge
  All graceful-hide when data.available === false
```

## §8 — Reminders engine (load-bearing)

```
[two-tier architecture — apps/api/src/modules/reminders/]

ReminderPolicy (template, admin-editable)
   active bool, validFrom/validUntil, kind (deadline|escalation|follow_up),
   offsetMinutes (usually negative — e.g. -1440 = T-24h),
   timezone (org default), audience (LEAD_WITH_DRAFT|HEAD_OF_LATE)
        ↓ PolicyApplicatorService.applyToPeriod()  ← fires on period create / backfill
ReminderRule (concrete per-period rows)
   fireAt DateTime (DST-correct via Luxon)
   policyId? + reportId — unique pair
        ↓ RemindersScheduler @Cron(EVERY_HOUR) runOnce(now)
ReminderExecution (deduped by dedupeKey)
        ↓ BullMQ queue "email-reminder"
EmailReminderProcessor → react-email render → nodemailer SMTP

[DST math — policy-applicator.service.ts]
  Luxon-based:
    deadlineInPolicyTz = DateTime.fromJSDate(deadline, { zone: 'utc' }).setZone(policy.timezone)
    fireAtInPolicyTz   = deadlineInPolicyTz.plus({ minutes: policy.offsetMinutes })
    fireAt             = fireAtInPolicyTz.toUTC().toJSDate()
  Validity gate: policy.active && period.deadline >= policy.validFrom && (validUntil null OR ≤ validUntil)
  P2002 race → log + continue (other policies still processed)
  Perf test: 50 policies < 200ms; each policy = 1 findUnique + 1 upsert

[scheduler — reminders.scheduler.ts]
  @Cron(EVERY_HOUR) → runOnce(now):
    1. findDueDeadlineRules — active deadline rules with fireAt ≤ now AND sections still draft
       Recipients = lead users with unsubmitted sections; skip notificationOptOut=true (NOTIF-05)
    2. findDueEscalationRules — active escalation rules; ONE digest email per head
       Escalation BYPASSES notificationOptOut
    3. Org brand fetched ONCE per tick (not per recipient) ← snapshots into queued job
    4. requestReminderExecution(ruleId, email, payload) per recipient

[dedupe — atomic via DB unique index on ReminderExecution.dedupeKey]
  Phase 28+ (current):  ${ruleId}:${kind}:${cycleDate}:${email}
  Legacy v2.0:          ${ruleId}:${fireAt.toISOString()}:${email}
  extractRecipientEmail(dedupeKey): split on ':', test last segment against EMAIL_RE; handles both shapes

[BullMQ — apps/api/src/infrastructure/bullmq/email-reminder.processor.ts]
  Worker: concurrency 5, limiter {max:5, duration:60_000} ← SMTP rate-limit
  attempts:3, backoff:{type:'exponential', delay:5000}
  No explicit DLQ — BullMQ retains failed in bull:email-reminder:failed
  Discriminated payload kinds (kind: deadline | escalation | legacy)
  After send: remindersService.markReminderSent(executionId)

[Templates — apps/api/src/modules/email/render-template.ts]
  Uses @react-email/render
  DeadlineEmail:   [<shortName>] Reminder: <period> report section due in 24h
  EscalationEmail: [<shortName>] Action required: N late report sections (YYYY-MM-DD)
  Both return {subject, html, text}; multipart for spam-filter score
  shortName snapshotted from org brand at enqueue, not at delivery (concurrency-safe)
```

## §9 — Most fragile / surprising patterns (cite-anything checklist)

| #   | Pattern                                                           | Where                                                                                    | Why fragile                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Dual state machine on Report                                      | prisma schema + period.service.ts                                                        | `periodState` + (`periodStatus` + `status` + `archived`) MUST be written atomically by all 6 writers (publish/reopen/AutoPublisher/AutoArchiver/admin archive/unarchive). NO DB constraint enforces consistency — code discipline only. Future migration that drops legacy columns while a writer still touches only one side would silently corrupt `getActiveReportId()` which uses `periodStatus` not `periodState`. |
| 2   | `reopenPeriod` resets ALL submitted sections                      | period.prisma-repository.ts                                                              | A head trying to reopen one late lead's section implicitly clears EVERYONE's submission and resets `periodState='open'`. Intentional but high-blast-radius.                                                                                                                                                                                                                                                             |
| 3   | `publishedSnapshot` is immutable                                  | Report.publishedSnapshot Json?                                                           | Published view is permanently frozen at the moment of "Publish" click. Sections still in draft at publish time appear as «Не сдал» placeholders forever and cannot be retroactively corrected without `reopenPeriod` + re-publish.                                                                                                                                                                                      |
| 4   | Partial unique index on Report                                    | migrations/20260512_c2_report_open_unique                                                | `Report_one_open_per_boundary (periodStart,periodEnd) WHERE periodState='open'` — raw SQL migration; Prisma DSL cannot express WHERE clause. Same migration contains a hardcoded dev UUID `DELETE` step (no-op on most envs); H3 migration (20260514) adds generic content-based dedup.                                                                                                                                 |
| 5   | Director role added + dropped same week                           | migrations 20260511_add_director_role → 20260514_defer_director_and_viewer_group         | PostgreSQL cannot drop enum values in-place; removal required full enum recreation (CREATE TYPE Role_new, cast both User and UserActionLog columns, rename, drop). Existing director rows were silently demoted to viewer.                                                                                                                                                                                              |
| 6   | GroupProduct unique churned 3 times                               | migrations 20260511 → A4 → B1                                                            | Original M:M composite UNIQUE(groupId,productId) → A4 added UNIQUE(groupId) (logically inverted) → B1 dropped composite via DROP INDEX (not DROP CONSTRAINT) and added UNIQUE(productId). The B1 comment explicitly explains the DROP INDEX vs DROP CONSTRAINT distinction.                                                                                                                                             |
| 7   | Priority table dropped wholesale                                  | migrations 20260520_drop_priority_add_item_rank                                          | `DROP TABLE Priority` ran; replaced with inline `Item.priorityRank Int?`. Any code still referencing `prisma.priority.*` crashes at RUNTIME, not at typecheck. TODO(PRISMA-TYPECHECK-01) tracks the gate that doesn't exist yet.                                                                                                                                                                                        |
| 8   | `restoreVersion` has no OCC                                       | lead-form.prisma-repository.ts:289                                                       | wipe+recreate items/risks/decisions/stageStatuses inside a $transaction — no optimistic version check. Concurrent restore vs autosave = last-writer-wins. TODO(v8.5-A-occ).                                                                                                                                                                                                                                             |
| 9   | `staleTime: Infinity` on byPeriod query                           | lead-form.tsx:329                                                                        | Intentional for single-tab; unsafe for multi-tab. TODO(v8.5-D-multitab) tracks the fix (set staleTime:30_000 + invalidate on save success).                                                                                                                                                                                                                                                                             |
| 10  | `stageName` column is a comma-joined string of stage NAMES        | Item/Risk/Decision in schema; mapPrismaToReportSection in lead-form.prisma-repository.ts | NOT UUIDs — split on ", " to produce stageIds[]. Cross-author risk filter has known gap for multi-stage risks. TODO(STAGE-CROSS-AUTHOR-MULTI) at line 764. Field name is misleading — it's actually plural names.                                                                                                                                                                                                       |
| 11  | Sentry has tracesSampleRate: 0 in all 3 configs                   | apps/web/sentry.{server,client,edge}.config.ts                                           | No beforeSend scrubbing, no integrations, no replay. Manual Sentry.captureException(error) in error.tsx only. Server side has separate `SentryExceptionFilter` in NestJS (`@Catch()`) that only sends ≥500 errors. Sub-500 HTTP errors never reach Sentry.                                                                                                                                                              |
| 12  | `middleware.ts` is ABSENT in apps/web                             | apps/web/src/proxy.ts + proxy.test.ts                                                    | Auth guard is a regular module imported by Next.js' middleware-slot file under a different name. Allows direct unit testing as a plain function.                                                                                                                                                                                                                                                                        |
| 13  | `getActiveReportId` fallback                                      | weekly-report.prisma-repository.ts                                                       | (a) findFirst where periodStatus IN ('open','reopened') (b) if none: findFirst where periodStatus='published'. Returns null on empty DB → `{status:'no-period', report:null}`. Lead landing on empty DB never crashes.                                                                                                                                                                                                  |
| 14  | Session revocation fails OPEN on Redis error                      | session-revocation.service.ts isRevoked                                                  | Returns false on Redis error — all users pass through. DB User.isActive=false is the fallback safety net.                                                                                                                                                                                                                                                                                                               |
| 15  | Mutation-audit allowlist hides one BLACK HOLE                     | apps/web/uat-suite/mutation-audit.allowlist.json                                         | `carryOver.execute` is the only entry — justified as cron-only (user sees result as carry-over rows next week). New BLACK HOLEs MUST go through PR review to land in allowlist.                                                                                                                                                                                                                                         |
| 16  | tRPC client uses @trpc/tanstack-react-query NOT @trpc/react-query | apps/web/src/lib/trpc.ts (per .planning/codebase/CONVENTIONS.md)                         | React Compiler breaks @trpc/react-query — never switch back. Locked in v8.3.                                                                                                                                                                                                                                                                                                                                            |
| 17  | adminProcedure ≠ headProcedure since UFB-038                      | infrastructure/trpc/trpc.middleware.ts                                                   | head no longer reaches /admin/\* endpoints. The two procedure chains are distinct middleware references; role-coverage gate validates them by reference identity.                                                                                                                                                                                                                                                       |
| 18  | bare BullMQ Workers, not @Processor                               | infrastructure/bullmq + telegram.queue.ts                                                | DiscoveryService DI bug in @nestjs/bullmq 11 forces direct `new Worker(...)` in onModuleInit.                                                                                                                                                                                                                                                                                                                           |
| 19  | Russian text in JSX is a defect                                   | CLAUDE.md, every static UI string                                                        | `grep -nE '[а-яА-Я]' <file>` must yield only matches in data/comments/tests. Hardcoded Russian in JSX/toast/aria-label/button copy = block at code-review.                                                                                                                                                                                                                                                              |
| 20  | All future-feature UI uses ComingSoonBadge                        | packages/ui/src/components/coming-soon-badge.tsx                                         | Inert control with tooltip, not a hidden flag. Used for Language, Theme, Telegram tab, Agent Review, deferred Director workflow. Pattern is mandatory per CLAUDE.md "Deferred Features" section.                                                                                                                                                                                                                        |

## §10 — Test pyramid

```
   E2E  Playwright  ← 10 specs auto-generated from UAT-SCENARIO/*.md
   ─────────────────  60% are visibility stubs; full interaction flows for lead/admin only
   |__ 99-cross-cutting + 01-09 per screen
   |__ Skipped: AUTH-11/15, LF.06, LF.03 (TODO), DASH-18/21/23, HR.05

   Visual regression  ← Playwright --project=visual; CI gate visual-baseline job
   ─────────────────  customreport_visual DB; AI_VISUAL_STUB=true; seed-simple for byte-stable

   Integration  Vitest+Prisma  ← *.integration.test.ts; real customreport_test DB
   ─────────────────────────── cleanDatabase deleteMany in FK-safe order; seedTestData

   Contract  Vitest  ← *.contract.test.ts; verifies Zod schema round-trips with repo output
   ────────────────  acts as gate between DB migrations and wire contract

   Unit  Vitest  ← *.service.test.ts + *.guard.test.ts + lib/*.test.ts
   ────────────  in-memory repository fakes; no DB; coverage thresholds 70/60/70/70

   k6 load  tests/load/k6-baseline.js  ← 50 VUs, p95 read <300ms / write <800ms / errors <1%

[counts]
   Web vitest:           ~559/559 PASS  (lead/dashboard/admin components + hooks + mappers)
   API vitest:           ~926/926 PASS  (modules + integration + contract)
   E2E:                  4 pre-existing seed failures (not regressions)
   Total contract+unit:  ~2008

[notable test patterns]
   apps/api/src/test-utils/silence-logs.ts   → vi.spyOn(stderr,'write').mockImpl(...) for boot-error tests
   apps/api/src/test-utils/mailpit.ts        → HTTP client for Mailpit at :8025; pollForMessage helper
   apps/api/src/test-utils/prisma-test-helper.ts → singleton PrismaClient + cleanDatabase + seedTestData + TEST_IDS
   apps/web/src/test/msw-handlers.ts         → mocks tRPC GET/POST; superjson-wrapped responses
   apps/web/src/test/server-only-mock.ts     → empty export to allow RSC helpers in jsdom

[gates that block CI/PR]
   pnpm typecheck      turbo run typecheck
   pnpm lint           turbo run lint
   pnpm test           turbo run test (coverage 70/60/70/70)
   pnpm uat:audit      mutation-audit gate (BLACK HOLE check)
   pnpm uat:coverage   exit 1 if matrix.json coveragePercent < 100 (unless UAT_COVERAGE_ALLOW_GAP)
   prisma migrate reset --skip-seed  CI job migrate-reset rebuilds DB from scratch (catches schema drift)
   visual baseline     CI job visual-baseline regen requires explicit --update-snapshots commit
   markdownlint        pnpm lint:md on .planning/** + README.md
   shellcheck          on every *.sh edit (per CLAUDE.md rule)

[pre-commit / pre-push husky]
   pre-commit  pnpm exec lint-staged   (prettier + eslint --max-warnings=0 + markdownlint --fix)
   commit-msg  pnpm exec commitlint --edit "$1"   (Conventional Commits)
   pre-push    pnpm test                          (skipped if CI=true or SKIP_PREPUSH=1)
   post-merge  conditional pnpm install + prisma generate (only when lock/schema changed)
   post-rewrite same as post-merge
```

## §11 — Deploy + observability

```
[compose layers]
   docker-compose.yml              base — postgres:15-alpine (+pg_stat_statements), redis:7-alpine,
                                          axllent/mailpit (service name kept as `mailhog` for env compat),
                                          migrate + api + web (Dockerfile.api / .web)
   docker-compose.dev.yml          dev overrides — node --watch on api, pnpm dev on web,
                                                   bind mounts apps/{api,web}/src + packages/{shared,ui}/src + prisma,
                                                   OTEL_EXPORTER_OTLP_ENDPOINT → host.docker.internal:4318
   docker-compose.prod.yml         prod — edoburu/pgbouncer 1.22 in front of postgres (transaction mode),
                                          api connects via pgbouncer with ?pgbouncer=true&connection_limit=1,
                                          migrate uses DIRECT_URL (session mode for DDL),
                                          caddy 2.8-alpine edge with Let's Encrypt,
                                          memory limits (postgres 512M, api 2G, web 512M, caddy 256M)
   docker-compose.observability.yml grafana/otel-lgtm:latest at :3003 (Grafana login admin/admin),
                                          OTLP gRPC 4317 + HTTP 4318, Prometheus :9090,
                                          postgres-exporter, redis-exporter
   docker-compose.errors.yml       bugsink/bugsink:latest at :8000 (Sentry-compatible)

[Caddy routing — deploy/caddy/Caddyfile]
   /trpc, /trpc/*           → api:3001 (5m read/write timeout)
   /auth, /auth/*           → api:3001
   /health, /health/*       → api:3001
   /metrics                 → api:3001
   /admin/queues, /queues/* → api:3001 (Bull Board UI)
   /*                       → web:3000
   Headers: HSTS, X-Content-Type-Options nosniff, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin,
            CSP-Report-Only same-origin, Server header removed

[Prometheus]
   deploy/prometheus.yml             standalone prod (api:3002 + postgres/redis exporters)
   deploy/prometheus-otel-lgtm.yml   dev observability bundle (host.docker.internal:3002)
   Scrape interval 15s api / 30s exporters; scrape_native_histograms:true

[Alert rules — deploy/alert-rules.yml]
   DLQFailuresActive  cr_dlq_failed_total > 0           for 5m  warning
   ApiDown            up{job="customreport-api"} == 0   for 1m  critical
   ClsPoor            web_vital_cls > 0.25              for 5m  warning
   Alertmanager: webhook stub at http://api:3002/api/alerts, 4h repeat

[Grafana dashboards — deploy/grafana/]
   customreport-dashboard.json       customreport-ops folder    — HTTP req rate, p95 latency, DLQ
   trpc-latency-dashboard.json       customreport-ops folder    — tRPC p50/p95/p99 by procedure
   product-telemetry-dashboard.json  Product KPIs folder        — reports/week, on-time ratio,
                                                                 active leads, late sections,
                                                                 pending reopens, PDF exports 7d
   Provisioning: 30s update; datasources Prometheus (default), Loki, Tempo
   Loki derivedFields extracts traceId from log JSON → links to Tempo
   Tempo has traces→logs (Loki) + service map (Prometheus)

[Log sink — deploy/log-sink/]
   vector.toml    multi-destination (Loki/Datadog/Elasticsearch) — recommended
   promtail.yml   pure Loki — uses level + phase as labels
   Both tail /app/logs/app.log (AppLogger JSON-line output)

[Custom Prometheus metrics — apps/api/src/infrastructure/metrics/metrics.registry.ts]
   http_request_duration_seconds {method, route, status_code}    Histogram
   trpc_request_duration_seconds {procedure, type, status}        Histogram
   trpc_request_total            {procedure, type, status}        Counter
   cr_dlq_failed_total           {queue}                          Counter
   cr_rate_limit_hits_total      {bucket}                         Counter
   cr_login_attempts_total       {method, outcome}                Counter
   customreport_reports_submitted_total          {state}          Counter
   customreport_sections_submitted_total         {late}           Counter
   customreport_section_submission_latency_seconds                Histogram (signed Δ vs deadline)
   customreport_reports_on_time_ratio                             Gauge (lazy-collect at scrape)
   customreport_active_leads_total                                Gauge
   customreport_reopen_requests_total {state}                     Counter
   customreport_pdf_export_requests_total {role}                  Counter
   customreport_period_state_transitions_total {from, to}         Counter
   customreport_ai_summary_generated_total {provider, status}     Counter
   customreport_ai_summary_duration_seconds {provider}            Histogram
   customreport_telegram_message_sent_total {status}              Counter
   web_vital_{lcp,cls,fcp,inp,ttfb} {navigation_type}             Gauge
   + collectDefaultMetrics (Node heap, CPU, GC, event-loop lag)
```

## §12 — `.planning/` navigation

| Subdir                                                                                   | Files | Use to find…                                                                               |
| ---------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------ |
| `STATE.md`                                                                               | 1     | Current milestone status (authoritative; HANDOFF.json is STALE from May-12)                |
| `ROADMAP.md`                                                                             | 1     | Milestone history v1.0 → v8.4                                                              |
| `session-retros/NEXT-ACTIONS.md`                                                         | 1     | Carry-forward ledger: RUN FIRST / AGENT / HUMAN / STILL-PENDING / BLOCKED-BY-POLICY / DONE |
| `plans/graceful-coalescing-kurzweil.md`                                                  | 1     | Active v8.4 plan (§18-§24)                                                                 |
| `plans/quiet-pondering-dragonfly.md`                                                     | 1     | v8.4.2 UAT feedback sweep                                                                  |
| `codebase/CONVENTIONS.md`                                                                | 1     | Naming + TypeScript + repository pattern rules                                             |
| `codebase/CONCERNS.md`                                                                   | 1     | Cross-cutting architecture concerns                                                        |
| `codebase/TESTING.md`                                                                    | 1     | Test pyramid + patterns                                                                    |
| `phases/NN-<slug>/NN-{CONTEXT,PLAN,SUMMARY,VERIFICATION}.md`                             | 391   | Per-phase artifacts; phases 50-71 are most recent                                          |
| `milestones/v8.{1,2}-{ROADMAP,REQUIREMENTS}.md`                                          | 88    | Per-milestone shipped state + accept criteria                                              |
| `audits/YYYY-MM-DD-*.md + *.json`                                                        | 49    | `pnpm audit-work` forensic outputs + UAT findings                                          |
| `regression/COVERAGE-GAP-*.md, AGENT-*.md`                                               | 124   | Pre-v8.1 bug matrices, agent test results, post-v8.3 UAT findings                          |
| `research/STACK.md`                                                                      | 1     | Stack decisions + why (context7-verified for v6.0)                                         |
| `research/PITFALLS.md`                                                                   | 1     | Architectural pitfalls to avoid                                                            |
| `research/2026-05-10-perf-baseline.md`                                                   | 1     | API p50/p95 latency + Postgres hot tables                                                  |
| `todos/pending/2026-05-25-slide-redesign-v8.4.3.md`                                      | 1     | Slide grid D1+D2 redesign deferred to v8.4.3                                               |
| `todos/pending/2026-05-21-{holidays-calendar,remind-aria-live,jira-linkage-deferred}.md` | 3     | Other active deferred work                                                                 |
| `tickets/session-leftovers-2026-05-14/ADR.md`                                            | 1     | Decision authority for v8.1 leftover work                                                  |
| `notes/slide-density-audit-2026-05-25.md` + `slide-density/*.yml`                        | 3+    | Slide density audit evidence (UAT SC3 snapshots)                                           |
| `memory/MEMORY.md` + `project_*.md` + `feedback_*.md`                                    | 56    | claude-mem snapshots; persistent behavioural lessons                                       |
| `MANIFEST.md`                                                                            | 1     | Domain spec (roles, stages, data flow)                                                     |
| `CONTRIBUTING.md`                                                                        | 1     | Dev setup, husky hooks, push-guard workaround                                              |
| `INCIDENT-PLAYBOOK.md`                                                                   | 1     | Rollback procedure, on-call rotation, postmortem template                                  |
| `RUNBOOK.md`                                                                             | 1     | Top-10 failure modes → symptom → cause → fix                                               |
| `REGRESSION-SCENARIOS.md`                                                                | 1     | 223 SC-\* scenarios (Given/When/Then) by role                                              |
| `UAT-SCENARIO/<NN>-<screen>.md`                                                          | 11    | Per-screen DOM element catalog; status markers [ ]/[P]/[M]/[S]                             |
| `v8.{1,2}-MILESTONE-AUDIT.md`                                                            | 2     | Milestone exit audits                                                                      |
| `INTAKE-{2026-05-11,15,16}.md`                                                           | 3     | Session-recovery reports (16th is core-principles work, not feature work)                  |
| `local-archive/`                                                                         | 202   | Pre-v8.0 frozen artifacts — read INDEX.md first                                            |
| `graphs/GRAPH_REPORT.md`                                                                 | 1     | graphify hotspots + community structure (read before broad grep)                           |
| `screenshots/` (PNG) + `ui-reviews/` (PNG/HTML)                                          | 100   | Visual evidence; gitignored; not text-readable                                             |

## §13 — Top-10 gotchas a new agent must know first

1. **Branch & state.** `fix/PRJ-2/shiny-eagle` is ~70+ commits ahead of `main`. PR #7 awaits human approve → tag `v8.4.2` → Jira PRJ-2 transition. Use `STATE.md` + `session-retros/NEXT-ACTIONS.md` — NOT `HANDOFF.json` (stale from May-12).
2. **Dual state machine on Report.** Always write `periodState` AND `(periodStatus, status, archived)` atomically. There is no DB constraint — code discipline only. `getActiveReportId` reads `periodStatus`, not `periodState`.
3. **Published snapshot is immutable.** `Report.publishedSnapshot Json?` is frozen at publish time; missing-section leads appear as «Не сдал» forever. Only `reopenPeriod` (which resets ALL sections) can fix it.
4. **`prisma.priority.*` is GONE.** Item.priorityRank Int? replaced the dropped Priority table. Any stale reference crashes at runtime. TODO(PRISMA-TYPECHECK-01).
5. **`stageName` is plural names, not UUIDs.** Item/Risk/Decision store comma-joined stage NAMES (e.g. `"Testing, DevOps"`). `mapPrismaToReportSection` splits on `", "`. Cross-author risk filter has known multi-stage gap — TODO(STAGE-CROSS-AUTHOR-MULTI).
6. **Russian text in JSX is a defect.** Static UI strings stay English until real i18n exists. Russian is allowed only as DB data, comments, tests/fixtures. Quick check: `grep -nE '[а-яА-Я]' <file>`.
7. **Deferred-feature pattern is mandatory.** UI → `ComingSoonBadge` (inert control with tooltip; nav-bar Language/Theme, settings Telegram). Backend → `throw new Error('Not implemented — see TODO(<ID>)')`. Add a `todos/pending/YYYY-MM-DD-<slug>.md` with acceptance criteria.
8. **AI module facade boundary.** Inside `apps/api/src/modules/ai/**`, raw `@prisma/client` imports are eslint-banned except in `ai-facade.ts`, `ai-cache.ts`, `ai-authz.ts`, tests, fixtures. Logging identifiers `prompt`, `messages`, `response` via `logger.*` is also banned (AST selector). 50K-token/hour per-report budget guard.
9. **Mutation-audit gate.** Every new tRPC mutation must have a same-namespace `list*/get*/snapshot*/find*` query OR a `web ref` — otherwise CI fails as BLACK HOLE. Allowlist requires PR review.
10. **Destructive guards.** `prisma/_destructive-guard.ts` blocks all destructive ops unless `DATABASE_URL` host is local OR DB name contains `_uat`/`_dev`/`_test`/`_local`/`_staging`. Compose service name `postgres` is INTENTIONALLY excluded from "truly local" set — a staging stack with `postgres` host needs an explicit suffix. The user-facing override is `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=да` (Prisma 7 ai-fence).

Plus bonus: docker stale-code trap — after 24h+ uptime `docker compose restart api web` before any UAT, otherwise `node --watch` silently stops reloading; push-guard — forge.example.org may need `https_proxy="" http_proxy="" git push`; tRPC client wiring must stay on `@trpc/tanstack-react-query` (React Compiler breaks `@trpc/react-query`).
