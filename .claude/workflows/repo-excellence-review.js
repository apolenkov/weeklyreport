export const meta = {
  name: "repo-excellence-review",
  description:
    "Whole-repo, multi-model code review. Per-unit code review + a cross-cutting dimension sweep (CI/deploy/authz/data/observability/supply-chain/config), adversarial verify, then a 5-model COUNCIL (Claude+Codex+Kimi+Qwen+GLM) audits the backlog for false positives AND misses. Produces a verified P0-P3 backlog (report + OpenSpec change list). Review only — no autonomous fixes.",
  phases: [
    {
      title: "Inventory",
      detail: "classify source into review units + risk tier + model (Sonnet)",
    },
    {
      title: "Review",
      detail:
        "one skill-powered reviewer per code unit, model by risk (Sonnet/Opus)",
    },
    {
      title: "Dimensions",
      detail:
        "cross-cutting prod-readiness sweep: CI, deploy, authz, data, obs, supply-chain, config (Opus)",
    },
    {
      title: "Verify",
      detail:
        "per-finding adversarial verify — default-refute for presence bugs, fact-check for config/absence (Sonnet/Opus)",
    },
    {
      title: "Prioritize",
      detail: "dedup + P0-P3 + blast radius, dedup vs openspec specs (Opus)",
    },
    {
      title: "Council",
      detail:
        "5-model backlog audit: Codex+Kimi+Qwen+GLM independently flag false positives + misses (external CLIs)",
    },
    {
      title: "Synthesize",
      detail:
        "reconcile council verdicts into report + recommended OpenSpec changes (Opus)",
    },
  ],
};

// ---------------------------------------------------------------------------
// Shared context baked into every reviewer/skeptic prompt. These are the
// repo conventions that turn "looks wrong" into "is actually intended", so the
// review does not drown the user in false positives. Sourced from CLAUDE.md
// and prior-session memory.
// ---------------------------------------------------------------------------
const REPO_GUARDRAILS = `
REPO CONVENTIONS — do NOT report these as defects (they are intentional):
- UI strings: hardcoded Russian is only a defect inside JSX/toast/aria-label/
  placeholder/button copy in apps/web/src/**/*.tsx. Russian in seeds, fixtures,
  tests, comments, and DB data is correct DATA, not an i18n bug.
- "ComingSoon" badges/controls are deliberately deferred features, not bugs.
- MVP database posture: a SINGLE init migration kept in sync with the schema is
  intentional. Do NOT flag "missing incremental alter-table migrations".
- Static production UI strings stay English until a real i18n phase — that is a
  decision, not debt.
- Do NOT propose behavior-changing refactors as "cleanups": metric-driven
  refactors here have a history of passing the gate but breaking behavior
  (revert-bait). Only flag a refactor when behavior is provably preserved.
- Lint/format/import-order are owned by ESLint/Prettier/stylelint — do NOT spend
  findings on them. Report logic, correctness, security, architecture, perf.
SEVERITY: Critical (data loss / auth bypass / corruption), High (real bug or
vuln on a reachable path), Medium (maintainability/perf risk), Low (nit worth
noting). Attach file:line and concrete evidence to every finding.
`;

// code-review-skill is kept GLOBAL by the user (not vendored in-repo). The
// script can't expand "~", so this is the absolute global install path. If it
// is ever missing (different machine/home), agents are told below to locate it
// via `ls ~/.claude/skills`. Vercel skills DO live in-repo (user's choice).
const SKILL_DIR = "/home/user/.claude/skills/code-review-skill";
const VERCEL_SKILLS = [
  ".claude/skills/vercel-react-best-practices",
  ".claude/skills/vercel-composition-patterns",
  ".claude/skills/web-design-guidelines",
];

// Session scratchpad — council wrapper agents write each external model's
// prompt here before shelling out. Provided by the harness for this session.
const SCRATCH =
  "/private/tmp/claude-501/-Users-wrk-work-customreport/d815e4e1-328d-481f-8bab-80c340658709/scratchpad";

// Optional scope controls (passed via Workflow `args`) for a cheap dry-run that
// validates the live agent->CLI->JSON->schema seam before the full fan-out.
//   { unitLimit: 3, dimLimit: 2 }  -> review 3 units + 2 dimensions, full council
let RUN = {};
try {
  RUN =
    typeof args === "string"
      ? JSON.parse(args)
      : args && typeof args === "object"
        ? args
        : {};
} catch {
  RUN = {};
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const UNIT_SCHEMA = {
  type: "object",
  required: ["units", "coverage"],
  properties: {
    units: {
      type: "array",
      items: {
        type: "object",
        required: [
          "id",
          "paths",
          "subsystem",
          "riskTier",
          "model",
          "references",
        ],
        properties: {
          id: { type: "string" },
          paths: { type: "array", items: { type: "string" } },
          subsystem: {
            enum: ["web", "api", "shared", "ui", "prisma", "tooling"],
          },
          riskTier: { enum: ["high", "medium", "low"] },
          model: { enum: ["opus", "sonnet", "haiku"] },
          references: {
            type: "array",
            items: { type: "string" },
            description: "reference/*.md basenames + vercel skill dirs to load",
          },
          rationale: { type: "string" },
        },
      },
    },
    coverage: {
      type: "object",
      required: ["totalSourceFiles", "coveredFiles", "excludedGlobs"],
      properties: {
        totalSourceFiles: { type: "number" },
        coveredFiles: { type: "number" },
        excludedGlobs: { type: "array", items: { type: "string" } },
        note: { type: "string" },
      },
    },
  },
};

// Dimensions (breadth sweep) reuse the same finding shape as code review, with
// extra dimension keys for the cross-cutting prod-readiness concerns.
const DIMENSION_ENUM = [
  "correctness",
  "security",
  "performance",
  "architecture",
  "maintainability",
  "react",
  "data-integrity",
  "ci-cd",
  "deploy-seam",
  "authz-isolation",
  "observability",
  "supply-chain",
  "config-secrets",
];

const FINDINGS_SCHEMA = {
  type: "object",
  required: ["unitId", "findings"],
  properties: {
    unitId: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        required: [
          "id",
          "file",
          "severity",
          "dimension",
          "claim",
          "evidence",
          "suggestion",
        ],
        properties: {
          id: { type: "string" },
          file: { type: "string" },
          line: { type: "string" },
          severity: { enum: ["Critical", "High", "Medium", "Low"] },
          dimension: { enum: DIMENSION_ENUM },
          claim: { type: "string" },
          evidence: { type: "string" },
          suggestion: { type: "string" },
          confidence: { enum: ["high", "medium", "low"] },
        },
      },
    },
  },
};

const VERDICT_SCHEMA = {
  type: "object",
  required: ["real", "reason", "adjustedSeverity"],
  properties: {
    real: { type: "boolean" },
    reason: { type: "string" },
    adjustedSeverity: { enum: ["Critical", "High", "Medium", "Low", "none"] },
  },
};

const BACKLOG_SCHEMA = {
  type: "object",
  required: ["backlog", "stats"],
  properties: {
    backlog: {
      type: "array",
      items: {
        type: "object",
        required: [
          "id",
          "title",
          "priority",
          "subsystem",
          "files",
          "summary",
          "recommendation",
        ],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          priority: { enum: ["P0", "P1", "P2", "P3"] },
          subsystem: { type: "string" },
          files: { type: "array", items: { type: "string" } },
          summary: { type: "string" },
          recommendation: { type: "string" },
          blastRadius: { type: "string" },
          relatedFindingIds: { type: "array", items: { type: "string" } },
          alreadyTracked: { type: "boolean" },
        },
      },
    },
    stats: { type: "object" },
  },
};

// One council member's independent audit of the candidate backlog.
const COUNCIL_SCHEMA = {
  type: "object",
  required: ["member", "available", "falsePositives", "missed"],
  properties: {
    member: { type: "string" },
    available: { type: "boolean" },
    falsePositives: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "reason"],
        properties: { id: { type: "string" }, reason: { type: "string" } },
      },
    },
    missed: {
      type: "array",
      items: {
        type: "object",
        required: ["title", "severity", "area", "evidence", "suggestion"],
        properties: {
          title: { type: "string" },
          severity: { type: "string" },
          area: { type: "string" },
          evidence: { type: "string" },
          suggestion: { type: "string" },
        },
      },
    },
    notes: { type: "string" },
  },
};

const SYNTH_SCHEMA = {
  type: "object",
  required: ["reportMarkdown", "recommendedChanges"],
  properties: {
    reportMarkdown: {
      type: "string",
      description: "full report body in Russian markdown",
    },
    recommendedChanges: {
      type: "array",
      items: {
        type: "object",
        required: ["changeId", "title", "priority", "scope"],
        properties: {
          changeId: { type: "string" },
          title: { type: "string" },
          priority: { enum: ["P0", "P1", "P2", "P3"] },
          scope: { type: "string" },
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Cross-cutting dimensions — the breadth layer the per-unit code review misses.
// Each is one Opus auditor that fact-finds (not default-refutes) against the
// listed file hints. Findings are tagged kind:"config" so Verify fact-checks
// rather than demanding a positive reachable-path bug.
// ---------------------------------------------------------------------------
const DIMENSIONS = [
  {
    key: "ci-cd",
    title: "CI/CD enforcement & branch protection",
    hint: ".github/workflows/*, package.json scripts, .husky/, turbo.json",
    ask: `Audit whether CI is an ACTUAL gate. Check .github/workflows: are push/PR
triggers active, are runners assigned, do checks actually run on PRs to main, or
are they manual/queued-forever? Are typecheck/lint/test/build/e2e/migrate/docker
required? Are pre-commit/pre-push hooks present and do they match CI? Flag any
gate that exists but does not block a red merge.`,
  },
  {
    key: "deploy-seam",
    title: "Containers & deploy seams",
    hint: "Dockerfile.api, Dockerfile.web, docker-compose*.yml, Caddyfile, deploy configs",
    ask: `Audit production deploy seams. Compare EXPOSE/HEALTHCHECK ports in
Dockerfiles vs the ports/healthchecks in docker-compose.prod.yml. Check the
reverse proxy (Caddy/nginx) routes EVERY backend path the app serves — including
static artifact paths like /pdfs — to the API, not the web app. Check web build
args (NEXT_PUBLIC_*) are not dev-like defaults baked into a prod image. Check
trust-proxy is set if rate-limit/audit rely on req.ip behind a proxy.`,
  },
  {
    key: "authz-isolation",
    title: "AuthN/AuthZ & data isolation",
    hint: "apps/api/src/** (auth, trpc routers, guards, middleware), dev-login",
    ask: `Audit server-side authorization and tenant/group isolation. Enumerate
every publicProcedure / unauthenticated route and judge if it should be public.
Check role checks happen on the SERVER. Hunt IDOR/BOLA: can a lead read/write
another group's section by changing an id? Verify group-scope filters are applied
on every read (no unscoped Prisma queries leaking cross-group rows). Check the
dev-auth fence (AUTH_DEV_MODE / /auth/dev-login) cannot activate in production.
Check the PDF-export token is bound to its report and cannot read another.`,
  },
  {
    key: "data-integrity",
    title: "DB integrity, transactions & concurrency",
    hint: "prisma/schema.prisma, prisma/migrations, apps/api/src/modules/report (save/publish)",
    ask: `Audit persistence integrity. Check section save: is it a delete/recreate
of child rows, and is it exposed to lost-update under two tabs / autosave / retry
(no optimistic locking / version column)? Check report publish for transaction
safety and idempotency (double-publish, partial failure). Check FKs, unique
indexes, cascade behaviour. Flag obvious N+1 in the weekly-report assembly across
leads' sections. Note what breaks once the DB is no longer disposable.`,
  },
  {
    key: "observability",
    title: "Observability & ops diagnosability",
    hint: "apps/api/src telemetry/otel/instrumentation, correlation middleware, logging",
    ask: `Audit whether a 3am incident is diagnosable. Is OpenTelemetry tracing
continuous from tRPC request through Prisma queries? Are correlation/request IDs
propagated and logged? Are auth failures and authorization-denied events logged?
Is there queue/DLQ visibility for the PDF worker? Is sensitive data (tokens, PII)
redacted from logs? Flag blind spots that would make "why did the summary report
hang" unanswerable.`,
  },
  {
    key: "supply-chain",
    title: "Dependencies & supply chain",
    hint: "package.json (root + workspaces), pnpm-lock.yaml, Dockerfiles, openspec/specs/dependency-currency",
    ask: `Audit dependency hygiene. Does install use a frozen lockfile in CI/Docker?
Are versions pinned, and do intentional pins match openspec/specs/dependency-
currency (read it before flagging drift — most "outdated" deps are deliberate)?
Any postinstall scripts running dangerous actions? Are Docker base images current?
Flag only real supply-chain risk, not the documented intentional pins.`,
  },
  {
    key: "config-secrets",
    title: "Config, secrets & prod/dev separation",
    hint: "env schema/validation, apps/api main.ts, apps/web next config, .env.example",
    ask: `Audit config and secret safety. Is production env validated (rejects
AUTH_DEV_MODE, requires real secrets, forbids wildcard CORS)? Do any NEXT_PUBLIC_*
or dev-only feature flags leak dev behaviour into a production client bundle
without a NODE_ENV guard? Check cookie flags (HttpOnly/Secure/SameSite), CSP /
security headers, body-size limits. Flag any debug/dev surface reachable in prod.`,
  },
];

// ---------------------------------------------------------------------------
// Seed findings from a prior external (Codex) static pass on the repo. These
// are CANDIDATES to fact-check against the LIVE tree — several may already be
// fixed (the static pass looked at a possibly-stale mirror). They enter Verify
// with the config fact-check stance, never carried as truth.
// ---------------------------------------------------------------------------
const CODEX_SEEDS = [
  {
    id: "seed-ci-disabled",
    file: ".github/workflows/ci.yml",
    severity: "High",
    dimension: "ci-cd",
    claim:
      "CI is effectively disabled: no runners assigned, push/PR checks queue forever, so CI is manual-only and not a required gate.",
    evidence: "Codex static pass; verify ci.yml triggers + runner config live.",
    suggestion:
      "Restore on: pull_request + push(main), assign a runner, require checks via branch protection.",
  },
  {
    id: "seed-pdfs-caddy",
    file: "Caddyfile / docker-compose.prod.yml",
    severity: "High",
    dimension: "deploy-seam",
    claim:
      "PDF export breaks behind Caddy in prod: /pdfs (express.static, artifactUrl /pdfs/{jobId}.pdf) is not in the API proxy path list, so it routes to web.",
    evidence:
      "Codex static pass; verify the Caddy/proxy path matchers include /pdfs.",
    suggestion:
      "Route /pdfs to API, or replace static URL with an authz-checked download endpoint.",
  },
  {
    id: "seed-optimistic-lock",
    file: "apps/api/src/.../report section save + prisma/schema.prisma",
    severity: "High",
    dimension: "data-integrity",
    claim:
      "No optimistic locking on section save (delete/recreate child rows in a txn); two tabs / autosave / retry can lose updates.",
    evidence:
      "Codex static pass + a schema TODO for version/If-Match; verify save path live.",
    suggestion:
      "Add ReportSection.version, update where {id,version}, 409 on count=0.",
  },
  {
    id: "seed-trust-proxy",
    file: "apps/api/src/main.ts",
    severity: "Medium",
    dimension: "deploy-seam",
    claim:
      "trust proxy not set: rate-limit/audit read req.ip but main.ts does not call app.set('trust proxy', 1), so all users look like the proxy IP behind Caddy.",
    evidence:
      "Codex static pass; verify main.ts bootstrap for an express trust-proxy set.",
    suggestion:
      "Set trust proxy on the express instance; test req.ip resolves.",
  },
  {
    id: "seed-port-mismatch",
    file: "Dockerfile.api vs docker-compose.prod.yml",
    severity: "Medium",
    dimension: "deploy-seam",
    claim:
      "API port mismatch: Dockerfile.api EXPOSE/HEALTHCHECK uses 3002 while compose maps/healthchecks 3001; the image as a standalone artifact has a wrong healthcheck.",
    evidence: "Codex static pass; verify both files' ports live.",
    suggestion: "Unify the port (PORT env) across Dockerfile + compose.",
  },
  {
    id: "seed-web-build-args",
    file: "Dockerfile.web",
    severity: "Medium",
    dimension: "config-secrets",
    claim:
      "Dockerfile.web bakes dev-like NEXT_PUBLIC defaults (AUTH_STUB=true, DEV_ROLE_SWITCHER=true) into the prod build; risky if any consumer lacks a NODE_ENV guard.",
    evidence: "Codex static pass; verify Dockerfile.web ARG defaults live.",
    suggestion:
      "Default these false in the prod image; pass real values via compose build args.",
  },
];

// ---------------------------------------------------------------------------
// Phase 0 — Inventory (Sonnet)
// ---------------------------------------------------------------------------
phase("Inventory");
const inv = await agent(
  `You are scoping a whole-repo code review of the CustomReport monorepo.

Use Bash (\`git ls-files\`) and Read to enumerate ALL source under:
  apps/web/src, apps/api/src, packages/shared, packages/ui, prisma.
Exclude: *.test.*, *.spec.*, __tests__, __snapshots__, *.d.ts, generated Prisma
client, dist/build output.

Group the remaining source into coherent REVIEW UNITS — one unit per cohesive
module/directory (e.g. apps/api/src/modules/report, apps/web/src/components/slides).
Aim for ~30-55 units that together cover 100% of non-excluded source. A unit
holds a handful to ~25 files.

For each unit assign:
- subsystem: web | api | shared | ui | prisma | tooling
- riskTier + model:
    HIGH  -> model "opus":  auth/authz, tRPC routers, prisma schema+migrations,
             report query/services, money/permission/visibility logic, shared
             zod contracts, anything touching data integrity or access control.
    MEDIUM-> model "sonnet": general web components, ui primitives, generic api
             modules, hooks, infrastructure wiring.
    LOW   -> model "haiku": pure config, static assets wiring, thin barrels.
- references: which code-review-skill reference/*.md basenames apply
    (typescript, react, nestjs, css-less-sass, architecture-review-guide,
     security-review-guide, performance-review-guide, common-bugs-checklist,
     code-quality-universal) PLUS, for web/ui units, the literal tokens
     "vercel-react", "vercel-composition", "web-design-guidelines".

Return the unit list and a coverage block (counts + excluded globs). Be honest
about anything you could not place.`,
  {
    label: "inventory",
    phase: "Inventory",
    model: "sonnet",
    effort: "medium",
    schema: UNIT_SCHEMA,
  },
);

if (!inv || !inv.units || inv.units.length === 0) {
  log("Inventory returned no units — aborting.");
  return { error: "inventory-empty" };
}
// Deterministic safety net: known hot paths get Opus + high risk regardless of
// how Phase 0 tagged them. Removes the dependency on inventory's risk judgment.
const HOT =
  /(auth|authz|permission|visibility|prisma|migration|report|trpc|router|guard|access|packages\/shared)/i;
const allUnits = inv.units.map((u) =>
  (u.paths || []).some((p) => HOT.test(p))
    ? { ...u, riskTier: "high", model: "opus" }
    : u,
);
const forced = allUnits.filter(
  (u, i) => u.model === "opus" && inv.units[i]?.model !== "opus",
).length;
if (forced > 0) log(`Hot-path override: ${forced} unit(s) forced to Opus.`);

// Scope controls for a dry-run; default to the full set.
const units = RUN.unitLimit ? allUnits.slice(0, RUN.unitLimit) : allUnits;
const dims =
  RUN.dimLimit != null ? DIMENSIONS.slice(0, RUN.dimLimit) : DIMENSIONS;
if (RUN.unitLimit || RUN.dimLimit != null) {
  log(
    `DRY-RUN scope: ${units.length}/${allUnits.length} units, ${dims.length}/${DIMENSIONS.length} dimensions.`,
  );
}
log(
  `Inventory: ${allUnits.length} units, coverage ${inv.coverage?.coveredFiles}/${inv.coverage?.totalSourceFiles} files. ` +
    `models: opus=${allUnits.filter((u) => u.model === "opus").length} ` +
    `sonnet=${allUnits.filter((u) => u.model === "sonnet").length} ` +
    `haiku=${allUnits.filter((u) => u.model === "haiku").length}`,
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const refList = (refs) =>
  (refs || [])
    .map((r) => {
      if (r === "vercel-react") return VERCEL_SKILLS[0];
      if (r === "vercel-composition") return VERCEL_SKILLS[1];
      if (r === "web-design-guidelines") return VERCEL_SKILLS[2];
      return `${SKILL_DIR}/reference/${r.replace(/\.md$/, "")}.md`;
    })
    .join("\n  - ");

// Severity -> verifier model. High/Critical and any security finding get Opus.
const verifierModel = (f) =>
  f.severity === "Critical" ||
  f.severity === "High" ||
  f.dimension === "security" ||
  f.dimension === "authz-isolation"
    ? "opus"
    : "sonnet";

// One verify agent for a single finding, branching stance by finding kind.
// presence -> default-refute (must exhibit the bug on a reachable path).
// config   -> fact-check (confirm/refute the stated misconfig/absence as fact).
const verifyFinding = (f, unitId) => {
  const isConfig = f.kind === "config";
  const stance = isConfig
    ? `You are FACT-CHECKING a configuration/absence finding against the LIVE tree.
This is NOT a reachable-path bug check — the claim is that something is
MISCONFIGURED or MISSING. Read the cited file(s) and related config and decide
whether the stated misconfiguration/absence ACTUALLY holds in the current code.
Confirm (real:true) only if it genuinely holds now. Refute (real:false,
adjustedSeverity:"none") if the config is actually correct/present — the claim may
be STALE (a fix already landed) or misread the setup. Adjust severity if real but
mis-rated.`
    : `Adversarially verify ONE code-review finding. Your default is REFUTED — only
confirm if the code genuinely exhibits the problem on a REACHABLE path. Reject if
the code does not do what the claim says, the path is unreachable, it is an
intended repo convention below, or the evidence is too thin. Adjust severity if
the claim is real but mis-rated (use "none" if not real).`;
  return agent(
    `${stance}

UNIT: ${unitId}
FINDING [${f.severity}/${f.dimension}] ${f.file}:${f.line || "?"}
CLAIM: ${f.claim}
EVIDENCE GIVEN: ${f.evidence}

Open the cited file(s) with Read/Grep and check against the ACTUAL code.

${REPO_GUARDRAILS}`,
    {
      label: `verify:${unitId}:${f.id}`,
      phase: "Verify",
      model: verifierModel(f),
      effort: verifierModel(f) === "opus" ? "high" : "medium",
      schema: VERDICT_SCHEMA,
    },
  ).then((v) => (v ? { ...f, unitId, verdict: v } : null));
};

// ---------------------------------------------------------------------------
// Phase 1 + Verify (presence) — code review then verify, pipelined per unit.
// Each unit's findings start verifying as soon as that unit's review lands.
// ---------------------------------------------------------------------------
const perUnit = await pipeline(
  units,
  (unit) =>
    agent(
      `You are a senior code reviewer applying the "code-review-skill" to ONE unit
of the CustomReport monorepo.

UNIT: ${unit.id}  (subsystem: ${unit.subsystem}, risk: ${unit.riskTier})
FILES:
  - ${unit.paths.join("\n  - ")}

FIRST read the skill and the references that apply, then review:
  - ${SKILL_DIR}/SKILL.md
  - ${refList(unit.references) || "(no extra references)"}
Apply the skill's 4-phase review and severity labels. For Vercel skill dirs,
read their SKILL.md for the rules. If a code-review-skill path is missing,
locate it with \`ls ~/.claude/skills\` and read from there.

Then Read/Grep the actual unit files and report ONLY substantive findings with
file:line and concrete evidence. Prefer few high-confidence findings over many
weak ones. If the unit is clean, return an empty findings array.

${REPO_GUARDRAILS}`,
      {
        label: `review:${unit.id}`,
        phase: "Review",
        model: unit.model,
        effort: unit.model === "opus" ? "high" : "medium",
        schema: FINDINGS_SCHEMA,
      },
    ),
  (review, unit) => {
    if (!review || !review.findings || review.findings.length === 0) return [];
    return parallel(
      review.findings.map(
        (f) => () => verifyFinding({ ...f, kind: "presence" }, unit.id),
      ),
    );
  },
);

// ---------------------------------------------------------------------------
// Phase 2 — Dimension sweep (breadth), then fact-check verify. Each dimension
// auditor runs in parallel with the per-unit pipeline above conceptually; we
// await both. Dimension + seed findings are kind:"config".
// ---------------------------------------------------------------------------
phase("Dimensions");
const dimResults = await parallel(
  dims.map(
    (d) => () =>
      agent(
        `You are a Principal Engineer auditing ONE cross-cutting dimension of the
CustomReport monorepo for production readiness. This is a FACT-FINDING audit of
configuration and absence, not a hunt for reachable-path code bugs.

DIMENSION: ${d.title}
WHERE TO LOOK (hints, not limits): ${d.hint}

${d.ask}

Use Read/Grep/Bash to inspect the ACTUAL files. Report ONLY concrete, evidenced
findings (file:line or config block). For each, set dimension to "${d.key}" (or a
more specific enum value if clearly better). Prefer few well-evidenced findings
over speculation. If the dimension is genuinely healthy, return an empty array.

${REPO_GUARDRAILS}`,
        {
          label: `dim:${d.key}`,
          phase: "Dimensions",
          model: "opus",
          effort: "high",
          schema: FINDINGS_SCHEMA,
        },
      ),
  ),
);

// Collect config candidates: dimension findings + Codex seeds.
const dimFindings = dimResults.filter(Boolean).flatMap((r, i) =>
  (r.findings || []).map((f) => ({
    ...f,
    kind: "config",
    source: `dim:${dims[i]?.key || "?"}`,
  })),
);
const seedCandidates = CODEX_SEEDS.map((f) => ({
  ...f,
  kind: "config",
  source: "codex-seed",
}));
const configCandidates = [...dimFindings, ...seedCandidates];
log(
  `Dimensions: ${dimFindings.length} config findings + ${seedCandidates.length} Codex seeds = ${configCandidates.length} to fact-check.`,
);

// Fact-check verify all config candidates.
phase("Verify");
const configVerified = await parallel(
  configCandidates.map((f) => () => verifyFinding(f, f.source)),
);

// ---------------------------------------------------------------------------
// Merge confirmed findings (presence + config).
// ---------------------------------------------------------------------------
const keepConfirmed = (arr) =>
  arr
    .filter(Boolean)
    .filter(
      (f) =>
        f.verdict && f.verdict.real && f.verdict.adjustedSeverity !== "none",
    )
    .map((f) => ({ ...f, severity: f.verdict.adjustedSeverity }));

const presenceConfirmed = keepConfirmed(perUnit.filter(Boolean).flat());
const configConfirmed = keepConfirmed(configVerified);
const confirmed = [...presenceConfirmed, ...configConfirmed];

log(
  `Verify: ${confirmed.length} confirmed (${presenceConfirmed.length} code + ${configConfirmed.length} config) survived adversarial review.`,
);
if (confirmed.length === 0) {
  return {
    units: units.length,
    dimensions: dims.length,
    confirmed: [],
    note: "no confirmed findings",
  };
}

// ---------------------------------------------------------------------------
// Phase 3 — Prioritize (Opus). Barrier: needs ALL confirmed findings.
// Dedup target fixed: the openspec specs that absorbed the old code-health-map.
// ---------------------------------------------------------------------------
phase("Prioritize");
const prioritized = await agent(
  `You are triaging confirmed review findings for the CustomReport repo into a
prioritized remediation backlog.

CONFIRMED FINDINGS (JSON):
${JSON.stringify(confirmed, null, 2)}

Read these existing backlog specs and mark any backlog item already covered there
(alreadyTracked:true) so we do not duplicate tracked work:
  - openspec/specs/architecture-refactor-backlog/spec.md
  - openspec/specs/code-quality-modernization/spec.md
Also run \`openspec list\` (Bash) and skim spec names for obvious overlaps.

Cluster related findings into backlog items. Assign:
  P0 = security / data-loss / broken correctness / deploy blocker
  P1 = real bug, architecture debt, hidden regression/perf risk
  P2 = maintainability/complexity/missing-telemetry debt
  P3 = cleanup / naming / cosmetic
Give each item a blast-radius note and a concrete recommendation. Order P0 first.`,
  {
    label: "prioritize",
    phase: "Prioritize",
    model: "opus",
    effort: "high",
    schema: BACKLOG_SCHEMA,
  },
);

const backlog = prioritized?.backlog || [];

// ---------------------------------------------------------------------------
// Phase 4 — COUNCIL. 4 external models independently audit the candidate
// backlog for false positives AND misses, read-only, via watchdog-wrapped CLIs.
// Each member is a thin relay agent: writes the prompt to a file, runs the CLI,
// parses the model's JSON answer, returns it. Best-effort: a member that fails
// degrades to available:false and never aborts the run.
// ---------------------------------------------------------------------------
phase("Council");
const backlogJson = JSON.stringify(backlog, null, 2);
const councilExtPrompt = `You are an INDEPENDENT senior engineer auditing a candidate remediation backlog for the CustomReport monorepo. Your current working directory IS the repo. You are STRICTLY READ-ONLY — inspect real files freely, change nothing.

Two jobs:
1. FALSE POSITIVES — which listed items are wrong, not real, stale, or misjudged? Give the item id + a one-line reason.
2. MISSED (false negatives) — what SERIOUS issues are NOT in this list? Actively inspect the repo: .github/workflows (CI triggers / required checks), Dockerfile* + docker-compose* + Caddyfile (ports, healthchecks, reverse-proxy routing of every backend path, build args, trust proxy), apps/api auth + tRPC procedures (public procedures, server-side role checks, IDOR / group isolation), prisma schema + report publish (transactions, lost-update, idempotency), telemetry/OTel + correlation IDs, env validation + NEXT_PUBLIC leakage, dependency pinning. Give title / severity (Critical|High|Medium|Low) / area / evidence (file:line) / suggestion.

Be specific and evidence-based. Do NOT invent. Respect repo conventions: hardcoded Russian is only a bug in apps/web JSX; ComingSoon is intentional; a single init migration is intentional; English-only prod UI is intentional.

Return ONLY a single minified JSON object, no prose, no markdown fence:
{"falsePositives":[{"id":"","reason":""}],"missed":[{"title":"","severity":"","area":"","evidence":"","suggestion":""}],"notes":""}

CANDIDATE BACKLOG (JSON):
${backlogJson}`;

const COUNCIL = [
  { member: "codex", kind: "codex", modelId: "(default)" },
  { member: "kimi", kind: "opencode", modelId: "opencode-go/kimi-k2.7-code" },
  { member: "qwen", kind: "opencode", modelId: "opencode-go/qwen3.7-max" },
  { member: "glm", kind: "opencode", modelId: "opencode-go/glm-5.2" },
];

const councilBash = (m) => {
  const file = `${SCRATCH}/council-${m.member}.txt`;
  if (m.kind === "codex") {
    return {
      file,
      runAndExtract: `O=$(mktemp)
codex exec -s read-only --json "$(cat '${file}')" > "$O" 2>/dev/null &
P=$!; ( sleep 600; kill -9 $P 2>/dev/null ) & W=$!
wait $P 2>/dev/null; kill -9 $W 2>/dev/null
# Codex final answer = last item.completed agent_message .item.text :
grep '"type":"item.completed"' "$O" | tail -1`,
      note: "Parse the agent_message .item.text (a JSON object).",
    };
  }
  return {
    file,
    runAndExtract: `O=$(mktemp)
opencode run -m ${m.modelId} "$(cat '${file}')" --format json > "$O" 2>/dev/null &
P=$!; ( sleep 600; kill -9 $P 2>/dev/null ) & W=$!
wait $P 2>/dev/null; kill -9 $W 2>/dev/null
# OpenCode final answer = the last text part's .part.text :
grep '"type":"text"' "$O" | tail -1`,
    note: "Parse the .part.text field (a JSON object; strip any markdown fence).",
  };
};

const councilRaw = await parallel(
  COUNCIL.map((m) => () => {
    const b = councilBash(m);
    return agent(
      `You are a RELAY for an external reviewer model ("${m.member}", ${m.modelId}).
Run it over our candidate backlog and return ITS verdict — do NOT substitute your
own judgment, do NOT review the code yourself.

Steps:
1. Use the Write tool to save the EXTERNAL PROMPT below — everything between the
   markers <<<PROMPT_BEGIN>>> and <<<PROMPT_END>>>, exclusive, VERBATIM — to this
   exact path:
     ${b.file}
2. Run the external model READ-ONLY with a mandatory watchdog (it can hang) using
   Bash, exactly:
${b.runAndExtract}
3. ${b.note} It will contain {"falsePositives":[...],"missed":[...],"notes":""}.
4. Return that parsed object as your structured output, adding member:"${m.member}"
   and available:true. If the output is empty / timed out / unparseable, return
   member:"${m.member}", available:false, falsePositives:[], missed:[], and a
   notes string explaining what went wrong.

<<<PROMPT_BEGIN>>>
${councilExtPrompt}
<<<PROMPT_END>>>`,
      {
        label: `council:${m.member}`,
        phase: "Council",
        model: "sonnet",
        effort: "medium",
        schema: COUNCIL_SCHEMA,
      },
    );
  }),
);

const council = councilRaw.filter(Boolean);
const councilUp = council.filter((c) => c.available);
log(
  `Council: ${councilUp.length}/${COUNCIL.length} members responded. ` +
    `FPs flagged: ${councilUp.reduce((n, c) => n + (c.falsePositives?.length || 0), 0)}, ` +
    `misses raised: ${councilUp.reduce((n, c) => n + (c.missed?.length || 0), 0)}.`,
);

// ---------------------------------------------------------------------------
// Phase 5 — Synthesize report + recommended OpenSpec changes (Opus).
// Reconciles the Claude-verified backlog with the council's independent views.
// ---------------------------------------------------------------------------
phase("Synthesize");
const synth = await agent(
  `Write the final repo-excellence review report for CustomReport, in RUSSIAN
markdown, following the repo's house style (one idea per line, lead with the
bottom line, no chained facts).

CLAUDE-VERIFIED BACKLOG (JSON):
${JSON.stringify(backlog, null, 2)}

COUNCIL — independent audits by 4 external models (Codex, Kimi, Qwen, GLM):
${JSON.stringify(council, null, 2)}

Reconcile, do not just concatenate:
- If a MAJORITY of responding council members call a backlog item a false
  positive (with a credible reason), demote or drop it and say so.
- Fold council "missed" items into the backlog when credible and not already
  present; mark them source:"council" and note which member(s) raised them. Treat
  an item raised by 2+ members as higher confidence.
- Keep an item already verified by Claude even if one member dislikes it, unless
  the refutation is clearly correct.

The report MUST contain, in order:
1. Bottom line: counts P0/P1/P2/P3, overall repo-health read (RED/YELLOW/GREEN),
   production-readiness read.
2. A table of P0+P1 items (title, subsystem, files, recommendation).
3. P2/P3 summarized compactly.
4. A "Консилиум" section: which members responded, notable agreements/conflicts,
   council-only misses that were promoted into the backlog.
5. A "Что НЕ сочли проблемой" note on items excluded by repo conventions or
   refuted on verification (incl. any stale Codex seeds).
6. A recommended ordering of OpenSpec changes to remediate (titles + one-line
   scope), excluding anything already tracked in the openspec specs.

Return reportMarkdown (the full body) and recommendedChanges (structured list).
Do NOT write files — return the content as your structured output.`,
  {
    label: "synthesize",
    phase: "Synthesize",
    model: "opus",
    effort: "high",
    schema: SYNTH_SCHEMA,
  },
);

return {
  unitsReviewed: units.length,
  dimensionsAudited: dims.length,
  coverage: inv.coverage,
  presenceConfirmed: presenceConfirmed.length,
  configConfirmed: configConfirmed.length,
  confirmedCount: confirmed.length,
  backlog,
  stats: prioritized?.stats || {},
  council,
  reportMarkdown: synth?.reportMarkdown || "",
  recommendedChanges: synth?.recommendedChanges || [],
};
