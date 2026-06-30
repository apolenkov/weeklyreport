# Wave D — ready-to-load configs (HIGH-stakes one-at-a-time; order #32→#33→#35→#34→#36)

protect-metrics-endpoint is RESOLVED: EXCLUDED from batch C, owned SOLELY by #32 (folded, two commits A→B). Do NOT add it elsewhere.

## ORDER + WHY

#32 → #33 → #35 → #34 → #36

- #32 first: deploy/CI/config only, disjoint from app source; not gate-verifiable (acceptance = docker build + curl-prod, deferred). Owns the protect-metrics fold-in (host-port closure must land before /metrics removal).
- #33 before #34: COLLIDE on apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts (#33 Promise.all getWeeklyReport; #34 import computeWorstStatus + delete string dup). Serialize, #33 first.
- #35 before #34: #35 edits prisma seeds (seed.ts, seed-simple.ts, backfill, \_destructive-guard) — land before #34's orchestrator migrate-reset so the single reseed reflects both.
- #34 = SCHEMA-RESET point (ONLY schema change). After #34 schema.prisma + migration.sql edits land, ORCHESTRATOR (NOT workflow) runs `migrate reset` on customreport_test AND customreport_dev (reset independently, PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION), RESEEDS (Prisma 7 no auto-seed), db:generate.
- #36 LAST: PLAN-ONLY (codeless) — authored against the final tree for plan accuracy.

## CROSS-WAVE read-fresh overlaps (batch C lands first → these files already have batch C edits)

- #34 telemetry.gauges.ts ∩ batch-C guard-metrics-scrape-db-failure (#5) — read fresh.
- #34 periods-tab-dialog.tsx ∩ batch-C fix-period-datetime-tz (#6) — read fresh.
- #34 + #35 report-primitives.schema.ts ∩ batch-C fix-risk-stage (#7) — read fresh; #35 is comment-only there (stage only the comment line).

## #32 ci-deploy-supplychain-hardening (high; FOLDS protect-metrics; TWO commits A→B; needsIntegration false — deploy-time, gate can't verify)

files: .github/workflows/ci.yml (db:seed:simple->middle; --frozen-lockfile; digest-pin), .husky/pre-push (add turbo typecheck+lint+format:check ahead of catalog:check+test; add set -e — unchained cmds mask early failures), Dockerfile.web (--frozen-lockfile; digest-pin node:25-alpine; pin turbo; ARG API_URL :3002->:3001; NEXT_PUBLIC_API_URL off host-port -> Caddy edge), Dockerfile.api (digest-pin; EXPOSE/HEALTHCHECK :3002->3001), docker-compose.prod.yml (api ports->expose ["3001"] HOST-PORT CLOSURE; web NEXT_PUBLIC_API_URL via build.args; keep API_URL=http://api:3001), deploy/caddy/Caddyfile + Caddyfile.staging (CSP Report-Only->enforcing AFTER browser validation; FOLDED: remove /metrics from @api path matcher), deploy/prometheus.yml (FOLDED: customreport-api target api:3002->3001 or mark non-authoritative).
caveat: DEPLOY-TIME, gate can't verify (acceptance docker build + curl-prod, deferred). TWO ORDERED COMMITS by ONE agent: A=#32 proper (host-port closure + Dockerfile + supply-chain + CI/husky + CSP enforce); B=protect-metrics (/metrics removal both Caddyfiles + prometheus.yml). A before B. Tasks 1.5/1.6 (restore CI triggers + red-commit proof) gated on a runner — defer, keep "no enforced server-side gate" comment (1.7). CSP flip needs in-browser validation across 4 role surfaces — do NOT flip blind.
commitSubject A: chore(deploy): close the API host port, enforce CSP, freeze lockfiles, pin images, repair CI/pre-push gate
commitSubject B: fix(deploy): remove /metrics from the public Caddy edge and reconcile the scrape target

## #33 observability-and-perf-hardening (high; DROP task 3.3 — obsoleted by #19; needsIntegration false)

files: otel/otel.bootstrap.ts, bullmq/pdf-export.processor.ts + email-reminder.processor.ts + dlq-monitor.service.ts + bull-board.module.ts, telegram/telegram.queue.ts, weekly-report.prisma-repository.ts (COLLIDES #34), archive/archive.prisma-repository.ts (cursor pagination per task 3.2), organization/organization.prisma-repository.ts, lib/logger.ts. NOT admin-snapshot-write.queries.ts (task 3.3 DROPPED).
seam: (1) worker trace/CLS correlation: inject W3C traceparent + correlationId at queue.add; extract+link span + seed nestjs-cls in each processor; route worker logs through AppLogger; PDF per-step timings + page.goto timeout. (2) DLQ: Number.isFinite guard on DLQ_ALERT_THRESHOLD; add telegram-outbound to QUEUE_NAMES; lifecycle-close the two Bull Board Queue instances. (3) hot-path: Promise.all leadUsers+projects in getWeeklyReport; archive pagination into repo (cursor {id}+skip:1, orderBy publishedAt desc,id, take limit+1); organization findUnique-then-create; gate logger prune behind rotation/timer.
caveat: DROP task 3.3 + its 3.6 upsertUsers assertion (VERIFIED OBSOLETE: #19 4455edb1 rewrote upsertUsers to pure update-or-create, no delete-of-removed phase). error-trace-correlation is MODIFIED capability (keep existing reqs). New label cr_dlq_failed_total{queue="telegram-outbound"}.
mustCover: worker span links to enqueue trace + failure log from AppLogger w/ correlationId; invalid DLQ_ALERT_THRESHOLD->default(5)+warn; terminal telegram-outbound failure increments cr_dlq_failed_total EXACTLY ONCE (DLQ monitor sole owner, no worker double-count); Bull Board's 2 Queue instances close on shutdown; getWeeklyReport dispatches leadUsers+projects concurrently + archive reads page+1 probe only; organization read does NO write when row exists.
commitSubject: perf(api): link worker traces, harden DLQ monitoring, and parallelize/paginate hot-path reads

## #34 code-health-and-test-cleanup (high; SCHEMA — orchestrator migrate-reset; LARGE 10 task groups; needsIntegration false)

SCHEMA SLICE (the critical bit): schema.prisma — Decision project FK (~line 358) + StageStatus project FK (~line 291) onDelete:Cascade->Restrict (ProjectStatus FK ALREADY Restrict = exemplar, don't touch; StageAssignment stays Cascade); add "hard product deletion unsupported" comment; GroupProduct comment fix (~143-154). migration.sql 20260530162224_init — StageStatus_projectId_fkey (~line 668) + Decision_productId_fkey (~line 692) ON DELETE CASCADE->RESTRICT (ProjectStatus_projectId_fkey line 662 already RESTRICT).
REFACTOR SLICE: cross-group-signal.ts (reuse computeAllowedGroupIds, delete local), telemetry.gauges.ts (share activeLeadsLastPublishedPeriod; name 2 on-time windows distinctly — READ FRESH, batch-C #5 touched it) + telemetry.prisma-repository.ts (collapse dup query), published-report-snapshot.ts (single computeWorstStatus+statusSeverity) + weekly-report.prisma-repository.ts (import it, delete string `?? 0` dup — COLLIDES #33), activity.prisma-repository.ts (remove dead lastEdit null branch), auth.module/jwt.strategy/admin.router/review.router (DELETE after grep-proving test-only; point tests at live adminProcedure/headProcedure), web: lead-form.ts (priorityRank on LeadKanbanItem), weekly-report-page.tsx (reportHasContent helper), shared dialog focus primitive across lead+admin dialogs (periods-tab-dialog READ FRESH — batch-C #6), dead components (ToggleAllButton/ReportArchiveSection/AppShell) + redirects, web+api test-utils (msw-handlers, restoreMocks, silence helpers).
caveat: SCHEMA-RESET HANDOFF — hand-edited init migration reaches DB ONLY via migrate reset (orchestrator, \_test AND \_dev, after edits land; reseed; db:generate). Workflow must NOT migrate-reset. Land #35 (seeds) BEFORE this reset. LARGE — FK edit is the schema-critical slice; READ periods-tab-dialog.tsx + telemetry.gauges.ts FRESH (earlier waves modified). Behavior-preserving.
commitSubject: refactor(repo): consolidate duplicated derivations, remove dead code, unify dialog focus, align FK onDelete to RESTRICT

## #35 input-and-error-hardening (high; PARTIAL — SKIP sections 4 (JWT alg pin) + 9 (cookie-name): SHIPPED; needsIntegration false)

files: shared/schemas/search.ts (q->safeText{min:2,max:200}), shared/schemas/telemetry.ts (sparkline .max(8)->.max(4)), middleware/correlation-id.middleware.ts (validate x-request-id /^[\x20-\x7E]{1,128}$/ else fresh randomUUID), trpc.router.ts (dev.wipeAndReseed protectedProcedure->adminProcedure), web/dev/role-switcher.tsx (hide/disable 4 wipe/reset controls unless dev role admin), prisma/seed.ts (assertNonProdDestructive('seed') first) + prisma/backfill-policy-rules.ts (guard), lib/audit-logger-types.ts (add 'period.manual-edit' to AuditEvent union) + lib/audit-logger.ts (typed local emit helper, route ~15 sites), report-primitives.schema.ts (comment only — READ FRESH batch-C #7, stage only comment) + auth.ts (comment) + seed-simple.ts (comment) + \_destructive-guard.ts (docstring).
caveat: PARTIAL — sections 4+9 VERIFIED SHIPPED (auth.controller pins algorithms:[HS256]; trpc.context uses resolveSessionCookieName) — SKIP, do not re-add. Sections 6/8.3 edit seeds — land BEFORE #34 reset. audit-logger 7.2 must route EVERY emit site through the typed helper (bare `satisfies AuditEnvelope` fails excess-property).
mustCover: search q rejects null-byte at Zod + tRPC BAD_REQUEST before repo, min-2 floor; sparkline rejects 5 accepts 4; x-request-id valid adopted/oversized-control-absent->fresh UUID; dev.wipeAndReseed adminProcedure + web reset controls absent for non-admin dev; undeclared audit event = typecheck error; sections 4+9 NOT re-modified.
commitSubject: fix(api): harden search/x-request-id/sparkline inputs, restrict dev reseed to admin, type audit events

## #36 tighten-code-quality-ratchet (LOW; PLAN-ONLY, codeless — BYPASS implement/verify/gate)

files: NONE (no source). Writes ONLY the spec delta to lint-max-strictness-standard (max-lines 300->250; add no-magic-numbers error + exemptions; flip sonarjs/no-duplicate-string off->error; add ratchet execution plan). Does NOT edit eslint.config.ts, does NOT enable any rule, does NOT fix any file. "Landing" = openspec validate --strict + sync/archive delta + commit the spec. Spin NO verifiers/gate on it.
caveat: PLAN-ONLY activates nothing so it CANNOT trip earlier changes. "Last" only so the documented 250-300 cohort reflects the final tree + R0a precondition (current 300 grandfather empty — auto-maintained by each prior change's own gate). Actual ratchet (config flips + fixup waves) deferred to separate waves after this plan.
commitSubject: docs(lint): plan the next ratchet notch (max-lines 250 + magic-literal policy) — deferred execution
