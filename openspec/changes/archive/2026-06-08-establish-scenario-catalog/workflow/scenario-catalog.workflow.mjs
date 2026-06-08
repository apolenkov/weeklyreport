// ============================================================================
// Portable "behavioral scenario catalog" workflow — runs in ANY repo.
//
// It discovers the repo's entry-point surface itself (no hardcoded routes,
// namespaces, line numbers, or commits), then fans out to write one
// Given/When/Then `.feature` doc per module, cross-checks coverage gaps, and
// emits a coverage matrix.
//
// Run it from the target repo:
//   Workflow({ scriptPath: "scenario-catalog.workflow.mjs" })
// Optional args (all optional):
//   Workflow({ scriptPath: "...", args: { outDir: "e2e/catalog", base: "main", maxSlices: 10 } })
//     outDir    — where .feature files go        (default "e2e/catalog")
//     base      — git base for the diff-tag pass (default: skip diff-tag)
//     maxSlices — max parallel extract agents     (default 10)
// ============================================================================

export const meta = {
  name: "scenario-catalog",
  description:
    "Discover a repo's entry-point surface and build a behavioral scenario catalog (.feature) + coverage gaps + matrix",
  whenToUse: "Generate an AI-testable behavioral catalog for any codebase",
  phases: [
    {
      title: "Discover",
      detail:
        "1 agent — inventory entry points + domain model, plan the fan-out",
    },
    {
      title: "Extract",
      detail: "N agents — one per slice → <outDir>/<module>.feature",
    },
    {
      title: "Diff-tag",
      detail: "optional — tag scenarios whose code changed vs base",
    },
    {
      title: "Gap-critic",
      detail: "cross-ref vs domain model + existing specs/tests → _gaps.md",
    },
    { title: "Matrix", detail: "coverage matrix → _matrix.md" },
  ],
};

const outDir = (args && args.outDir) || "e2e/catalog";
const base = args && args.base; // undefined => skip diff-tag
const maxSlices = (args && args.maxSlices) || 10;

// ---- the .feature format every extract agent must follow -------------------
const FORMAT = `
.feature FORMAT (these are DOCS, not a BDD runner — do not add a BDD dependency):

  Feature: <module / capability name>
    <one-line narrative of who does what>

    Scenario: <one concrete behavior>
      # src:     code | model | spec | graph   (which source it was derived from)
      # covered: ✓ <test-file>::<test-name> :<line>   OR   none ✗
      # diff:    none                          (a later diff-tag pass may set this)
      # tier:    api | ui | api-only
      # code:    <file>:<line>                 (the entry point it exercises)
      Given <precondition / fixture state>
      When  <the named entry point is exercised: procedure / route / job / command>
      Then  <MACHINE-CHECKABLE outcome: a persisted field value, a returned shape,
             a visible string, or an error/console-error count>
`;

const RULES = `
HARD RULES (this is what makes the catalog trustworthy):
  - Every Then MUST be machine-checkable. NEVER prose like "it works" / "loads".
    If an outcome can't be made concrete, DROP the scenario or mark its Then a
    known gap — do not soften it to keep it.
  - covered: mark "✓ <file>::<test> :<line>" ONLY when that test actually asserts
    THIS scenario's Then. If you can't cite file + test + asserting line, it is
    "none ✗". A fake ✓ is worse than an honest gap — it hides untested behavior.
  - Every mutating entry point gets NEGATIVE-AUTHZ scenarios (which roles/callers
    are rejected). Untested authorization is the highest-value gap.
  - Mark "api-only" where there is no UI path (schedulers, system jobs, webhooks).
  - Triangulate sources, never trust one: code (the handler + what it calls),
    the domain model (DB entities + state enums), existing specs/docs, and — if a
    code-graph/index MCP is available — use it to map entity<->entry-point instead
    of grepping blindly.
`;

// ============================================================================
phase("Discover");
const DISCOVER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    stack: { type: "string" },
    entryPointTotal: { type: "integer" },
    byKind: {
      type: "object",
      additionalProperties: false,
      properties: {
        httpRoutes: { type: "integer" },
        rpcProcedures: { type: "integer" },
        queueWorkers: { type: "integer" },
        scheduledJobs: { type: "integer" },
        cliCommands: { type: "integer" },
        eventOrWebhookHandlers: { type: "integer" },
      },
      required: [
        "httpRoutes",
        "rpcProcedures",
        "queueWorkers",
        "scheduledJobs",
        "cliCommands",
        "eventOrWebhookHandlers",
      ],
    },
    domainEntities: { type: "integer" },
    domainEnums: { type: "integer" },
    inventoryFile: { type: "string" },
    slices: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          file: { type: "string" }, // <module>.feature
          label: { type: "string" },
          surface: { type: "string" }, // concrete entry points + file paths for this slice
        },
        required: ["file", "label", "surface"],
      },
    },
    notes: { type: "string" },
  },
  required: [
    "stack",
    "entryPointTotal",
    "byKind",
    "domainEntities",
    "domainEnums",
    "inventoryFile",
    "slices",
    "notes",
  ],
};

const disco = await agent(
  `You are the DISCOVER agent. Inventory THIS repository's complete entry-point
surface and domain model — the raw material for a behavioral scenario catalog.

1. Detect the stack (framework, language, ORM, queue, scheduler). State it.
2. Enumerate EVERY triggerable entry point, by kind:
   - HTTP/REST routes, GraphQL resolvers, tRPC/RPC procedures
   - message-queue consumers / workers
   - cron / scheduled jobs  (these drive state transitions no request walk reaches —
     do not miss them; they are the classic blind spot)
   - CLI commands, webhooks, event handlers
   Record the count per kind and the concrete list with file:line.
3. Enumerate the domain model: DB entities/tables + state enums (from the ORM
   schema / migrations / models). Count both.
4. Write the full inventory to ${outDir}/_entry-points.md (a table per kind).
5. Plan the fan-out: group the entry points into AT MOST ${maxSlices} balanced
   slices (one .feature file each), each with its concrete entry points + the
   source files an extract agent must read. Big modules get their own slice.

Use any code-graph/index MCP if present; otherwise ripgrep + reading. Return the
structured inventory.`,
  { label: "discover", phase: "Discover", schema: DISCOVER_SCHEMA },
);

if (!disco || !disco.slices || disco.slices.length === 0) {
  log(
    "Discover produced no slices — aborting. Check the repo has recognizable entry points.",
  );
  return { error: "no slices", disco };
}
log(
  `Discover: ${disco.stack} — ${disco.entryPointTotal} entry points, ${disco.domainEntities} entities / ${disco.domainEnums} enums → ${disco.slices.length} slices`,
);

// ============================================================================
phase("Extract");
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

const extracted = (
  await parallel(
    disco.slices.map(
      (s) => () =>
        agent(
          `You are an EXTRACT agent building a behavioral scenario catalog.
WRITE FILE: ${outDir}/${s.file}
YOUR SLICE: ${s.label}

ENTRY POINTS (read each handler + what it calls):
${s.surface}
${FORMAT}${RULES}
Write the .feature file, then return the structured summary.`,
          {
            label: `extract:${s.file}`,
            phase: "Extract",
            model: "sonnet",
            schema: EXTRACT_SCHEMA,
          },
        ),
    ),
  )
).filter(Boolean);
log(
  `Extract: ${extracted.length}/${disco.slices.length} feature files, ${extracted.reduce((n, r) => n + (r.scenarioCount || 0), 0)} scenarios`,
);

// ============================================================================
// Diff-tag — optional, only when a git base was passed.
let difftag = null;
if (base) {
  phase("Diff-tag");
  const DIFFTAG_SCHEMA = {
    type: "object",
    additionalProperties: false,
    properties: {
      diffTagsFile: { type: "string" },
      changedFileCount: { type: "integer" },
      taggedCount: { type: "integer" },
      notes: { type: "string" },
    },
    required: ["diffTagsFile", "changedFileCount", "taggedCount", "notes"],
  };
  difftag = await agent(
    `You are the DIFF-TAG agent. Run \`git diff --name-only ${base}...HEAD\` to get
the changed-file set. Read every ${outDir}/*.feature (READ-ONLY). For each scenario
whose "# code:" file is in the changed set, record it. Write the authoritative
"verify now" subset to ${outDir}/_diff-tags.md (feature :: scenario -> file). Do
NOT edit the .feature files in place. Return the summary.`,
    {
      label: "diff-tag",
      phase: "Diff-tag",
      model: "sonnet",
      schema: DIFFTAG_SCHEMA,
    },
  );
  log(
    `Diff-tag: ${difftag ? difftag.taggedCount : 0} scenarios in the diff scope`,
  );
}

// ============================================================================
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
  `You are the GAP-CRITIC. Mine the DIFFERENCES between sources — that is where
uncovered behavior hides.

INPUTS:
  - ALL ${outDir}/*.feature files (the catalog just produced).
  - The domain model: ${disco.domainEntities} entities + ${disco.domainEnums} enums.
  - Any existing specs/docs/tests in the repo.

DO:
  1. For EVERY entity and EVERY enum state value, check the catalog has a WRITER
     and a READER entry-point scenario. Anything with none = a coverage gap
     (report it, never silently drop it).
  2. Spec-drift: find places where a spec/doc claims behavior the code does NOT
     implement, or where an enum value is declared but never written (dead state).
  3. Use a code-graph MCP if present to confirm writer/reader reachability.

Write the grouped gap list to ${outDir}/_gaps.md. Return the structured summary.`,
  { label: "gap-critic", phase: "Gap-critic", schema: GAP_SCHEMA },
);
log(
  `Gap-critic: ${gaps ? gaps.coverageGaps.length : 0} coverage gaps, ${gaps ? gaps.specDriftFindings.length : 0} drift findings`,
);

// ============================================================================
phase("Matrix");
const MATRIX_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    matrixFile: { type: "string" },
    rowCount: { type: "integer" },
    coveredCount: { type: "integer" },
    uncoveredCount: { type: "integer" },
    notes: { type: "string" },
  },
  required: [
    "matrixFile",
    "rowCount",
    "coveredCount",
    "uncoveredCount",
    "notes",
  ],
};
const matrix = await agent(
  `You are the MATRIX agent. Read all ${outDir}/*.feature, ${outDir}/_gaps.md, and
${outDir}/_diff-tags.md if it exists. Build the coverage matrix: ONE ROW PER
(entity/state x entry point x role x covered-by x diff-tag). Group by module. Mark
uncovered rows clearly. Write it to ${outDir}/_matrix.md. Return the summary.`,
  { label: "matrix", phase: "Matrix", model: "sonnet", schema: MATRIX_SCHEMA },
);

return {
  stack: disco.stack,
  entryPoints: disco.entryPointTotal,
  features: extracted.map((r) => ({
    file: r.featureFile,
    scenarios: r.scenarioCount,
    apiOnly: r.apiOnlyCount,
    negAuthz: r.negativeAuthzScenarios,
  })),
  totalScenarios: extracted.reduce((n, r) => n + (r.scenarioCount || 0), 0),
  diffScoped: difftag ? difftag.taggedCount : null,
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
