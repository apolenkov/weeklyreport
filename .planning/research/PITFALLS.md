# v6.0 Pitfalls — Roles, Quality, AI & Analytics

**Domain:** Adding 7 feature areas (A-G) to existing CustomReport (Next.js 16 + NestJS 11 + Prisma 7 + tRPC 11 + BullMQ 5).
**Researched:** 2026-04-26
**Scope:** Mistakes specific to THIS codebase. Generic advice excluded. Each pitfall ships with a detection signal, a prevention step (which phase task addresses it), and a guard (post-condition that proves prevention worked).
**Severity legend:** P0 = milestone-blocking / data-loss / security. P1 = ships broken UX or fails CI. P2 = papercut, drift, future-pain.

> **Reading order:** Section 0 (cross-cutting) first — those traps cut across A-G. Then per-feature sections.

---

## 0. Cross-Cutting Pitfalls

These are not unique to one feature area. Anyone touching v6.0 must keep them in mind.

### CC-1 — Phase 24 cookie-injection seam is the hinge for A, C, E (P0)

**What goes wrong:** Three v6.0 features need an authenticated browser/HTTP context to do their work — A removes `AUTH_DEV_MODE`, C calls Anthropic with per-user audit metadata, E renders email previews. Today the only seam acknowledging this is `apps/api/src/infrastructure/bullmq/pdf-export.processor.ts:69-72` (`TODO(Phase 24): inject session cookie via PdfExportService.buildAuthCookies + page.context().addCookies()`). If A is shipped without filling that seam, the PDF worker silently 401s the moment `AUTH_DEV_MODE=false`, and the job retries forever in BullMQ. v5.0 audit explicitly tagged this: "becomes mandatory only if AUTH_DEV_MODE is removed from worker context" (`v5.0-MILESTONE-AUDIT.md:120`).

**Detection signal:** Worker logs show `pdf-export job failed` with HTTP 401 / "Redirecting to /login" body. BullMQ Bull Board shows attempts climbing 1→3→5 with backoff. Job durations < 200 ms (worker never reaches `page.pdf()`).

**Prevention:** Phase A (Auth) plan must include a sub-task "Wire `PdfExportService.buildAuthCookies(token) + page.context().addCookies(...)` in `pdf-export.processor.ts:68`" with the same plan that flips `AUTH_DEV_MODE` off. Do not split.

**Guard:** Integration test in `apps/web/playwright.integration.config.ts` that asserts: with `AUTH_DEV_MODE=false`, head clicks Export PDF → `apps/api/storage/pdfs/{jobId}.pdf` exists within 30 s and is non-empty. Existing `pdf-export` integration spec already exists; un-skip and add the auth-required assertion.

---

### CC-2 — DEV_SESSION fallback removal must be staged, not switch-flipped (P0)

**What goes wrong:** `apps/api/src/infrastructure/trpc/trpc.context.ts` reads hardcoded UUIDs that must match `prisma/seed-constants.ts`. Existing pitfall #1 in `STATE.md`. v6.0 plan A says "real Keycloak SAML + role separation" — if someone deletes the DEV_SESSION branch in trpc.context.ts in the same commit that adds the SAML guard, every E2E spec that boots its own DB (Phase 26 `customreport_e2e`) breaks at first tRPC call, including the 21 integration tests we just got first-running on 2026-04-26. The pre-existing seed flow assumes DEV_SESSION; flipping it means rewriting the global-setup harness too.

**Detection signal:** Phase 26 integration suite suddenly drops from 8/21 pass to 0/21 with "Cannot read properties of null (reading 'userId')" or "UNAUTHORIZED" in the very first lead-journey test. `apps/web/.env.test` no longer enough.

**Prevention:** A-phase plan must add a `AUTH_DEV_MODE_ALLOW_TEST=true` switch — different env var, narrower scope, only honored when `NODE_ENV==='test'` AND request originates from Playwright's user-agent. Then, in a separate plan, migrate Phase 26 specs to do a real SAML stub login (mock IdP container in docker-compose.test.yml). Do not delete DEV_SESSION until the test harness no longer depends on it.

**Guard:** Add a test that runs `NODE_ENV=production AUTH_DEV_MODE=true pnpm --filter api start` and asserts startup fails with "AUTH_DEV_MODE refused outside test/dev" (configuration-time fence, not runtime check). Also, the original `customreport_e2e` integration suite must remain green through the A-phase transition — that's the canary.

---

### CC-3 — Type divergence is now compounding (P1)

**What goes wrong:** Pitfall #4 from `STATE.md`: "Type divergence is semantic — on-track vs green, computed states (pending/planned) need mapper logic." v5.0 added a mapper layer with 27 unit tests. v6.0 features C (AI summary input) and D (analytics aggregations) want to consume _historical_ data — but the mapper layer was designed for a single report's read/write path, not for cross-period aggregation. If the AI prompt or the chart aggregator imports raw Prisma types directly, the canonical-vs-presentation divergence reappears: `green` vs `on-track`, `null` (no data) vs `'empty'` (computed), etc.

**Detection signal:** New code in `apps/web/src/lib/analytics/*` or `apps/api/src/modules/ai/*` imports from `@prisma/client` or `@customreport/shared` directly without going through a mapper. ESLint can be taught to ban this — see Guard.

**Prevention:** Phase D and Phase C plans must each include "extend `packages/shared/src/mappers/` with `toAnalyticsRow()` / `toAiSummaryInput()` mappers" as the _first_ sub-task, before any feature code. Do not let chart code or prompt-builder code touch raw Prisma types.

**Guard:** ESLint rule `no-restricted-imports` for `apps/web/src/lib/analytics/**` and `apps/api/src/modules/ai/**` blocking direct imports of `@prisma/client` types — must funnel through `packages/shared/src/mappers/`. Lint must fail in CI if violated.

---

### CC-4 — BullMQ queue naming conflicts (P1)

**What goes wrong:** Today there is one BullMQ queue named `pdf-export` (see `pdf-export.processor.ts:29`). v6.0 adds two more queues: `email-reminder` (E) and `ai-summary` (C). If anyone reuses the `Worker` connection config inline-copied in each processor without extracting it (`{ host: process.env['REDIS_HOST'] ?? 'localhost', port: ..., maxRetriesPerRequest: null }`), three places drift apart. Worse — if a developer names the new queue `pdf-export-email` or `pdf-export-ai` (auto-completion suggesting), BullMQ silently picks up jobs from the wrong queue because BullMQ matches by exact name and the worker is generic.

**Detection signal:** AI summary job IDs appear in `pdf-export` Bull Board panel. Or: PDF export count drops because email worker steals jobs (would only happen on naming collision).

**Prevention:** Plan E and C each must add their queue name to a central `packages/shared/src/queue-names.ts` enum _first task_. All processors must import from there. Connection config extracted to `apps/api/src/infrastructure/bullmq/redis-connection.ts` and reused.

**Guard:** Static check — `grep -r "new Worker<" apps/api/src` returns ≤ 3 hits, all importing from `redis-connection.ts` and `queue-names.ts`. Add a `Bash` check in CI.

---

### CC-5 — React Compiler + new chart libs / streaming hooks (P1)

**What goes wrong:** Pitfall #2 from `STATE.md`: React Compiler breaks `@trpc/react-query` (we use `@trpc/tanstack-react-query` instead). v6.0 features D (charts) and C (streaming AI responses) will reach for libraries that may have similar incompatibilities — e.g. recharts uses `useMemo` patterns the compiler can break, or @anthropic-ai/sdk's `messages.stream()` returns an AsyncIterable that doesn't fit React Compiler's "stable on memoization-equal inputs" assumption.

**Detection signal:** `pnpm --filter @customreport/web build` warns about "babel-plugin-react-compiler bailing out of compilation for [component]". Or: charts re-render every keystroke; streamed tokens flicker.

**Prevention:** Each candidate library must be explicitly tested against React Compiler before being adopted. Plan D phase task: "Build smoke chart with [picked lib] inside the app and run `pnpm --filter web build` — confirm no `[bailout]` in output for chart components". Plan C: same for streaming.

**Guard:** CI step that runs Next.js build and greps for `react-compiler` bailout warnings, failing if any new file is in the bailout list. Establish baseline first (any current bailouts get an allow-list).

---

### CC-6 — Middleware collision: `proxy.ts` confusion (P0 specifically for B)

**What goes wrong:** v5.0 has TWO `proxy.ts` files — `apps/web/proxy.ts` (live, Next.js 16 reads this) and `apps/web/src/proxy.ts` (dead, listed in v6.0 task B for deletion). Phase 24 audit gap: "proxy.ts matcher with negative-lookahead+|-alternation matches every path in Next.js 16" was already closed via allowlist in `cc1a0ec`. If task B deletes the wrong file, auth completely breaks. If both files are kept after refactor, future-Claude will edit the dead one and wonder why nothing happens.

**Detection signal:** `apps/web/proxy.ts` deleted by mistake → Next.js dev server prints "no proxy detected, using built-in" and 401 redirects stop firing. Or: edits to `apps/web/src/proxy.ts` have zero observable effect.

**Prevention:** Plan B sub-task to delete dead `proxy.ts` must specify the exact path `apps/web/src/proxy.ts` (not `apps/web/proxy.ts`!) and run `pnpm --filter @customreport/web build && pnpm --filter @customreport/web test:e2e:integration -g auth-guards` immediately after as the deletion's guard. Add a comment to the live `apps/web/proxy.ts` saying "this is the active one — do NOT add a copy under src/".

**Guard:** Post-deletion: `find apps/web -name "proxy.ts"` returns exactly one path, `apps/web/proxy.ts`. Add to Plan B verification.

---

## 1. Theme A — Real Keycloak SAML + Roles + Cookie Injection

### A-1 — Role check missing at tRPC layer because middleware "already filtered" (P0)

**What goes wrong:** v5.0 has `protectedProcedure` and `headProcedure` in `apps/api/src/infrastructure/trpc/`. v6.0 adds `lead`, `head`, `admin`, `viewer`. Easy mistake: the new SAML middleware decodes role into JWT, sets it on `req.user.role`, and the tRPC procedure trusts it without re-checking. But one cron, one BullMQ context, one tRPC call from a test harness can bypass middleware entirely (see CC-2). Defense-in-depth requires every protected procedure to assert role at the tRPC layer.

**Detection signal:** A `viewer` user can call `weeklyReport.publish.mutate()` and it succeeds. Test: write a test that boots a session with role=viewer and expects UNAUTHORIZED on a head-only mutation.

**Prevention:** A-plan must define `roleProcedure(...allowedRoles: Role[])` factory in `apps/api/src/infrastructure/trpc/role-procedure.ts`, and every existing `headProcedure` callsite is migrated to `roleProcedure('head', 'admin')`. Compile-time enforcement: existing `headProcedure` is _removed_ from exports so old code can't call it.

**Guard:** Vitest contract suite — for every mutation in the router, exactly one allowed-role assertion test (e.g. `weeklyReport.publish` allows head/admin, denies lead/viewer with UNAUTHORIZED). Add a router-coverage test that lists all procedures and fails if any lacks role assertions.

---

### A-2 — Role missing from JWT payload → silent over-grant or over-block (P0)

**What goes wrong:** Keycloak SAML attribute mappings are configured in Keycloak admin UI. If the role attribute name is `roles` but the @node-saml profile reads `role`, `req.user.role` is `undefined`. Then either: (a) `roleProcedure` throws and _every_ user is blocked (over-block), or (b) someone defensively coded `if (!user.role || allowedRoles.includes(user.role))` and now `undefined` users are allowed (over-grant — silent privilege escalation).

**Detection signal:** Production log line `loggingMiddleware` shows `userId: 'xyz', role: undefined`. Or: a freshly-onboarded user can suddenly access admin tabs.

**Prevention:** A-plan adds Zod schema `SamlProfileSchema` in `packages/shared/src/auth/saml.ts` with `role: z.enum(['lead', 'head', 'admin', 'viewer'])` (NOT optional, NOT default). The SAML strategy parses the profile through this schema and _rejects login_ if role is missing or unrecognized. No fallback to a "default role".

**Guard:** Integration test in Phase A: stub IdP returns SAML response without role attribute → login endpoint returns 500 with `SAML profile missing required role attribute`. Add a metric/alarm on this error.

---

### A-3 — Cookie injection in PDF worker uses wrong domain/secure flags (P1)

**What goes wrong:** Once CC-1 is wired, `page.context().addCookies([{name: 'session', value: token, domain: 'localhost', ...}])` works in dev but breaks in prod where the cookie domain is `reports.example.com` and `secure: true` is required. The PDF worker fetches from `PDF_BASE_URL`, which is `localhost:3000` in dev but `https://reports.example.com:3000` in prod. Mismatched cookie domain → cookie not sent → tRPC 401.

**Detection signal:** PDF worker fetches `/reports/{id}/print` and the page renders the _login_ page (or empty data because tRPC returned `null` from `auth.me`). The PDF generates but contains no report content.

**Prevention:** A-plan adds `PdfExportService.buildAuthCookies(token, baseUrl)` that derives cookie domain/secure from `baseUrl` URL parsing. Unit-test with both dev and prod URL shapes.

**Guard:** Integration test that asserts the rendered PDF contains the report period text (e.g. `Period 2026-W17`) — not just that a non-empty file was written. v5.0 currently only verifies file existence, that's insufficient.

---

### A-4 — DEV_SESSION fallback in trpc.context.ts is the wrong "off" switch (P0)

**What goes wrong:** Naïve fix: delete the DEV_SESSION branch in `trpc.context.ts`. But `auth.me` is `publicProcedure` by design (see audit findings, D-24-01-A) — it deliberately returns `null` instead of throwing on unauthenticated requests so SessionProvider's first paint doesn't redirect-loop. If the DEV_SESSION fallback is in the wrong branch and is replaced by "throw UNAUTHORIZED" instead of "return null", the entire login page itself starts redirect-looping.

**Detection signal:** First-paint console error: "Maximum update depth exceeded" or repeated 401 in network tab on login page. Login page never renders.

**Prevention:** A-plan must explicitly call out `auth.me` semantics: returns `null` for unauthenticated, throws UNAUTHORIZED only for malformed sessions. The replacement of DEV_SESSION must preserve this. Code review checkpoint: "auth.me still uses `publicProcedure` and still returns null on no session."

**Guard:** Existing test file `apps/api/src/modules/auth/me.contract.test.ts` (or add it) — case "no cookie → returns null, NOT throws". Must remain green throughout phase A.

---

## 2. Theme B — Quality Polish (5 test fails, postinstall, dead proxy.ts)

### B-1 — Five test failures fixed individually instead of finding shared root cause (P1)

**What goes wrong:** v5.0 audit and `260426-vxp-SUMMARY.md` say: "5 fail (assertion-level timeouts on tRPC POST)" in Phase 26 first-run. Failure mode is consistent: assertion timeouts on POST. That's likely a shared pattern — autosave race, response interceptor matching wrong URL, or proxy.ts matcher gap. If someone fixes test #1 by upping the timeout, then test #2 by adding `await page.waitForLoadState('networkidle')`, then test #3 by mocking the response — they ship 5 different bandages over one root cause that resurfaces in every new spec.

**Detection signal:** First fix touches the test file, not a shared component or proxy.ts. Second fix touches a different test file but applies a similar workaround.

**Prevention:** B-plan task #1 is "Diagnose root cause of all 5 failures _before_ writing any fix." Spend a plan budget on triage. Hypothesis: all 5 are autosave debounce (3 s) racing the test's submit-then-assert-saved loop. If hypothesis confirmed, single fix is a `waitForAutosave()` test-helper or extending the autosave indicator's "Saved" lifecycle.

**Guard:** After B is done, fixes touch ≤ 2 source files (one shared helper, one test config) — NOT 5 separate test files. If the diff has 5 separate test-file edits, the root cause was missed.

---

### B-2 — `prisma generate` postinstall hook breaks CI (P1)

**What goes wrong:** v6.0 task B includes adding `prisma generate` postinstall. Postinstall runs in every `pnpm install` — including `pnpm install --frozen-lockfile` in CI before any env vars or `.env` exists. `prisma generate` itself works without DATABASE_URL (it only reads schema.prisma), but if the schema drifts and CI installs deps before the migration step, the generated client is stale. Also: postinstall runs in `node_modules/<dep>/postinstall`, which can fail noisily if a transitive dep also has postinstall and doesn't tolerate the project's prisma version.

**Detection signal:** CI fails with "Cannot find module '@prisma/client'" on a fresh runner. Or: postinstall logs warnings about peer-dep mismatches because pnpm's `onlyBuiltDependencies` allowlist is too narrow.

**Prevention:** B-plan must add `prisma` to `pnpm.onlyBuiltDependencies` (already used for other tools per CLAUDE.md). Idempotent script: `pnpm exec prisma generate --skip-generate-if-no-schema-change` (or check `node_modules/.prisma/client/index.d.ts` mtime). Postinstall is in `apps/api/package.json`, NOT root, so it doesn't run for `apps/web`-only installs.

**Guard:** `pnpm install --frozen-lockfile` on a fresh clone (no `.env`, no DB up) succeeds and produces working `@prisma/client` types. Add to CI as a separate "fresh-install" job.

---

### B-3 — Deleting `apps/web/src/proxy.ts` deletes the wrong proxy.ts (P0)

See **CC-6** above — same trap. Repeated here because it's specifically B's scope.

**Prevention specific to B:** Plan task says: "Delete `apps/web/src/proxy.ts` (the dead duplicate). Confirm `apps/web/proxy.ts` (the live one) still exists. Run `grep -r 'src/proxy' apps/web/` first to verify no imports."

**Guard:** Post-delete `find apps/web -name 'proxy.ts'` returns exactly `apps/web/proxy.ts`. CI integration suite still passes the `auth-guards` spec.

---

### B-4 — `weekly-report-page.test.tsx` fix masks a real Phase 23 PDF mock surface change (P2)

**What goes wrong:** HANDOFF.md and audit say 5 vitest failures in `weekly-report-page.test.tsx` are due to incomplete `pdfExport.request.mutationOptions` mock. Easy mistake: copy-paste the mutationOptions shape from another test, satisfy TypeScript, see green. But the actual API shape may have evolved post-Phase 23 in ways the test doesn't notice (e.g. job polling now expects `{ jobId, status, artifactUrl }` not `{ id, state, url }`).

**Detection signal:** The mock factory diverges from the real router's input/output Zod schema (which is the ground truth in `packages/shared`). If `appRouter.pdfExport.request._def.inputs[0]` differs from the mock's `mutationFn` signature, the mock is wrong.

**Prevention:** B-plan adds a helper `createTrpcMock(router)` that derives the mock from the real router types, not a hand-written factory. Or: import a typed mock from msw-trpc / similar that hits the actual router type definitions.

**Guard:** Mock factory uses `inferProcedureInput` / `inferProcedureOutput` from `@trpc/server`. A typecheck-only test asserts mock type is assignable to real procedure type. If router shape changes in C/D/E/F, vitest fails at typecheck not at runtime.

---

## 3. Theme C — AI Features (Auto-Summary, Sentiment, Smart On-Track)

### C-1 — Anthropic API called per-render, not per-content-change (P0 cost)

**What goes wrong:** Naïve mental model: "show summary in dashboard cell". Implementation puts a `useQuery({ queryFn: () => trpc.ai.summarize.query({ reportId }) })` inside the dashboard cell. Every page load = one Claude call. 6 leads × 50 dashboard loads/day × 4 weeks = 1200 calls/month for one team. At Sonnet pricing on a 5KB report, that's $50-100/month per team. Real cost is amplified because tRPC retries on error.

**Detection signal:** Anthropic console shows requests/day count climbing linearly with team activity, not with new-report submissions. Bull Board shows `ai-summary` job count > daily-submission count.

**Prevention:** C-plan creates `ai_summary` table with `(reportId, contentHash, summary, sentiment, generatedAt)` keyed on `contentHash = sha256(JSON.stringify(reportContent))`. Summary is generated _only_ when `contentHash` changes, not when read. tRPC `ai.summarize.query` is `cacheable: true` and returns cached row; only `ai.summarize.mutate` (head-only, BullMQ-queued) recomputes.

**Guard:** Integration test: load a report's dashboard 10 times → Anthropic mock is called exactly 1 time (or 0 if cached). Assert `ai_summary.generatedAt` does not advance on read.

---

### C-2 — LLM hallucinates traffic light counts (P0 trust)

**What goes wrong:** Naïve prompt: "Summarize this status report:" + JSON dump. Claude writes "5 projects are on track, 2 at risk" when the actual numbers are 7 and 1. Once the head reads "5 on track" in the AI summary, the trust is broken for the entire feature.

**Detection signal:** LLM output contains digits that don't match `count(projectStatuses where status='green')`. Manual smoke would catch but can be tested too.

**Prevention:** C-plan structures the prompt to pass _pre-computed numbers_ in the system prompt: "There are 7 on-track, 1 at-risk, 0 blocked projects. Write a 2-paragraph narrative explaining the trends — DO NOT change these numbers." Use Anthropic's structured output or a Zod-parsed response shape: `{ narrative: string, riskTone: 'positive'|'neutral'|'negative' }` — narrative is free-text, but tone and numbers are not LLM-decided.

**Guard:** Vitest contract — fixture report with 7G/1Y/0R, run summarizer, assert output narrative contains "7" if it contains any green-count digit, OR contains no digits referring to status counts (regex). Run on 5 golden fixtures (see C-5).

---

### C-3 — PII / confidential text in prompts logged or sent to wrong LLM (P0 security)

**What goes wrong:** Risks/decisions text from `Risk[].risk`, `Decision[].text` may contain client names, deal sizes, pre-disclosure financials. Today logs are JSON-rotated to `apps/api/storage/logs/` per Phase 25. If the AI module logs prompt+response (typical debug habit), confidential text lands in plaintext on disk forever. Compounding: if the org runs LiteLLM proxy or similar, prompts can be routed to a non-Anthropic LLM with different privacy guarantees.

**Detection signal:** `grep -r 'risk' apps/api/storage/logs/ | head -5` reveals risk text. Or: Anthropic dashboard shows requests but Anthropic's "data deletion" toggle isn't on, and an org-policy review flags it.

**Prevention:** C-plan adds a `redactForLogs(prompt: string): string` that masks any field originating from `Risk.risk`, `Decision.text`, `Risk.mitigation`, `Decision.impact`. AppLoggerImpl's tRPC middleware (Phase 25) gets an opt-out: `loggingMiddleware({ exclude: ['ai.summarize'] })`. Anthropic API key in `process.env['ANTHROPIC_API_KEY']` only — no client-side calls. Confirm Anthropic data retention setting is "do not train on data" in console.

**Guard:** Test: trigger an AI summary, then `grep -c 'CONFIDENTIAL' apps/api/storage/logs/*.log` returns 0 (use a known sentinel string in the test fixture risk text). Lint rule: `no-console-log` extended to ban `console.log` or `logger.*` of variables named `prompt`, `messages`, `response.content` in `apps/api/src/modules/ai/`.

---

### C-4 — Synchronous tRPC summarize call blocks UI (P1 UX)

**What goes wrong:** User clicks "Generate AI Summary", tRPC mutation hits Anthropic, takes 3-15 seconds, UI is frozen, user clicks again, retry, two parallel jobs. Existing pdf-export pattern (Phase 23) already showed this — request → poll → display. New devs may forget and inline the call.

**Detection signal:** Lighthouse / dev-tools: long-task warnings on AI mutation. User-perceived: button shows spinner > 3 seconds.

**Prevention:** C-plan mandates BullMQ queue `ai-summary` mirroring `pdf-export` shape: `request → returns jobId immediately → poll status → render when ready`. Reuse `ExportPdfButton` polling pattern. _Streaming_ (Anthropic supports SSE) is a _progressive enhancement_ on top — initial release ships polling.

**Guard:** Network tab shows request → 200 in <500 ms with `{jobId}` body, then 2-second polling until completion. No request takes >1 s in the synchronous path.

---

### C-5 — No regression eval suite — quality drifts silently (P1)

**What goes wrong:** Anthropic releases a new model, we bump the version, summaries get worse on edge cases (very short reports, all-red status, Russian text). No way to detect drift other than a head complaining months later.

**Detection signal:** No CI step that exercises the LLM. Model upgrade PR lands without any quality check.

**Prevention:** C-plan ships a `golden-set/` directory with 8-12 fixture reports covering: all-green, all-red, mixed, 1 lead missing, Russian text, short text (<100 words), long text (>5000 words), risks-only, decisions-only. `pnpm --filter api test:ai-eval` runs the summarizer over each, scores against rubric (factual accuracy via the C-2 number check, length, language matching input language, no PII leak).

**Guard:** CI step `test:ai-eval` runs on every PR touching `apps/api/src/modules/ai/`. Skipped on other PRs (cost). Score below threshold = PR blocked.

---

### C-6 — Anthropic rate-limit storms after a deploy (P1)

**What goes wrong:** First deploy after AI feature ships, the BullMQ queue is empty. Then 6 leads hit submit on Friday afternoon, plus head opens dashboard for all 5 weekly reports = 11 Anthropic calls in 30 seconds. If org is on free/scale tier, 429 storms. BullMQ retries multiplies the storm.

**Detection signal:** BullMQ Bull Board shows `ai-summary` queue: 30 attempts, 25 failed, 5 succeeded. Anthropic error log: "Rate limit exceeded".

**Prevention:** C-plan configures BullMQ queue with `limiter: { max: 5, duration: 60000 }` (5 per minute). Anthropic SDK with exponential backoff (built-in via `@anthropic-ai/sdk` retry config). Job priority: head's "regenerate all" is lower priority than lead's submit-trigger.

**Guard:** Load test: queue 50 jobs in 1 second, observe Bull Board — no failures, just delayed completions over 10 minutes. Add a scripted check.

---

## 4. Theme D — Trend Analytics

### D-1 — Aggregation queries hit Report→Section→ProjectStatus full join (P0 perf)

**What goes wrong:** "Show traffic light history for project X over last 12 weeks" → naïve SQL fetches all reports, all sections, all project statuses, joins client-side. With 50 weeks × 6 leads × 12 projects = 3600 rows, response is ~500ms. At 2 years history, 31200 rows, 2-5 seconds. Dashboard becomes unusable. Pitfall #4 in v5.0 STATE.md ("type divergence is semantic") gets worse here because client-side joining with mappers compounds the cost.

**Detection signal:** `pnpm --filter api test:perf:analytics` (or manual benchmark) shows `>500ms` for the analytics query. PostgreSQL `pg_stat_statements` shows the analytics query in top 5 by total time.

**Prevention:** D-plan adds composite indexes on `(reportId, projectId)` for ProjectStatus, and a server-side aggregate procedure: `analytics.projectHistory.query({ projectId, from, to })` that does the rollup in SQL using `GROUP BY period_id`. Mapper layer (CC-3) handles the row-to-presentation translation. _No materialized view in MVP_ — premature; just ensure indexes + server-side aggregation.

**Guard:** Vitest perf test: 2 years of seeded data (use a fixture loader), `analytics.projectHistory.query` returns in <200ms p95. Run in CI on an isolated postgres instance.

---

### D-2 — Date timezone drift (server UTC, client local) → off-by-one weeks (P0 correctness)

**What goes wrong:** Period.start is stored as `DateTime` in Prisma. Server is UTC. Client renders with `new Date(period.start).toLocaleDateString()` → in Moscow (UTC+3) the period starting "2026-04-20T00:00:00Z" shows as "2026-04-20" but a period starting "2026-04-20T22:00:00Z" shows as "2026-04-21". Charts label x-axis with these client-side dates → adjacent weeks merge or split incorrectly. Hydration also mismatches (server renders one date, client another).

**Detection signal:** `console.error: Hydration failed because server-rendered HTML didn't match client.` Or: chart x-axis shows two ticks for the same period (one server-rendered, one client-rendered).

**Prevention:** D-plan: all dates in tRPC responses are ISO date-only strings (`YYYY-MM-DD`), not Date objects. Mapper (CC-3) does this conversion. Charts label x-axis with these strings, no `new Date()` on client. Server computes "week label" (e.g. `2026-W17`) and sends that as a pre-formatted string. Force `Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' })` everywhere periods are rendered.

**Guard:** Snapshot test for the analytics chart with `TZ=Europe/Moscow vitest run` — output identical to `TZ=UTC vitest run`. Hydration warning grep against Next.js dev server logs in integration test.

---

### D-3 — Chart library uses canvas/SSR breaks Next.js 16 build (P1)

**What goes wrong:** Recharts works server-side except for some hooks. Chart.js uses canvas → must be `'use client'` only, fails SSR if imported in a server component. Visx is SVG-native but heavy. With Next.js 16's React Compiler + Turbopack, some chart libs have known issues (e.g. d3 with Compiler).

**Detection signal:** `pnpm --filter web build` fails with "ReferenceError: window is not defined" or "document is not defined". Or: page renders blank chart on first paint, then chart appears after hydration.

**Prevention:** D-plan picks chart lib _first_ (recharts is current 2026 default for shadcn ecosystems — verify via shadcn-charts which uses recharts). Pin import: `import { LineChart } from 'recharts'` inside a `'use client'` component, NEVER from a server component. Provide a server-safe skeleton.

**Guard:** Build smoke test: `pnpm --filter web build` succeeds. Production build serves chart page → first paint is skeleton, hydration → chart appears, no console error. Add to integration spec.

---

### D-4 — Missing-data semantics: zeros vs gaps mislead viewer (P1 correctness)

**What goes wrong:** Lead Sergei skipped weeks 12 and 14 (sick). Naïve query LEFT JOINs and fills missing with 0. Chart shows traffic-light-count "0" for those weeks → looks like all projects went _neutral_, which is meaningless. Viewer infers "everything cleared up those weeks!" — wrong.

**Detection signal:** Chart renders a flat-line of zeros for periods where ProjectStatus rows don't exist. Period dropdown shows the period but ProjectStatus.count(\*) is 0.

**Prevention:** D-plan: aggregator returns `{ period, value: number | null }`. Chart lib's `connectNulls={false}` and renders gaps. Add a "missing data" legend entry. Distinguish "0 risks reported" (zero data) from "lead didn't submit" (no data) at the SQL level — `LEFT JOIN report_section ON ... WHERE status='submitted'` so the absence is detectable.

**Guard:** Snapshot test: fixture has period with no submission → chart shows gap, not zero. Tooltip on a missing period reads "No submission" not "0".

---

## 5. Theme E — Email Reminders

### E-1 — Idempotency key collision after BullMQ retry (P0)

**What goes wrong:** v1.0 / v2.0 already shipped email reminders (per PROJECT.md "✓ Head: carry-over, email reminders — v1.0-v2.0"). v6.0 task E says "extend, not duplicate". If new code adds a second `email-reminder` queue or a duplicate cron, two reminders ship for the same deadline. Worse — if BullMQ retry on transient SMTP error doesn't dedup, lead receives 3 emails for one missed deadline.

**Detection signal:** Same lead receives N>1 reminder emails for one period. Bull Board shows multiple jobs with `jobId=reminder:{periodId}:{userId}` (or whatever the existing key shape is).

**Prevention:** E-plan first task: read existing reminder code (`apps/api/src/modules/reminder/*` or `apps/api/src/infrastructure/bullmq/*`), document the existing idempotency key shape, extend it. New job names `email-reminder-deadline` and `email-reminder-escalation` with `jobId: \`${kind}:${periodId}:${userId}\`` to use BullMQ's built-in dedup (`removeOnComplete`/`removeOnFail` + named jobId).

**Guard:** Integration test: trigger reminder for a period, simulate SMTP transient failure (wrong port, retry), assert exactly 1 email captured by mock SMTP. Test idempotency by triggering the cron twice in 1 second — still 1 email.

---

### E-2 — Off-hours sending (3am Moscow time annoys users) (P1)

**What goes wrong:** Cron is set to `0 9 * * *` (9am server time). Server is UTC. 9am UTC = 12pm Moscow but most reminders are tied to deadlines, not absolute times. If a deadline cron fires at 9am UTC = 6am Yekaterinburg, leads in eastern offices wake up to email already in their inbox before they've started work — annoyance grows.

**Detection signal:** User feedback / one-off complaint. No automated detection unless we add a `sentAt` log + correlate against User.timezone.

**Prevention:** E-plan adds `User.timezone` (default `'Europe/Moscow'` since corp is Moscow-based) and the reminder cron computes per-user "next 9am-12pm in that user's TZ" send slot. BullMQ supports `delay` and `runAt` for scheduled jobs. Fallback: skip reminder if deadline already passed in user's TZ (escalation only).

**Guard:** Unit test on the slot-computation function: input `now=2026-04-26T20:00Z, userTz='Asia/Yekaterinburg', deadline=2026-04-26T23:59:59+05'` → output: send at next 9am Yekaterinburg = `2026-04-27T04:00Z`. Verify with multiple TZ fixtures.

---

### E-3 — SMTP rate limit / corporate quota (P1)

**What goes wrong:** Corporate SMTP server has a per-minute quota (often 30/min). When deadline reminders + escalations + daily digests stack, a single cron tick fires 50 emails → SMTP refuses #31+ → BullMQ retries → cascade.

**Detection signal:** SMTP error code 421 / 451 / 4.7.0 in worker logs. Bull Board failed-job count rising during cron tick windows.

**Prevention:** E-plan configures BullMQ limiter on `email-reminder` queue: `limiter: { max: 20, duration: 60000 }`. Rate is _below_ SMTP quota by 30%. SMTP transport reuses connection (nodemailer pool) instead of opening per-message. Monitor SMTP timing.

**Guard:** Load test: queue 100 reminders → all delivered without 4xx errors, total time ≥ 5 minutes due to throttle. Mock SMTP that rejects > 25/min — verify our limiter never hits this.

---

## 6. Theme F — Mobile Polish

### F-1 — Existing 7 pages assume desktop layout (sticky sidebars, fixed-width tables) (P1)

**What goes wrong:** v4.0 shipped "7 frontend pages with Starbucks design system". v5.0 shipped admin tabs and weekly-report flows. None had mobile-first audits. Sticky sidebars likely overlap content < 768px. Fixed-width tables overflow horizontally with no scroll affordance.

**Detection signal:** DevTools mobile emulation (iPhone 12 / 390 px wide): horizontal scrollbar appears, sticky elements clip, click targets blocked.

**Prevention:** F-plan starts with "Mobile audit pass" — Playwright responsive screenshots at 390 px, 768 px, 1024 px for each of 7+ key pages. Catalog every issue before fixing. Then systematic fixes — `<table>` → `<div role="table">` with `overflow-x-auto` wrapper; sticky elements `sticky md:sticky` (only on desktop+).

**Guard:** Playwright visual-regression suite: 7 pages × 3 viewports = 21 screenshots committed as baseline. PRs that change layout must update baselines explicitly. Add to integration config (separate `playwright.mobile.config.ts`).

---

### F-2 — Touch targets under 44 px violate accessibility (P1)

**What goes wrong:** shadcn/ui default `Button` has min-height 36 px (`h-9`). On mobile, Apple's HIG and Material both want 44 px tap targets. Status chip clicks (the at-risk → empty risk row from SYNC-01) are even smaller — likely 28-32 px.

**Detection signal:** Lighthouse mobile audit fails "Tap targets are not sized appropriately." Automated axe-core check.

**Prevention:** F-plan adds a `min-h-11 md:min-h-9` (44 px mobile, 36 px desktop) modifier to button variants in `packages/ui`. Status chips get explicit padding.

**Guard:** axe-core a11y check in Playwright integration suite — fails on any tap target < 44px in mobile viewport.

---

### F-3 — PDF preview useless on mobile viewport (P2 UX)

**What goes wrong:** PDF is 8.5×11" rendered at 96 dpi = 816×1056 px source. On a 390 px wide screen, the PDF iframe shrinks text to ~2 px — unreadable. Users zoom and pan, can't read. Or worse, iframe doesn't render at all on iOS Safari with `<embed>` tags.

**Detection signal:** Real device test or DevTools — PDF iframe shows but text is unreadable. User feedback "I can't read the PDF on phone."

**Prevention:** F-plan: detect mobile viewport (`window.matchMedia('(max-width: 768px)')`); show "Download PDF (3.2 MB)" button instead of inline iframe. Inline iframe only on `md+`. Acceptable degradation for v6.0.

**Guard:** Playwright mobile spec: navigate to `/reports/{id}/pdf`, assert no `<iframe>` rendered, assert "Download PDF" button visible. Desktop spec: opposite.

---

## 7. Theme G — Release Checklist

### G-1 — Stale checklist drift (committed once, never updated) (P1)

**What goes wrong:** A committed `RELEASE-CHECKLIST.md` becomes a museum piece. New phases add deliverables that aren't in the checklist; old checklist items remain after the underlying step is automated. Within 2 milestones, the checklist no longer reflects reality and is mechanically rubber-stamped.

**Detection signal:** Git blame on the checklist shows last meaningful update >2 milestones ago. PR adds new code but doesn't touch the checklist.

**Prevention:** G-plan does NOT commit a static checklist. Instead, generate it at milestone-end from VERIFICATION.md frontmatter (each phase's `gaps:` and `human_verify:` items become checklist items automatically). Build a `pnpm gsd:checklist` script that scans `.planning/phases/*/VERIFICATION.md` and emits `RELEASE-CHECKLIST.md` from current state.

**Guard:** Pre-tag CI step: regenerate checklist, `git diff --exit-code RELEASE-CHECKLIST.md` — if drift, milestone-complete is blocked. Forces author to address gaps before tagging.

---

### G-2 — Checklist becomes rubber-stamp ritual (P1)

**What goes wrong:** Checklist has 30 items, all checked manually before tag. Once anyone checks 28/30 and the user wants to ship, the remaining 2 get checked without verification. v5.0 itself tagged with 4 unverified items per audit — exact symptom.

**Detection signal:** v5.0 audit showed status: `tech_debt — runtime verification deferred per user`. That's the canonical example.

**Prevention:** G-plan ties at least 3 checklist items to _machine_ gates (CI checks, test commands), not human checkboxes. E.g. "Phase 26 integration suite green" must be `pnpm test:e2e:integration` exit 0, not a checkbox. "Audit gaps closed" must be `gsd:audit` showing 0 gaps_found, not a checkbox.

**Guard:** Tag-creation script `gsd:complete-milestone` refuses to tag if any machine-gated item is unconfirmed. Human-checked items are clearly marked `[manual]` to disambiguate from `[CI-gated]`.

---

## 8. Severity & Phase-Plan Map

| ID   | Severity | Theme         | Plan task that addresses it                                             |
| ---- | -------- | ------------- | ----------------------------------------------------------------------- |
| CC-1 | P0       | A (also C, E) | A-plan: cookie injection sub-task in same plan as AUTH_DEV_MODE removal |
| CC-2 | P0       | A             | A-plan: AUTH_DEV_MODE_ALLOW_TEST switch + staged migration              |
| CC-3 | P1       | C, D          | C and D plans: extend mappers as first sub-task                         |
| CC-4 | P1       | C, E          | E-plan and C-plan: add queue name + connection extract first            |
| CC-5 | P1       | C, D          | C-plan and D-plan: react-compiler smoke before adopting                 |
| CC-6 | P0       | B             | B-plan: explicit path for proxy.ts deletion                             |
| A-1  | P0       | A             | A-plan: `roleProcedure` factory replaces `headProcedure`                |
| A-2  | P0       | A             | A-plan: `SamlProfileSchema` requires role                               |
| A-3  | P1       | A             | A-plan: `buildAuthCookies(token, baseUrl)`                              |
| A-4  | P0       | A             | A-plan: preserve auth.me publicProcedure semantics                      |
| B-1  | P1       | B             | B-plan: triage before fix                                               |
| B-2  | P1       | B             | B-plan: postinstall in apps/api only, not root                          |
| B-3  | P0       | B             | B-plan: explicit `apps/web/src/proxy.ts` path                           |
| B-4  | P2       | B             | B-plan: derive mock from router types                                   |
| C-1  | P0       | C             | C-plan: `ai_summary` cache table on contentHash                         |
| C-2  | P0       | C             | C-plan: pre-compute numbers in prompt                                   |
| C-3  | P0       | C             | C-plan: redactForLogs + Anthropic data setting                          |
| C-4  | P1       | C             | C-plan: BullMQ `ai-summary` queue with polling                          |
| C-5  | P1       | C             | C-plan: `golden-set/` + `test:ai-eval`                                  |
| C-6  | P1       | C             | C-plan: BullMQ limiter + Anthropic backoff                              |
| D-1  | P0       | D             | D-plan: server-side aggregate + indexes                                 |
| D-2  | P0       | D             | D-plan: ISO date strings via mapper                                     |
| D-3  | P1       | D             | D-plan: chart lib smoke against React Compiler                          |
| D-4  | P1       | D             | D-plan: null vs zero in aggregator                                      |
| E-1  | P0       | E             | E-plan: read existing reminder code first; extend dedup key             |
| E-2  | P1       | E             | E-plan: User.timezone + per-TZ slot                                     |
| E-3  | P1       | E             | E-plan: BullMQ limiter < SMTP quota                                     |
| F-1  | P1       | F             | F-plan: audit-first systematic fix                                      |
| F-2  | P1       | F             | F-plan: `min-h-11 md:min-h-9` + axe                                     |
| F-3  | P2       | F             | F-plan: download-only on mobile                                         |
| G-1  | P1       | G             | G-plan: generated checklist                                             |
| G-2  | P1       | G             | G-plan: machine-gated items                                             |

**P0 count:** 11 (5 cross-cutting, 4 A-specific, 1 B, 3 C, 2 D, 1 E)
**P1 count:** 17
**P2 count:** 2

---

## 9. Sources

- `.planning/PROJECT.md` (v5.0 shipped state, v6.0 scope)
- `.planning/STATE.md` (Critical Pitfalls 1-4)
- `.planning/v5.0-MILESTONE-AUDIT.md` (tech_debt list, deferred items)
- `HANDOFF.md` (v5.0 tech debt with file paths)
- `apps/api/src/infrastructure/bullmq/pdf-export.processor.ts:69-72` (TODO Phase 24 cookie seam)
- `apps/web/proxy.ts` (live) + `apps/web/src/proxy.ts` (dead duplicate confirmed via filesystem)
- `apps/web/src/app/(app)/layout.tsx` (auth.me semantics doc-comment)
- `CLAUDE.md` (security defaults, performance targets, breaking changes Next.js 15→16, Prisma 6→7)
- `260426-vxp-SUMMARY.md` reference in HANDOFF / STATE — 5 integration test failures with shared symptom

**Confidence levels:**

| Area                     | Level       | Reason                                                                                                                               |
| ------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| CC-1, CC-2, CC-6, A-1..4 | HIGH        | Direct quotes from audit + grep-confirmed file states                                                                                |
| B-1..4                   | HIGH        | Audit lists exact failure modes; codebase grep confirms file paths                                                                   |
| C-1..6                   | MEDIUM      | Anthropic API behaviour from training data + 2026 best practices; BullMQ pattern verified against existing pdf-export processor      |
| D-1..4                   | MEDIUM      | PostgreSQL/Prisma performance characteristics standard; chart lib SSR is well-known Next.js issue                                    |
| E-1..3                   | MEDIUM      | "Email reminders shipped v1.0-v2.0" per PROJECT.md — exact existing dedup key shape needs to be read in plan-time, not research-time |
| F-1..3                   | MEDIUM-HIGH | a11y/touch-target standards are stable; mobile audit pattern is mainstream                                                           |
| G-1..2                   | HIGH        | v5.0 itself shipped with `tech_debt` status — direct evidence of G-2 happening                                                       |

**Gaps to address in plan-time, not research-time:**

- E-1 needs reading existing reminder code (couldn't do exhaustively here without exceeding research scope)
- C-5 golden set needs domain expert (the head/Barkhanov) to validate the rubric
- F-1 mobile audit baseline screenshots need a real device pass after first cut
