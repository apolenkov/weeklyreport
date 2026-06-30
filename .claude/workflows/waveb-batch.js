export const meta = {
  name: "waveb-batch",
  description:
    "Implement ONE group of seam-DISJOINT low-stakes OpenSpec changes in PARALLEL on the shared tree (edit-only agents, no toolchain), then ONE combined gate, then per-change adversarial verify + Codex (fan-out), then commit each fully-green change separately. Toolchain-safe parallelism: only the agents' file edits run concurrently; db:generate/typecheck/lint/tests run once, serialized, in the single gate.",
  phases: [
    { title: "Preflight" },
    { title: "Implement" },
    { title: "Gate" },
    { title: "Verify" },
    { title: "Commit" },
  ],
};

const REPO = "/home/user/work/customreport";
const BASE = "chore/exemplary-code-standard";

const STANDARDS = [
  "Exemplary code standard: functional/immutable (const, pure fns, map/filter/reduce + spread; avoid let/mutation); files < 250 lines; functions <= 50 lines; cognitive complexity < 10.",
  'NO fallbacks / silent defaults for product config (no `?? "localhost"`, no `.default()` in env.schema). Mandatory vars are REQUIRED (Zod, no default) read via requireEnv; boot fails loud. THIS STANDARD OVERRIDES any change design.md that proposes a `.default()` or in-code fallback — reconcile to requireEnv + compose `${VAR:?}` in compose files.',
  "UI strings in apps/web/**/*.tsx stay English (JSX/toast/aria/placeholder). Russian only in DB/seed data, comments, test fixtures.",
  "Comment hygiene: NO ticket/phase/change-slug prefixes in comments. Explain the WHY of current code only; never narrate what the code already says.",
  "Strict lint rules are ERRORS: require-await, no-unnecessary-condition, prefer-string-raw, jsdoc-on-private-helper, x-powered-by. Changed paths MUST pass `eslint --max-warnings 0`.",
  "Reuse canonical helpers (e.g. groupScopeFilter from apps/api/src/lib/group-scope.ts). tRPC procedures MUST use one of the 9 canonical middleware-chain builders (matched by reference identity) — never hand-roll a chain.",
  "Period dual-state invariant: a Report write updates BOTH the new period state AND the legacy period tuple, atomically.",
];

// ---------------------------------------------------------------------------------------
// CONFIG: ONE group of disjoint low-stakes changes. Every change here MUST have a file set
// disjoint from every other (no shared modified source file) — that is what makes the
// parallel implement safe. A set of changes that SHARE a file must be expressed as ONE
// change entry whose agent implements them sequentially (bundle), not as two parallel
// entries. Fill `files` and `testFiles` precisely; the commit stages ONLY these paths.
const GROUP = [
  {
    name: "fix-analytics-date-matching",
    files: [
      "packages/shared/src/schemas/analytics.ts",
      "apps/api/src/modules/analytics/analytics.prisma-repository.ts",
      "apps/api/src/modules/analytics/analytics.service.ts",
    ],
    testFiles: [
      "apps/api/src/modules/analytics/analytics.prisma-repository.test.ts",
      "apps/api/src/modules/analytics/analytics.tz.test.ts",
      "apps/api/src/modules/analytics/analytics.scope.integration.test.ts",
      "packages/shared/src/schemas/analytics.test.ts",
    ],
    spec: { dir: true },
    seam: "Add startOfUtcDay/nextUtcDay helpers in analytics.prisma-repository.ts. Replace periodComparison's `periodEnd: new Date(x)` exact match with a half-open {gte:startOfUtcDay, lt:nextUtcDay}; change trafficLightHistory + leadVelocity upper bound to lt:nextUtcDay(periodTo). Aggregate ALL reports per date-label (Map<label,Report[]>) instead of reports.find first-only, tie-break latest periodEnd then latest createdAt. Add a .refine real-date check to isoDateOnly in packages/shared analytics.ts. Bump the analytics cache PREFIX_HISTORY/VELOCITY/COMPARISON keys (analytics.service.ts) with a :v2: segment, staying under the customreport:analytics: root.",
    caveat:
      "A mocked-Prisma unit test asserting WHERE args is self-referential — prove day-range matching against real Postgres (analytics.scope.integration.test.ts). Does NOT add group scoping (scope-analytics-to-group) and does NOT change Report storage tz. Preserve the published floor + projectId/leadId filters.",
    mustCover: [
      "periodComparison returns non-empty rows for a stored periodEnd with a non-midnight time",
      "trafficLightHistory/leadVelocity include a report on the periodTo day (inclusive upper bound via lt:nextUtcDay)",
      "two reports under one date-label BOTH contribute statuses; tie-break deterministic across two runs",
      "risk counts SUM across multiple reports mapped to one comparison side",
      "isoDateOnly rejects 2026-02-30 / 2026-13-45 / Invalid Date, accepts a real date",
    ],
    reachability:
      "Does the half-open {gte,lt} range actually match a row stored at 2026-06-26T17:00:00Z when queried by label 2026-06-26 — proven against real Postgres, not a stubbed repo?",
    regression:
      "Did per-label aggregation change the single-report-per-label output for existing seed data (the common case must stay byte-identical)?",
    integrationTargets:
      "analytics.scope.integration.test.ts (real-DB day-range + aggregation)",
    needsIntegration: true,
    commitSubject:
      "fix(analytics): match periods by UTC day-range and aggregate all reports per label",
  },
  {
    name: "fix-reminders-escalation-dedupe",
    files: [
      "apps/api/src/modules/reminders/reminders.prisma-repository.ts",
      "apps/api/src/modules/reminders/reminders.service.ts",
      "apps/api/src/modules/reminders/reminders.scheduler.ts",
    ],
    testFiles: [
      "apps/api/src/modules/reminders/reminders.integration.test.ts",
      "apps/api/src/modules/reminders/reminders.dedupe-key.test.ts",
      "apps/api/src/modules/reminders/reminders.scheduler.test.ts",
      "apps/api/src/modules/reminders/reminders.service.test.ts",
    ],
    spec: { dir: true },
    seam: "Resolve the escalation recipient by ReportingGroup.headUserId (role head|admin, isActive=true) joined from each late lead's author — NOT report.publishedBy; group late leads by group head, emit one DueEscalationRule-equiv per (rule, head). Add an atomic insert-on-conflict repo method returning {execution, inserted:boolean}; in requestReminderExecution replace findExecutionByDedupeKey+saveExecution with it and gate emailQueue.add('send') on inserted===true, AFTER the row commits. Both repo/service interfaces live INSIDE the listed files.",
    caveat:
      "PG-ADAPTER P2002 SHAPE: under the pg driver adapter a real P2002 leaves meta.target UNSET — match the conflict on driverAdapterError.cause.originalMessage / message (mirror PolicyApplicatorService.applyToPeriod), NEVER on meta.target alone; catch P2002 narrowly on dedupeKey and rethrow other codes. No schema/migration (dedupeKey @unique already exists). No module edit.",
    mustCover: [
      "escalation fires for an UNPUBLISHED period (publishedBy=null, sections draft) -> targets the late lead's group head",
      "admin-role head (role=admin) NOT dropped; deactivated head (isActive=false) logged+skipped, others still dispatch",
      "head-less group: logged, no digest, other groups still dispatched, never throws",
      "two concurrent requestReminderExecution with the same dedupeKey -> exactly ONE row AND exactly ONE send job",
      "a deduplicated (existing key) call returns the existing row and enqueues nothing",
    ],
    reachability:
      "With the head-role join, can a real late-lead-in-draft chain resolve to an active head and produce a digest where publishedBy was null — proven against a seeded real DB?",
    regression:
      "Does retiring findExecutionByDedupeKey from the dispatch path leave any other live caller (grep) broken?",
    integrationTargets:
      "reminders.integration.test.ts (real-DB concurrent-P2002 dedupe + head-role escalation)",
    needsIntegration: true,
    commitSubject:
      "fix(reminders): resolve escalation by head role and dedupe execution atomically",
  },
  {
    name: "harden-web-vitals-endpoint",
    files: [
      "apps/api/src/modules/observability/web-vitals.controller.ts",
      "apps/api/src/infrastructure/metrics/web-vitals.metrics.ts",
      "apps/api/src/infrastructure/throttler/rate-limit.middleware.ts",
      "apps/api/src/main.ts",
      "packages/shared/src/schemas/web-vitals.ts",
      "packages/shared/src/index.ts",
    ],
    testFiles: [
      "apps/api/src/modules/observability/web-vitals.controller.test.ts",
      "apps/api/src/infrastructure/throttler/rate-limit.middleware.test.ts",
    ],
    spec: { dir: true },
    seam: "New shared Zod webVitalBeaconSchema (name enum LCP/CLS/FCP/INP/TTFB, finite value, non-empty id, optional navigationType) + a nav whitelist set with an 'other' fallback. Controller: safeParse -> 400 on fail (BadRequestException, never 500); map navigationType through the whitelist to 'other'; histogram.observe(value). web-vitals.metrics.ts: swap each Gauge for a Histogram with per-vital buckets (same metric names + navigation_type label). rate-limit.middleware.ts: extend createRateLimits to ALSO return vitalsLimiter (moderate per-IP/min, isTest bump, rateLimitHitsTotal accounting); main.ts mounts it on /api/web-vitals.",
    caveat:
      "metrics.controller.ts and metrics.registry.ts are NOT touched (web-vitals.metrics.ts self-registers). observability.module.ts already registers WebVitalsController — no module edit. Per-IP throttling depends on set-express-trust-proxy; if absent, document the vitals limiter as a global-bucket stopgap, do not assert per-IP. English-only. Reuse Zod (no class-validator). Place the schema at packages/shared/src/schemas/web-vitals.ts and add its export to index.ts.",
    mustCover: [
      "well-formed body -> 2xx and histogram records; missing/non-numeric value -> 400, nothing recorded, NO 500",
      "unknown name -> 400; unrecognised AND absent navigationType both record under navigation_type='other'; recognised value verbatim",
      "repeated observe accumulates into histogram count/sum (distribution, not last-write-wins)",
      "traffic over the vitals budget -> 429 and increments rateLimitHitsTotal for the vitals bucket",
      "the new schema is exported from @customreport/shared and consumed by the controller (single source of truth)",
    ],
    reachability:
      "Can a malformed beacon (missing value) reach the metric write, or is it rejected at safeParse before any observe/label is created?",
    regression:
      "Do existing consumers of web_vital_* break when the series flips gauge->histogram (acceptable per MVP, but note it)?",
    integrationTargets: "none (unit only)",
    needsIntegration: false,
    commitSubject:
      "fix(observability): validate, bound-label, histogram, and rate-limit the web-vitals beacon",
  },
  {
    name: "guard-metrics-scrape-db-failure",
    files: ["apps/api/src/modules/telemetry/telemetry.gauges.ts"],
    testFiles: ["apps/api/src/modules/telemetry/telemetry.gauges.test.ts"],
    spec: { dir: true },
    seam: "Add `private readonly logger = new Logger(TelemetryGauges.name)` as a class-field initializer (no constructor change). Wrap each Prisma await inside the two collect callbacks (onTimeRatioLastNPeriods(4) and activeLeadsLastPublishedPeriod()) in try/catch; on catch logger.error(...) and return WITHOUT calling .set(), leaving the gauge unset for that scrape cycle.",
    caveat:
      "metrics.registry.ts is import-only (the test imports metricsRegistry and calls .metrics()) — registry.ts NOT edited. metrics.controller.ts unchanged. No schema/migration. The require-await ESLint rule is an ERROR here — make sure the now-try/catch async callbacks still legitimately await.",
    mustCover: [
      "onTimeRatio throw: collect resolves without error, gauge keeps its last-set value, Logger.error names customreportReportsOnTimeRatio",
      "activeLeads throw: same, names customreportActiveLeadsTotal",
      "both throw same cycle: 2 error logs, neither propagates",
      "registry-boundary: metricsRegistry.metrics() resolves (no reject) and still emits a DB-independent family (process_cpu/nodejs_heap)",
      "the require-await ESLint error doesn't bite the try/catch callbacks",
    ],
    reachability:
      "Does the throwing-port test exercise the real Promise.all aggregation in Registry.metrics(), or only the isolated callback (a per-callback test alone does not prove scrape survival)?",
    regression:
      "Do the happy-path collect callbacks still set the gauge (the try wraps only the await, not the .set)?",
    integrationTargets: "none (unit only)",
    needsIntegration: false,
    commitSubject:
      "fix(telemetry): isolate DB-backed gauge collect failures from the /metrics scrape",
  },
  {
    name: "fix-period-datetime-tz",
    files: ["apps/web/src/components/admin/periods-tab-dialog.tsx"],
    testFiles: ["apps/web/src/components/admin/periods-tab.test.tsx"],
    spec: { dir: true },
    seam: "In handleSubmit replace `new Date(deadline)` with `new Date(`${deadline}:00.000Z`)` so the datetime-local field is read as UTC (inverse of the toISOString().slice(0,16) display). Apply the same :00.000Z suffix in the in-dialog deadlineError range validation before comparing to the UTC-parsed periodStart/periodEnd. Correct the misleading 'stable for the typical European admin' comment.",
    caveat:
      "WEB-ONLY (periods-tab-dialog.tsx) — NO overlap with the api period module. Keep the periodStart (T00:00:00.000Z) / periodEnd (T23:59:59.999Z) submit parses intact. English-only UI. Out of scope: re-materializing existing ReminderRule.fireAt rows. Scope the TZ stub so it does not leak into other assertions in the suite.",
    mustCover: [
      "submit WITHOUT touching deadline yields a payload byte-identical to the stored ISO instant (no -N drift)",
      "the test forces a non-UTC process TZ (e.g. Europe/Moscow via vi.stubEnv('TZ',...)) so the old local parse would fail",
      "the test drives the REAL PeriodsTab->dialog edit-submit via userEvent, not a detached parser",
      "in-dialog range validation and the submit parse resolve the SAME instant for an in-range non-UTC deadline",
      "periodStart/periodEnd parses not regressed to a bare new Date(value)",
    ],
    reachability:
      "Under TZ=Europe/Moscow, does the dialog submit path (not a helper) emit the un-drifted instant — does the old code fail this test as written?",
    regression:
      "Does forcing a non-UTC TZ in this suite leak into and flake other assertions in periods-tab.test.tsx (scope the stub)?",
    integrationTargets: "none (web unit only)",
    needsIntegration: false,
    commitSubject:
      "fix(admin): parse the period deadline datetime-local field as UTC on submit and validation",
  },
  {
    name: "fix-risk-stage-integrity-impl",
    files: [
      "apps/web/src/components/lead/risk-edit-dialog.tsx",
      "apps/web/src/components/lead/stage-multi-select.tsx",
      "packages/shared/src/schemas/report-primitives.schema.ts",
    ],
    testFiles: [
      "apps/web/src/components/lead/risk-edit-dialog.test.tsx",
      "apps/web/src/components/lead/stage-multi-select.test.tsx",
      "packages/shared/src/schemas/report-primitives.schema.test.ts",
    ],
    spec: { dir: true },
    seam: "Shared: requiredStageIdsField -> z.array(z.string().min(1).refine(noNullBytes).refine(noInvisibleOnly)).min(1).max(MAX_SELECTED_STAGES) — reuse BOTH predicates safeText composes; leave the loose stageIdsField untouched. risk-edit-dialog.tsx: add a branch BEFORE the required-stage error so when availableStages.length===0 && effectiveStageIds.length===0 -> disable Save + 'no stages assigned — contact admin', and handleSave early-RETURNs (never calls onSave with empty stageIds); Ctrl/Cmd+Enter routes through handleSave so it inherits the guard. stage-multi-select.tsx: gate the empty-selection 'All assigned stages…' banner on required===false.",
    caveat:
      "risk-edit-dialog imports stage-multi-select — both edited by this same agent (intra-change, fine). A cross-stage risk that already carries stageIds (availableStages.length===0 but effectiveStageIds.length>0) MUST stay saveable. report-primitives is re-exported via schemas/report — no index.ts edit. English-only prod schema strings.",
    mustCover: [
      "requiredStageIdsField rejects [''], [' '], zero-width-only, a null-byte element; accepts ['Design']",
      "zero-owned-stage product: Save disabled, contact-admin shown, 'Select at least one stage.' never shown",
      "keyboard path: Ctrl/Cmd+Enter on a zero-owned-stage does NOT call onSave (no empty payload escapes)",
      "cross-stage risk with existing stageIds keeps Save enabled and preserves its product",
      "required-mode empty selection renders NO banner; non-required empty still renders; one-stage auto-apply unchanged",
    ],
    reachability:
      "On a zero-owned-stage product with no row stageIds, can ANY path (button OR Ctrl/Cmd+Enter) reach onSave with [] — or does the early-return fully seal it?",
    regression:
      "Does adding noInvisibleOnly to requiredStageIdsField reject any legitimate existing stage id in seeds/fixtures?",
    integrationTargets: "none (web + shared unit only)",
    needsIntegration: false,
    commitSubject:
      "fix(lead): guard zero-owned-stage risks, honest required-mode banner, per-element stage-id validation",
  },
  {
    name: "key-charts-by-id",
    files: [
      "apps/web/src/components/charts/lead-velocity.chart.tsx",
      "apps/web/src/components/charts/traffic-light-history.chart.tsx",
    ],
    testFiles: ["apps/web/src/components/charts/charts.test.tsx"],
    spec: { dir: true },
    seam: "Extract pure exported builders: buildLeadVelocityChartData(rows) -> {data,series} keyed by leadId (UUID), series=[{dataKey:leadId,name:leadName}]; buildTrafficLightHistoryChartData(periods,rows) -> keyed by projectId, series=[{dataKey:projectId,name:projectName}]. Render Bar/Line from series with dataKey=s.dataKey name=s.name so legend/tooltip still show the human name. leadId/projectId already exist in the shared output types.",
    caveat:
      "No backend/schema/API change (ids already in LeadVelocityOutput/TrafficLightHistoryOutput). Keep the existing crash-free-mount render tests; identity assertions go through the pure builders, NOT the jsdom SVG (ResponsiveContainer is zero-width in jsdom).",
    mustCover: [
      "two leads sharing leadName but distinct leadId: the period data point holds TWO columns, each its own value (not collapsed)",
      "series carries both {dataKey:leadId,name:leadName} descriptors",
      "two projects sharing projectName but distinct projectId: two columns with independent status values",
      "traffic-light series carries both {dataKey:projectId,name:projectName} descriptors",
      "existing single-entity crash-free-mount tests for all charts still pass",
    ],
    reachability:
      "With two same-named entities, does by-id keying prevent the second overwriting the first in the data-point object (proven via the builder, not a green mount)?",
    regression:
      "Does switching dataKey from name to UUID break the tooltip/legend label (must still render the human name via the name prop)?",
    integrationTargets: "none (web unit only)",
    needsIntegration: false,
    commitSubject:
      "fix(charts): key chart series by entity id so duplicate display names don't collide",
  },
  {
    name: "fix-dashboard-nan-pending",
    files: [
      "apps/web/src/components/dashboard/kpi-cards.tsx",
      "apps/web/src/components/dashboard/alert-bar.tsx",
    ],
    testFiles: [
      "apps/web/src/components/dashboard/kpi-cards.test.tsx",
      "apps/web/src/components/dashboard/alert-bar.test.tsx",
      "apps/web/src/components/dashboard/__snapshots__/alert-bar.test.tsx.snap",
    ],
    spec: { dir: true },
    seam: "kpi-cards.tsx: guard submissionPercent with `data.total > 0 ? Math.round(...) : 0`. alert-bar.tsx: drop the `isDraft = i===0` heuristic; label every pendingLeads entry '(Not started)'. Re-record the alert-bar snapshot.",
    caveat:
      "The committed alert-bar snapshot contains a `Draft` token; the label change makes it fail unless re-recorded (pnpm --filter @customreport/web exec vitest run -u alert-bar) — BUT this batch's agents must NOT run vitest; instead edit __snapshots__/alert-bar.test.tsx.snap BY HAND to replace every Draft with 'Not started' so it matches, and confirm no Draft token remains. No API/schema/shared change. English-only UI.",
    mustCover: [
      "KpiCards {submitted:0,total:0}: aria-label contains '0 of 0, 0 pending', title '...(0%)', conic background has 0% stops, NO 'NaN' anywhere",
      "AlertBar two pending entries: both names present, 'Not started' for each, 'Draft' appears nowhere",
      "the regenerated snapshot contains no Draft token",
      "non-zero-total KpiCards path still computes the correct percent (no regression)",
      "the isDraft variable and ternary are fully removed",
    ],
    reachability:
      "With total===0 does the ring's inline conic-gradient string still contain NaN anywhere, or is every stop a clean 0%?",
    regression:
      "Does dropping isDraft mislabel a genuinely-draft lead — confirm pendingLeads is already filtered to not-started only so 'Not started' is always correct?",
    integrationTargets: "none (web unit only)",
    needsIntegration: false,
    commitSubject:
      "fix(dashboard): guard zero-total submission ring and label all pending leads not-started",
  },
];
// ---------------------------------------------------------------------------------------

const IMPL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary"],
  properties: { summary: { type: "string" } },
};

const VERIFY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "findings"],
  properties: {
    verdict: { type: "string", enum: ["clean", "issues"] },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["summary", "file", "scenario", "severity"],
        properties: {
          summary: { type: "string" },
          file: { type: "string" },
          line: { type: "integer" },
          scenario: { type: "string" },
          severity: { type: "string", enum: ["blocker", "major", "minor"] },
        },
      },
    },
  },
};

const GATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "typecheck",
    "lint",
    "unitTests",
    "integrationTests",
    "redFiles",
    "summary",
  ],
  properties: {
    typecheck: { type: "string", enum: ["pass", "fail", "skip"] },
    lint: { type: "string", enum: ["pass", "fail", "skip"] },
    unitTests: { type: "string", enum: ["pass", "fail", "skip"] },
    integrationTests: { type: "string", enum: ["pass", "fail", "skip"] },
    redFiles: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
  },
};

const PREFLIGHT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["committedNames", "preexistingDirty", "note"],
  properties: {
    committedNames: { type: "array", items: { type: "string" } },
    preexistingDirty: { type: "array", items: { type: "string" } },
    note: { type: "string" },
  },
};

const COMMIT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["committed", "sha", "summary"],
  properties: {
    committed: { type: "boolean" },
    sha: { type: "string" },
    summary: { type: "string" },
  },
};

function specBlock(CHANGE) {
  if (CHANGE.spec && CHANGE.spec.inline) {
    return [
      `This change has NO OpenSpec dir; implement EXACTLY this task:`,
      `--- BEGIN TASK ---`,
      CHANGE.spec.inline,
      `--- END TASK ---`,
    ].join("\n");
  }
  return [
    `Read its FULL spec first and implement EVERY task exactly:`,
    `  openspec/changes/${CHANGE.name}/proposal.md`,
    `  openspec/changes/${CHANGE.name}/design.md`,
    `  openspec/changes/${CHANGE.name}/tasks.md`,
    `Line numbers in the spec may be slightly stale — trust the code.`,
  ].join("\n");
}

// ---- Preflight (once) ----
phase("Preflight");
const names = GROUP.map(
  (c) => `"${c.name}" (commit subject: "${c.commitSubject}")`,
);
const pre = await agent(
  [
    `Working tree: ${REPO} (git branch impl/backlog-2026-06-30).`,
    `Run, from ${REPO}: \`git log ${BASE}..HEAD --oneline\` and \`git status --porcelain\`.`,
    `committedNames = which of these changes ALREADY appear in that log — match a change if EITHER its change-name OR a distinctive phrase from its commit subject appears in any commit subject/body (conventional-commit subjects like "fix(analytics): ..." do NOT contain the change-name, so the subject phrase is the real signal). Return the change-NAME (not the subject) for each match: ${names.join("; ")}.`,
    `preexistingDirty = every dirty path from \`git status --porcelain\` EXCLUDING anything under \`.claude/\` (concurrent parallel-session edits — NOT this batch). A dirty tree is NORMAL (a parallel session edits docs/openspec). note = anything genuinely surprising.`,
    `Do NOT edit anything. Report only.`,
  ].join("\n"),
  {
    label: `preflight:batch`,
    phase: "Preflight",
    effort: "low",
    schema: PREFLIGHT_SCHEMA,
  },
);

const committedNames = (pre && pre.committedNames) || [];
const preexistingDirty = (pre && pre.preexistingDirty) || [];
const todo = GROUP.filter((c) => !committedNames.includes(c.name));
if (todo.length === 0) {
  return { status: "all-already-committed", committedNames };
}
if (committedNames.length > 0) {
  log(`Skipping already-committed: ${committedNames.join(", ")}.`);
}

// ---- Implement (PARALLEL, edit-only) ----
phase("Implement");
const implResults = await parallel(
  todo.map(
    (CHANGE) => () =>
      agent(
        [
          `You implement ONE change on a SHARED working tree at ${REPO} (git branch impl/backlog-2026-06-30, MVP phase), ALONGSIDE other agents editing OTHER files concurrently.`,
          `HARD ISOLATION RULES (a violation corrupts a concurrent agent's work):`,
          `  - Touch ONLY these files (create/modify), NOTHING else: ${[...CHANGE.files, ...(CHANGE.testFiles || [])].join(", ")}.`,
          `  - Do NOT run ANY toolchain command: NO \`prisma generate\`/\`db:generate\`, NO \`pnpm typecheck\`, NO \`pnpm lint\`/eslint, NO \`pnpm test\`/vitest, NO \`pnpm build\`. They share global state (.prisma client, turbo cache) with the other concurrent agents and MUST run only later, once, in the combined gate. Reason about correctness by READING; do not execute checks.`,
          `  - Do NOT touch git at all (no add/commit/stash/restore). Leave edits in the working tree.`,
          ``,
          `Change: ${CHANGE.name}.`,
          specBlock(CHANGE),
          ``,
          `Seam: ${CHANGE.seam}`,
          CHANGE.caveat ? `Caveat: ${CHANGE.caveat}` : ``,
          ``,
          `Hard repo standards (violating any fails review):`,
          ...STANDARDS.map((s, i) => `  ${i + 1}. ${s}`),
          ``,
          `Write the unit + (if specified) real-DB integration tests the task requires; they must have TEETH (fail if the fix is reverted). Test DB customreport_test is up; integration tests self-fixture. Mirror existing test patterns in the same module.`,
          `When done, return ONLY a one-paragraph prose summary of what you changed. Do NOT list files (the harness knows them). Do NOT claim any check passed — you ran none; the gate will.`,
        ]
          .filter(Boolean)
          .join("\n"),
        {
          label: `impl:${CHANGE.name}`,
          phase: "Implement",
          effort: "high",
          schema: IMPL_SCHEMA,
        },
      ).then((r) => ({ name: CHANGE.name, summary: r ? r.summary : null })),
  ),
);

const implByName = new Map(
  implResults.filter(Boolean).map((r) => [r.name, r.summary]),
);
const implemented = todo.filter((c) => implByName.get(c.name));
const implFailed = todo.filter((c) => !implByName.get(c.name));
if (implFailed.length > 0) {
  log(
    `Implement returned null for: ${implFailed.map((c) => c.name).join(", ")} — those are parked.`,
  );
}
if (implemented.length === 0) {
  return { status: "all-implement-failed", preexistingDirty };
}

// ---- Gate (ONE combined run over the whole tree) ----
phase("Gate");
const gate = await agent(
  [
    `Run the FULL local quality gate ONCE for the uncommitted batch at ${REPO}. Run each step as a SEPARATE command (foreground shell caps at 600s). Do NOT edit code. Do NOT touch git. Report results only.`,
    ``,
    `1. cd ${REPO} && pnpm --filter @customreport/api db:generate`,
    `2. cd ${REPO} && pnpm typecheck`,
    `3. cd ${REPO} && pnpm lint`,
    `4. cd ${REPO} && pnpm test            # full unit suite (excludes *.integration.test.ts)`,
    `5. cd ${REPO} && pnpm --filter @customreport/api test:integration   # full real-DB suite; loads ../../.env.test (DATABASE_URL=customreport_test); container customreport-postgres-1 must be up; do NOT wrap vitest in rtk`,
    ``,
    `For each of typecheck/lint/unitTests/integrationTests report pass|fail|skip. redFiles = the list of FAILING test files (empty if none) — include the precise file path of every failing unit OR integration test. summary = a short digest; for ANY failure include the precise error excerpt (file, message) so the orchestrator can attribute it to a change.`,
  ].join("\n"),
  {
    label: `gate:batch`,
    phase: "Gate",
    effort: "medium",
    schema: GATE_SCHEMA,
  },
);

const typeLintGreen = gate && gate.typecheck === "pass" && gate.lint === "pass";
const allTestsGreen =
  gate && gate.unitTests === "pass" && gate.integrationTests === "pass";
const redFiles = (gate && gate.redFiles) || [];

// ---- Verify (per change: completeness + regression + Codex, fanned out) ----
phase("Verify");
function scopeArg(CHANGE) {
  return [...CHANGE.files, ...(CHANGE.testFiles || [])]
    .map((p) => `'${p}'`)
    .join(" ");
}
function diffCmd(CHANGE) {
  return `cd ${REPO} && git --no-pager diff HEAD -- ${scopeArg(CHANGE)}`;
}
function verifyHead(CHANGE) {
  return [
    `Adversarially verify an UNCOMMITTED change on the working tree at ${REPO}: ${CHANGE.name}.`,
    CHANGE.spec && CHANGE.spec.inline
      ? `Intent (inline task):\n${CHANGE.spec.inline}`
      : `Intent: openspec/changes/${CHANGE.name}/proposal.md and design.md.`,
    `This change's files: ${[...CHANGE.files, ...(CHANGE.testFiles || [])].join(", ")}. Read the diff: \`${diffCmd(CHANGE)}\`. A NEWLY CREATED file will not appear in that diff — read it in full. IGNORE every other dirty file (other changes in this batch, plus parallel-session docs/openspec): not your concern.`,
    `SCOPE DISCIPLINE (loop-termination): rate a finding blocker/major ONLY if it is THIS change's own new code being wrong, a regression it introduces, or a legit flow it breaks. A Non-Goal, or a pre-existing/cross-cutting issue equally present before this change, is "minor" + a follow-up — never a blocker.`,
  ].join("\n");
}

const reviews = await parallel(
  implemented.flatMap((CHANGE) => [
    () =>
      agent(
        [
          verifyHead(CHANGE),
          `LENS — COMPLETENESS + REACHABILITY. Confirm the diff handles EVERY item; name any missing/partial:`,
          ...CHANGE.mustCover.map((m, i) => `  [${i + 1}] ${m}`),
          `Reachability: ${CHANGE.reachability}`,
          `For each gap: file:line, concrete scenario, severity.`,
        ].join("\n"),
        {
          label: `verify:${CHANGE.name}`,
          phase: "Verify",
          effort: "high",
          schema: VERIFY_SCHEMA,
        },
      ).then((v) => ({ name: CHANGE.name, kind: "verify", v })),
    () =>
      agent(
        [
          verifyHead(CHANGE),
          `LENS — REGRESSION + STANDARDS + TEST TEETH. Regression: ${CHANGE.regression}`,
          `Check the diff for: new let/mutation where const/pure fits; any fallback/silent default (\`?? "..."\`, \`.default()\`); non-English UI string in apps/web tsx; ticket/phase/change-slug comment prefix; hand-rolled tRPC chain; function > 50 lines or file > 250 lines introduced; period-dual-state atomicity regression. Confirm new tests have TEETH (fail on revert).`,
          `For each issue: file:line, concrete scenario, severity.`,
        ].join("\n"),
        {
          label: `regress:${CHANGE.name}`,
          phase: "Verify",
          effort: "high",
          schema: VERIFY_SCHEMA,
        },
      ).then((v) => ({ name: CHANGE.name, kind: "regress", v })),
    () =>
      agent(
        [
          `You are an independent, read-only adversarial reviewer of an UNCOMMITTED change on the working tree at ${REPO}. Change: ${CHANGE.name}.`,
          CHANGE.spec && CHANGE.spec.inline
            ? `Intent (inline):\n${CHANGE.spec.inline}`
            : `Intent: openspec/changes/${CHANGE.name}/{proposal,design,tasks}.md.`,
          `Read the diff: \`${diffCmd(CHANGE)}\` (read any newly-created file in full). Hunt for a real correctness/security hole, a legit flow this now falsely rejects, a test without teeth, a standards violation. Default to finding a problem.`,
          `SCOPE DISCIPLINE: block ONLY on this change's own new code being wrong, a regression it introduces, or a legit flow it breaks; a pre-existing/cross-cutting concern is minor + follow-up.`,
          `verdict "clean" only if nothing real; else "issues" with each finding's file, line, scenario, severity.`,
        ].join("\n"),
        {
          label: `codex:${CHANGE.name}`,
          phase: "Verify",
          effort: "high",
          agentType: "codex:codex-rescue",
          // Use the current Sonnet (Sonnet 5 on the updated client) for the
          // adversarial reviewer; the codex-rescue agentType otherwise runs its
          // wrapper on Sonnet 4.6. The "sonnet" alias tracks the latest version.
          model: "sonnet",
          schema: VERIFY_SCHEMA,
        },
      ).then((v) => ({ name: CHANGE.name, kind: "codex", v })),
  ]),
);

const findingsByName = new Map(implemented.map((c) => [c.name, []]));
for (const r of reviews.filter(Boolean)) {
  if (r.v && r.v.findings) findingsByName.get(r.name).push(...r.v.findings);
}
const isBlocking = (f) => f.severity === "blocker" || f.severity === "major";

// ---- Commit (per change; only fully-green ones) ----
phase("Commit");
const ledger = [];
for (const CHANGE of implemented) {
  const findings = findingsByName.get(CHANGE.name) || [];
  const blockers = findings.filter(isBlocking);
  const own = [...CHANGE.files, ...(CHANGE.testFiles || [])];
  // Attribute a failing test to this change only on a path-BOUNDARY match, never
  // a bare substring (so a declared `analytics.ts` does not falsely claim a
  // failing `analytics-extra.test.ts`). A red test path equals, or is a
  // path-suffix of, one of the change's declared files.
  const ownRed = redFiles.filter((rf) =>
    own.some((p) => rf === p || rf.endsWith(`/${p}`) || p.endsWith(`/${rf}`)),
  );

  // Never commit onto a tree whose typecheck/lint is red (whole-tree red).
  if (!typeLintGreen) {
    ledger.push({
      name: CHANGE.name,
      status: "parked-typelint-red",
      blockers,
      gate: gate && gate.summary,
    });
    continue;
  }
  if (ownRed.length > 0) {
    ledger.push({
      name: CHANGE.name,
      status: "parked-own-tests-red",
      ownRed,
      blockers,
    });
    continue;
  }
  if (blockers.length > 0) {
    ledger.push({ name: CHANGE.name, status: "parked-blocker", blockers });
    continue;
  }

  const commit = await agent(
    [
      `Commit ONE change (${CHANGE.name}) on branch impl/backlog-2026-06-30 at ${REPO}. The combined gate already passed and this change's tests are green; do NOT re-run the gate.`,
      `Stage EXACTLY these paths and NOTHING else: ${own.join(", ")}.`,
      `Run \`cd ${REPO} && git add\` with exactly those paths (NEVER \`git add .\`/\`-A\`). Then \`git status --porcelain\` and confirm the STAGED set is exactly those paths; if staging pulled in anything else, or a path above is not dirty, STOP and report committed:false with the surprise.`,
      `Then \`git commit\` with subject "${CHANGE.commitSubject}" and end the message with exactly:`,
      `  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`,
      `If a pre-commit hook reformats staged files, re-add exactly those paths and retry once. Report committed, the new short sha, and the committed paths.`,
    ].join("\n"),
    {
      label: `commit:${CHANGE.name}`,
      phase: "Commit",
      effort: "low",
      schema: COMMIT_SCHEMA,
    },
  );
  if (commit && commit.committed) {
    log(`Committed ${CHANGE.name} ${commit.sha}.`);
    ledger.push({ name: CHANGE.name, status: "committed", sha: commit.sha });
  } else {
    ledger.push({ name: CHANGE.name, status: "commit-failed", commit });
  }
}

return {
  gate: {
    typeLintGreen,
    allTestsGreen,
    redFiles,
    summary: gate && gate.summary,
  },
  implFailed: implFailed.map((c) => c.name),
  ledger,
  preexistingDirty,
};
