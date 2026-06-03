export const meta = {
  name: "sc-catalog-extract",
  description:
    "SC-2..5: build the behavioral scenario catalog (.feature) from the code entry-point surface, then gap-critic + diff-tag + matrix",
  phases: [
    {
      title: "Extract",
      detail:
        "9 Sonnet agents — one per module slice → e2e/catalog/<m>.feature",
    },
    {
      title: "Diff-tag",
      detail: "tag scenarios whose code is in the dangerous lint waves",
    },
    {
      title: "Gap-critic",
      detail: "Opus — cross-ref vs 152 specs + Prisma model, emit gap list",
    },
    {
      title: "Matrix",
      detail:
        "coverage matrix (entity/state x entry point x role x covered-by x diff-tag)",
    },
  ],
};

// ---- shared contract block, reused in every Extract prompt ------------------
const CONTRACT = `
You are an EXTRACT agent building a behavioral scenario catalog for the CustomReport repo.
The catalog is the durable, drift-gated contract between human intent and AI test execution.

REFERENCE FORMAT — read it FIRST and match it exactly:
  e2e/catalog/carry-over.feature  (the agreed pilot). Same header comment block,
  same per-Scenario annotations. Each Scenario must carry these annotations:
    src:     where it was derived (code / trpc / model / spec / graph)
    covered: the test that asserts it (<test name> ✓) or "none ✗"
    diff:    leave as "none" — a later diff-tag pass sets it. Do NOT guess.
    tier:    api / ui / api-only

FOUR-SOURCE derivation — triangulate, never trust one source:
  code  — the tRPC procedure + the module service/repository it calls. READ them.
          Module routers apps/api/src/modules/<m>/<m>.router.ts are THIN adapters;
          the real procedures are inline in
          apps/api/src/infrastructure/trpc/trpc.router.ts. The line numbers in your
          slice are DERIVED HINTS — confirm the real namespace "})" boundaries by
          reading, so no procedure is dropped at the seam between slices.
  model — prisma/schema.prisma entities + state enums this slice touches.
  spec  — relevant openspec/specs/*.md "#### Scenario:" blocks (cross-check intent).
  graph — use the codegraph MCP (codegraph_context, codegraph_callees,
          codegraph_impact) to map entity<->entry-point cheaply instead of grepping.

HARD RULES (from the catalog contract spec):
  - Every Scenario's Then MUST be machine-checkable: a persisted field value, a
    returned shape, a visible string, or a console-error count. NEVER prose like
    "it works" / "page loads". If an outcome cannot be made concrete, DROP the
    scenario or mark its Then as a known gap — do NOT soften it into vague prose
    just to keep it.
  - covered: mark "✓ <test-file>::<test-name> :<line>" ONLY when that test's
    assertion actually checks THIS scenario's Then. If you cannot cite a real
    file + test name + asserting line, it is "none ✗". A fabricated ✓ poisons the
    diff gate (it selects the wrong scenarios to re-run); honest "none ✗" is the
    entire point of this catalog. Search apps/**/*.test.ts and e2e/**/*.spec.ts.
  - codeLink: every Scenario links to file:line of the entry point it exercises.
  - ROLES: for each MUTATING procedure add the negative-authz scenarios (which
    roles are rejected — Lead / Head / Admin / Viewer). The pilot proved these are
    routinely untested; they are the highest-value gaps.
  - Mark "api-only" where there is no UI control (schedulers, system procedures).
  - NO BDD runner. These are docs; automation reuses native Playwright/Vitest.

OUTPUT: write the .feature file named below, then return the structured summary.
`;

const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    featureFile: { type: "string" },
    scenarioCount: { type: "integer" },
    entryPointsCovered: { type: "integer" },
    apiOnlyCount: { type: "integer" },
    negativeAuthzScenarios: { type: "integer" },
    gaps: { type: "array", items: { type: "string" } },
    notes: { type: "string" },
  },
  required: [
    "featureFile",
    "scenarioCount",
    "entryPointsCovered",
    "apiOnlyCount",
    "negativeAuthzScenarios",
    "gaps",
    "notes",
  ],
};

// ---- the 9 extract slices (carryOver is already piloted — skipped) ----------
const SLICES = [
  {
    file: "admin.feature",
    label: "admin (core, ~37 procedures)",
    surface: `tRPC namespace "admin" CORE, trpc.router.ts lines 660-1331.
Module: apps/api/src/modules/admin/ (admin.router.ts adapter + service + repository).
This is org/user/product/group administration + settings. Big slice — be thorough on roles.`,
  },
  {
    file: "admin-ops.feature",
    label: "admin > actionLog + jobs (~6 procedures)",
    surface: `tRPC sub-namespaces "admin.actionLog" (trpc.router.ts ~1332-1376) and
"admin.jobs" (~1377-1550). Audit log reads + background-job controls.`,
  },
  {
    file: "lead-form.feature",
    label: "leadForm (~11 procedures)",
    surface: `tRPC namespace "leadForm", trpc.router.ts lines 1891-2105.
The lead's structured report-section editing path. Module: apps/api/src/modules/report-sections/
and weekly-report. This is where the period-dual-state lead-save invariant lives.`,
  },
  {
    file: "reports-period.feature",
    label: "reports + period + weeklyReport (~8 procedures)",
    surface: `tRPC namespaces: "reports" (303-553), "period" (1805-1833),
"weeklyReport" (1834-1890). The report lifecycle + PeriodState surface seen via tRPC.
Module: apps/api/src/modules/period/, weekly-report/. Cross-check period-dual-state spec.`,
  },
  {
    file: "archive.feature",
    label: "archive (~4 procedures)",
    surface: `tRPC namespace "archive", trpc.router.ts lines 1551-1632.
Module: apps/api/src/modules/archive/. Archive is a period-dual-state writer — verify it
writes BOTH periodState and the legacy tuple atomically (the spec lists it as a writer).`,
  },
  {
    file: "review-reminders.feature",
    label: "review + reminders (~6 procedures)",
    surface: `tRPC namespaces: "review" (554-624) and "reminders" (1633-1783).
Modules: apps/api/src/modules/review/, reminders/. Head review/approve path + reminder policy.`,
  },
  {
    file: "analytics-read.feature",
    label: "analytics + search + activity + telemetry (~7 procedures)",
    surface: `tRPC namespaces: "analytics" (2106-2145), "search" (2146-2174),
"activity" (2175-2190), "telemetry" (2191-end). Mostly read/telemetry surface.`,
  },
  {
    file: "misc.feature",
    label: "pdfExport + auth + org + dev (~6 procedures)",
    surface: `tRPC namespaces: "pdfExport" (625-659), "auth" (155-172), "org" (173-194),
"dev" (195-302). NB: "dev" procedures must be api-only and gated to AUTH_DEV_MODE — note that.
Module: apps/api/src/modules/pdf-export/.`,
  },
  {
    file: "system-entry-points.feature",
    label: "NON-tRPC sweep: REST + BullMQ + Cron + Next",
    surface: `The NON-tRPC entry-point surface (all api-only unless noted):
  REST controllers:
    apps/api/src/infrastructure/health/health.controller.ts  (GET live, GET ready)
    apps/api/src/infrastructure/metrics/metrics.controller.ts (GET /)
    apps/api/src/modules/observability/web-vitals.controller.ts (POST web-vitals)
  BullMQ workers (raw new Worker on OnModuleInit, NOT @Processor):
    infrastructure/bullmq/email-reminder.processor.ts
    infrastructure/bullmq/pdf-export.processor.ts
    modules/telegram/telegram.queue.ts
  Cron schedulers (@Cron) — THE BIGGEST BLIND SPOT, these drive the PeriodState
  lifecycle that no procedure walk reaches; every PeriodState transition
  (scheduled->open->published->archived) MUST appear as a scenario:
    modules/period/period-creator.scheduler.ts  (5 0 * * *)
    modules/period/auto-publisher.scheduler.ts   (EVERY_HOUR)
    modules/period/auto-archiver.scheduler.ts    (15 0 * * *)
    modules/reminders/reminders.scheduler.ts      (EVERY_HOUR)
  Next route handlers:
    apps/web/src/app/api/client-logs/route.ts (POST)
    apps/web/src/app/api/revalidate-org/route.ts (POST)
Cross-check the period-dual-state spec: auto-publisher must write the full
lifecycle field set atomically (status, periodStatus, periodState, autoPublished).`,
  },
];

phase("Extract");
const extracted = await parallel(
  SLICES.map(
    (s) => () =>
      agent(
        `${CONTRACT}\n\nYOUR SLICE: ${s.label}\nWRITE FILE: e2e/catalog/${s.file}\n\nENTRY POINTS:\n${s.surface}`,
        {
          label: `extract:${s.file}`,
          phase: "Extract",
          model: "sonnet",
          schema: EXTRACT_SCHEMA,
        },
      ),
  ),
);
const ok = extracted.filter(Boolean);
log(
  `Extract done: ${ok.length}/${SLICES.length} feature files, ${ok.reduce((n, r) => n + (r.scenarioCount || 0), 0)} scenarios total`,
);

// ---- Diff-tag (after the barrier; it EDITS the feature files) ---------------
phase("Diff-tag");
const DIFFTAG_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    diffTagsFile: { type: "string" },
    waveFileCount: { type: "integer" },
    tagged: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          feature: { type: "string" },
          title: { type: "string" },
          rule: { type: "string" },
          codeLink: { type: "string" },
        },
        required: ["feature", "title", "rule", "codeLink"],
      },
    },
    notes: { type: "string" },
  },
  required: ["diffTagsFile", "waveFileCount", "tagged", "notes"],
};
const difftag = await agent(
  `You are the DIFF-TAG agent for the scenario catalog (SC-4).
The recent work was a lint campaign. The SEMANTICALLY DANGEROUS waves (the ones
that can change runtime behavior) and their commits are:
  - no-unnecessary-condition : commits 459bebe9, 61dfa215
  - no-misused-promises      : commit 7f2736c3
  - require-await            : commit d7700262

STEP 1: run \`git show --stat <sha>\` for each commit above to collect the set of
changed files (the diff-scoped risk set). Diff radius is large, so scope by RULE
RISK, not by file count.
STEP 2: read every e2e/catalog/*.feature file (READ-ONLY — do NOT edit them). For
each Scenario whose codeLink file is in the changed-file set, record a tag
{feature, scenario title, rule, codeLink}.
STEP 3: write the authoritative diff-scope map to e2e/catalog/_diff-tags.md
(grouped by rule, each row = feature :: scenario title -> codeLink). This file —
not inline annotations — is the "verify now" subset the matrix consumes.
STEP 4: return the tag map.

Do NOT edit the .feature files in place (many identical "diff: none" lines make
in-place edits unsafe, and gap-critic/matrix read these files right after you).`,
  {
    label: "diff-tag",
    phase: "Diff-tag",
    model: "sonnet",
    schema: DIFFTAG_SCHEMA,
  },
);
log(
  `Diff-tag: ${difftag ? difftag.tagged.length : 0} scenarios tagged from ${difftag ? difftag.waveFileCount : 0} wave files`,
);

// ---- Gap-critic (Opus; reads the now-annotated features) -------------------
phase("Gap-critic");
const GAP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    gapsFile: { type: "string" },
    coverageGaps: { type: "array", items: { type: "string" } },
    specDriftFindings: { type: "array", items: { type: "string" } },
    uncoveredEntities: { type: "array", items: { type: "string" } },
    uncoveredEnumStates: { type: "array", items: { type: "string" } },
    notes: { type: "string" },
  },
  required: [
    "gapsFile",
    "coverageGaps",
    "specDriftFindings",
    "uncoveredEntities",
    "uncoveredEnumStates",
    "notes",
  ],
};
const gaps = await agent(
  `You are the GAP-CRITIC for the scenario catalog (SC-3). Mine the DIFFERENCES
between the four sources — that is where uncovered behavior hides.

INPUTS:
  - ALL e2e/catalog/*.feature files (the catalog just produced, + carry-over.feature pilot).
  - The 152 "#### Scenario:" blocks across openspec/specs/ (19 files).
  - The Prisma domain model: 26 entities + 17 enums in prisma/schema.prisma.

DO:
  1. For EVERY Prisma entity and EVERY enum state value, check the catalog has a
     WRITER and a READER entry-point scenario. Anything with none = a coverage gap
     (report it, never silently drop it).
  2. Spec-drift findings: places where an openspec spec claims behavior the code
     does NOT implement. The KNOWN example to confirm: period-dual-state lists
     carry-over as a Report-period writer, but carry-over.prisma-repository.ts
     writes only child rows (items/decisions/execution), never a Report period
     field — so the spec is wrong, not the code. Confirm this and hunt for others
     (especially the apparently-dead CarryOverStatus.failed enum value).
  3. Use the codegraph MCP (codegraph_impact / codegraph_callers) to confirm
     writer/reader reachability instead of grepping.

OUTPUT: write the gap list to e2e/catalog/_gaps.md (grouped: coverage gaps /
spec-drift / dead enum states / api-only-with-no-test). Return the structured summary.`,
  { label: "gap-critic", phase: "Gap-critic", schema: GAP_SCHEMA },
);
log(
  `Gap-critic: ${gaps ? gaps.coverageGaps.length : 0} coverage gaps, ${gaps ? gaps.specDriftFindings.length : 0} spec-drift findings`,
);

// ---- Matrix (last; reads everything) --------------------------------------
phase("Matrix");
const MATRIX_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    matrixFile: { type: "string" },
    rowCount: { type: "integer" },
    coveredCount: { type: "integer" },
    uncoveredCount: { type: "integer" },
    diffTaggedCount: { type: "integer" },
    notes: { type: "string" },
  },
  required: [
    "matrixFile",
    "rowCount",
    "coveredCount",
    "uncoveredCount",
    "diffTaggedCount",
    "notes",
  ],
};
const matrix = await agent(
  `You are the MATRIX agent (SC-5). Read all e2e/catalog/*.feature (including the
carry-over.feature pilot), e2e/catalog/_gaps.md, and e2e/catalog/_diff-tags.md
(the authoritative diff-scope map). Build the coverage matrix: ONE ROW PER
(entity/state x entry point x role x covered-by x diff-tag). Group by module. Mark
uncovered rows clearly and carry the "⚠ <rule>" diff-tag for any scenario listed
in _diff-tags.md. Write it to e2e/catalog/_matrix.md.
This is the "did I miss any logic" view. Return the structured summary.`,
  { label: "matrix", phase: "Matrix", model: "sonnet", schema: MATRIX_SCHEMA },
);

return {
  extracted: ok.map((r) => ({
    file: r.featureFile,
    scenarios: r.scenarioCount,
    apiOnly: r.apiOnlyCount,
    negAuthz: r.negativeAuthzScenarios,
  })),
  totalScenarios: ok.reduce((n, r) => n + (r.scenarioCount || 0), 0),
  diffTagged: difftag ? difftag.tagged.length : 0,
  coverageGaps: gaps ? gaps.coverageGaps.length : 0,
  specDrift: gaps ? gaps.specDriftFindings : [],
  matrix: matrix
    ? {
        rows: matrix.rowCount,
        covered: matrix.coveredCount,
        uncovered: matrix.uncoveredCount,
      }
    : null,
};
