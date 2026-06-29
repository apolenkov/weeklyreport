export const meta = {
  name: "exemplary-rollout",
  description:
    "Bring folders to the Exemplary Code Standard: recon → violation inventory → fix plan → adversarial plan review (optional guarded fix stage).",
  whenToUse:
    "Run in the UltraCode session to roll out docs/exemplary-code-standard.md folder-by-folder. Recon+plan by default; flip FIX_ENABLED only after calibrating on one module.",
  phases: [
    { title: "Recon" },
    { title: "Plan" },
    { title: "Review" },
    { title: "Fix" },
  ],
};

// Safety: produce inventories + reviewed fix plans by default. Auto-editing the
// whole repo unattended is the "parallel-army revert-bait" hazard (army refactors
// pass the gate but break behaviour). Keep FIX_ENABLED=false; turn it on per run
// only after a human calibrates on one module. The fix stage isolates each folder
// in its own git worktree and gates before keeping anything.
const FIX_ENABLED = false;

// Embed the work-list (Workflow args don't thread reliably via scriptPath here —
// memory workflow-args-do-not-thread-embed-instead). Edit this list per run;
// start with ONE folder to calibrate, then scale.
const TARGET_FOLDERS = [
  "apps/api/src/modules/period",
  "apps/api/src/modules/reminders",
  "apps/api/src/modules/pdf-export",
  "apps/api/src/modules/admin",
  "apps/api/src/modules/report-sections",
  "apps/api/src/modules/organization",
  "apps/api/src/infrastructure",
];

const STANDARD = `Exemplary Code Standard (docs/exemplary-code-standard.md):
- files < 250 lines; functions <= 50 lines; cognitive complexity < 10; cyclomatic complexity <= 10.
- functional & immutable: const only, no let/reassignment/in-place mutation/param mutation; map/filter/reduce/spread.
- NO fallbacks/defaults for product config (no '?? localhost', no zod .default for product vars); requireEnv; explicit per env file; fail loud.
- NO non-obvious magic literals (e.g. bare "draft-7"): name+document or remove.
- comment hygiene: delete change-log/ticket/phase archaeology (Phase 35-08, UFB-036, AUTH-08, FIX-02, R3a-4, ...); keep load-bearing WHY rewritten without the prefix; never narrate what the code says.
- exemplary WITHOUT exemption: eslint clean with --max-warnings 0 (zero errors AND zero warnings) and NO eslint.config.ts exempt/override entry for the file.
- a module owns only its domain; cross-domain logic delegated via injection at the composition root.`;

const INVENTORY_SCHEMA = {
  type: "object",
  required: ["folder", "files", "violations", "exemptions", "crossDomain"],
  properties: {
    folder: { type: "string" },
    files: { type: "integer" },
    violations: {
      type: "array",
      items: {
        type: "object",
        required: ["file", "kind", "detail"],
        properties: {
          file: { type: "string" },
          kind: {
            type: "string",
            enum: [
              "file-too-long",
              "function-too-long",
              "complexity",
              "mutation",
              "fallback-or-default",
              "magic-literal",
              "comment-archaeology",
              "other",
            ],
          },
          detail: { type: "string" },
        },
      },
    },
    exemptions: {
      type: "array",
      items: { type: "string" },
      description:
        "eslint.config.ts exempt/override entries pointing at this folder",
    },
    crossDomain: {
      type: "array",
      items: { type: "string" },
      description:
        "logic that belongs to another module (delegate-out candidates)",
    },
  },
};

const PLAN_SCHEMA = {
  type: "object",
  required: ["folder", "steps", "riskNotes"],
  properties: {
    folder: { type: "string" },
    steps: {
      type: "array",
      items: {
        type: "object",
        required: ["order", "action", "files", "rationale"],
        properties: {
          order: { type: "integer" },
          action: { type: "string" },
          files: { type: "array", items: { type: "string" } },
          rationale: { type: "string" },
        },
      },
    },
    riskNotes: { type: "array", items: { type: "string" } },
  },
};

const REVIEW_SCHEMA = {
  type: "object",
  required: ["folder", "approved", "gaps"],
  properties: {
    folder: { type: "string" },
    approved: { type: "boolean" },
    gaps: { type: "array", items: { type: "string" } },
  },
};

log(
  `exemplary-rollout: ${TARGET_FOLDERS.length} folders, FIX_ENABLED=${FIX_ENABLED}`,
);

// Pipeline: each folder flows recon → plan → review independently (no barrier).
const results = await pipeline(
  TARGET_FOLDERS,
  (folder) =>
    agent(
      `Recon ${folder} against the standard. Read every file (use codegraph_explore). Run a strict local eslint over it if helpful. Produce a complete violation inventory: every file > 250 lines, every function > 50 lines, complexity hot-spots, every let/mutation/param-reassign, every '?? <fallback>' or zod .default on product config, every non-obvious magic literal, every eslint.config.ts exemption that names this folder, and any cross-domain logic the module wrongly owns.\n\n${STANDARD}`,
      { label: `recon:${folder}`, phase: "Recon", schema: INVENTORY_SCHEMA },
    ),
  (inventory, folder) =>
    agent(
      `Given this violation inventory for ${folder}, write an ordered fix plan that reaches the standard WITHOUT changing behaviour: delegate-out cross-domain logic via injection, split files < 250 lines, extract functions <= 50 lines / complexity < 10, remove fallbacks/magic, enforce immutability, then DELETE the folder's eslint exemptions and confirm green. Each step: action, files, rationale. Call out behaviour-risk.\n\nInventory:\n${JSON.stringify(inventory)}\n\n${STANDARD}`,
      { label: `plan:${folder}`, phase: "Plan", schema: PLAN_SCHEMA },
    ),
  (plan, folder) =>
    agent(
      `Adversarially review this fix plan for ${folder}. Default to NOT approved if any step risks behaviour change, hides a fallback instead of making the value required, or would leave an eslint exemption in place. List concrete gaps.\n\nPlan:\n${JSON.stringify(plan)}`,
      {
        label: `review:${folder}`,
        phase: "Review",
        schema: REVIEW_SCHEMA,
        effort: "high",
      },
    ).then((review) => ({ folder, plan, review })),
);

const ready = results.filter(Boolean).filter((r) => r.review?.approved);
const blocked = results.filter(Boolean).filter((r) => !r.review?.approved);
log(`plans ready: ${ready.length}; blocked (need human): ${blocked.length}`);

// Optional guarded fix stage — only when explicitly enabled. Each folder is
// fixed in its OWN worktree so parallel edits cannot clobber each other; the
// agent must run gates and revert its own worktree if anything is red.
let fixed = [];
if (FIX_ENABLED && ready.length > 0) {
  fixed = await parallel(
    ready.map(
      (r) => () =>
        agent(
          `Apply this APPROVED fix plan for ${r.folder} exactly. After editing: run \`pnpm typecheck && pnpm lint && pnpm test\` (regenerate the prisma client first). If anything is red OR behaviour might have changed, STOP and report failed=true with the error — do not force it green. Remove the folder's eslint.config.ts exemptions and confirm lint passes without them. Report what changed and the gate result.\n\nPlan:\n${JSON.stringify(r.plan)}\n\n${STANDARD}`,
          {
            label: `fix:${r.folder}`,
            phase: "Fix",
            isolation: "worktree",
            schema: {
              type: "object",
              required: ["folder", "applied", "gatesGreen", "notes"],
              properties: {
                folder: { type: "string" },
                applied: { type: "boolean" },
                gatesGreen: { type: "boolean" },
                notes: { type: "string" },
              },
            },
          },
        ),
    ),
  );
}

return {
  folders: TARGET_FOLDERS.length,
  plansReady: ready.map((r) => r.folder),
  blocked: blocked.map((r) => ({ folder: r.folder, gaps: r.review?.gaps })),
  inventories: results
    .filter(Boolean)
    .map((r) => ({ folder: r.folder, plan: r.plan })),
  fixed: fixed.filter(Boolean),
};
