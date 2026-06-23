export const meta = {
  name: "repo-excellence-review",
  description:
    "Whole-repo, multi-model code review driven by the code-review-skill + Vercel skills; produces a verified P0-P3 backlog (report + OpenSpec change list). Review only — no autonomous fixes.",
  phases: [
    {
      title: "Inventory",
      detail: "classify source into review units + risk tier + model (Sonnet)",
    },
    {
      title: "Review",
      detail:
        "one skill-powered reviewer per unit, model by risk (Sonnet/Opus)",
    },
    {
      title: "Verify",
      detail: "adversarial skeptic per finding, default-refute (Sonnet/Opus)",
    },
    {
      title: "Prioritize",
      detail: "dedup + P0-P3 + blast radius, dedup vs code-health-map (Opus)",
    },
    {
      title: "Synthesize",
      detail: "report + recommended OpenSpec changes (Opus)",
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
const SKILL_DIR = "/Users/wrk/.claude/skills/code-review-skill";
const VERCEL_SKILLS = [
  ".claude/skills/vercel-react-best-practices",
  ".claude/skills/vercel-composition-patterns",
  ".claude/skills/web-design-guidelines",
];

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
          dimension: {
            enum: [
              "correctness",
              "security",
              "performance",
              "architecture",
              "maintainability",
              "react",
              "data-integrity",
            ],
          },
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
          alreadyInCodeHealthMap: { type: "boolean" },
        },
      },
    },
    stats: { type: "object" },
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
// Phase 0 — Inventory (Haiku, mechanical)
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
const units = inv.units.map((u) =>
  (u.paths || []).some((p) => HOT.test(p))
    ? { ...u, riskTier: "high", model: "opus" }
    : u,
);
const forced = units.filter(
  (u, i) => u.model === "opus" && inv.units[i]?.model !== "opus",
).length;
if (forced > 0) log(`Hot-path override: ${forced} unit(s) forced to Opus.`);
log(
  `Inventory: ${units.length} units, coverage ${inv.coverage?.coveredFiles}/${inv.coverage?.totalSourceFiles} files. ` +
    `models: opus=${units.filter((u) => u.model === "opus").length} ` +
    `sonnet=${units.filter((u) => u.model === "sonnet").length} ` +
    `haiku=${units.filter((u) => u.model === "haiku").length}`,
);

// ---------------------------------------------------------------------------
// Helper — resolve reference file paths + vercel skill dirs for a unit
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
  f.dimension === "security"
    ? "opus"
    : "sonnet";

// ---------------------------------------------------------------------------
// Phases 1+2 — Review then Verify, pipelined per unit (no barrier between).
// Each unit's findings start verifying as soon as that unit's review lands.
// ---------------------------------------------------------------------------
const perUnit = await pipeline(
  units,
  // Stage 1: skill-powered review of one unit
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
  // Stage 2: adversarial verify, one skeptic per finding, default-refute
  (review, unit) => {
    if (!review || !review.findings || review.findings.length === 0) return [];
    return parallel(
      review.findings.map(
        (f) => () =>
          agent(
            `Adversarially verify ONE code-review finding. Your default is REFUTED —
only confirm if the code genuinely exhibits the problem on a reachable path.

UNIT: ${unit.id}
FINDING [${f.severity}/${f.dimension}] ${f.file}:${f.line || "?"}
CLAIM: ${f.claim}
EVIDENCE GIVEN: ${f.evidence}

Open the cited file(s) with Read/Grep and check the claim against the ACTUAL
code. Reject if: the code does not do what the claim says, the path is
unreachable, it is an intended repo convention below, or evidence is too thin.
Adjust severity if the claim is real but mis-rated (use "none" if not real).

${REPO_GUARDRAILS}`,
            {
              label: `verify:${unit.id}:${f.id}`,
              phase: "Verify",
              model: verifierModel(f),
              effort: verifierModel(f) === "opus" ? "high" : "medium",
              schema: VERDICT_SCHEMA,
            },
          ).then((v) => (v ? { ...f, unitId: unit.id, verdict: v } : null)),
      ),
    );
  },
);

// Flatten confirmed findings across all units.
const confirmed = perUnit
  .filter(Boolean)
  .flat()
  .filter(Boolean)
  .filter(
    (f) => f.verdict && f.verdict.real && f.verdict.adjustedSeverity !== "none",
  )
  .map((f) => ({ ...f, severity: f.verdict.adjustedSeverity }));

log(
  `Verify: ${confirmed.length} confirmed findings survived adversarial review.`,
);
if (confirmed.length === 0) {
  return { units: units.length, confirmed: [], note: "no confirmed findings" };
}

// ---------------------------------------------------------------------------
// Phase 3 — Prioritize (Opus, judgment). Barrier: needs ALL confirmed findings.
// ---------------------------------------------------------------------------
phase("Prioritize");
const prioritized = await agent(
  `You are triaging confirmed code-review findings for the CustomReport repo into
a prioritized remediation backlog.

CONFIRMED FINDINGS (JSON):
${JSON.stringify(confirmed, null, 2)}

Also Read docs/code-health-map.md (an already-approved code-health map from a
prior session) and mark any backlog item that is ALREADY covered there
(alreadyInCodeHealthMap: true) so we do not duplicate that work.

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

// ---------------------------------------------------------------------------
// Phase 4 — Synthesize report + recommended OpenSpec changes (Opus)
// ---------------------------------------------------------------------------
phase("Synthesize");
const synth = await agent(
  `Write the final repo-excellence review report for CustomReport, in RUSSIAN
markdown, following the repo's house style (one idea per line, lead with the
bottom line, no chained facts).

PRIORITIZED BACKLOG (JSON):
${JSON.stringify(prioritized?.backlog || [], null, 2)}

The report MUST contain:
1. Bottom line: how many P0/P1/P2/P3, overall repo-health read.
2. A table of P0+P1 items (title, subsystem, files, recommendation).
3. P2/P3 summarized compactly.
4. A short "что НЕ нашли проблемой" note on items deliberately excluded by repo
   conventions.
5. A recommended ordering of OpenSpec changes to remediate (titles + one-line
   scope), excluding anything already in docs/code-health-map.md.

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
  coverage: inv.coverage,
  confirmedCount: confirmed.length,
  backlog: prioritized?.backlog || [],
  stats: prioritized?.stats || {},
  reportMarkdown: synth?.reportMarkdown || "",
  recommendedChanges: synth?.recommendedChanges || [],
};
