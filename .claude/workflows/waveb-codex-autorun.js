export const meta = {
  name: "waveb-codex-autorun",
  description:
    "Autonomously implement (Codex lane) -> 2 Claude adversarial verifiers -> full gate + integration -> optional live browser verify -> commit a LIST of OpenSpec changes sequentially on the shared tree. Cross-vendor by construction: GPT writes, Claude reviews. High-stakes changes halt for the orchestrator to diff-review and commit. Git is the resume checkpoint: a change whose name already appears in git log after BASE_SHA is skipped.",
  phases: [
    { title: "Preflight" },
    { title: "Implement" },
    { title: "Verify" },
    { title: "Gate" },
    { title: "LiveVerify" },
    { title: "Commit" },
  ],
};

const REPO = "/Users/wrk/work/customreport";
const BASE_SHA = "d5642688";

const STANDARDS = [
  "Exemplary code standard: functional/immutable (const, pure fns, map/filter/reduce + spread; avoid let/mutation); files < 250 lines; functions <= 50 lines; cognitive complexity < 10.",
  'NO fallbacks / silent defaults for product config (no `?? "localhost"`, no `.default()` in env.schema). Mandatory vars are REQUIRED (Zod, no default) read via requireEnv; boot fails loud. THIS STANDARD OVERRIDES any change design.md that proposes a `.default()` or in-code fallback — reconcile to requireEnv + compose `${VAR:?}` in compose files.',
  "UI strings in apps/web/**/*.tsx stay English (JSX/toast/aria/placeholder). Russian only in DB/seed data, comments, test fixtures.",
  "Comment hygiene: NO ticket/phase/change-slug prefixes (no `BL-xx`, `Phase X`, change names) in comments. Explain the WHY of current code only; never narrate what the code already says.",
  "Strict lint rules are ERRORS and bite mid-edit: require-await, no-unnecessary-condition, prefer-string-raw, jsdoc-on-private-helper, x-powered-by. Changed paths MUST pass `eslint --max-warnings 0`.",
  "Reuse canonical helpers (e.g. groupScopeFilter from apps/api/src/lib/group-scope.ts). tRPC procedures MUST use one of the 8 canonical middleware-chain builders (matched by reference identity) — never hand-roll a chain.",
  "Period dual-state invariant: a Report write updates BOTH the new period state AND the legacy period tuple, atomically.",
];

// ----- per-run config: the change LIST. Edit this, re-run with the same scriptPath. -----
// stakes: "low"  -> the workflow commits the change itself when gate-green + no blocker.
// stakes: "high" -> the workflow STOPS short of commit and returns commitReady + paths
//                   for the orchestrator to diff-review and commit.
// liveVerify: true -> after a green gate, a live browser drive of the proposal's
//                     verification section must also pass before commit/handover.
const CHANGES = [
  // sweep15 — 2026-07-15 external-review wave. P1 correctness first (all
  // high-stakes: orchestrator diff-reviews and commits), then P2 themes.
  // Order is load-bearing: placeholder-data-gating before head-slides-activity-gate
  // (same query consumers); slides changes are separated by the sequential run.
  // sweep15-status-derivation-ssot: committed 64bd6cae (orchestrator diff-review passed).
  // sweep15-placeholder-data-gating: committed afe0ff96 (orchestrator diff-review passed).
  // sweep15-head-slides-activity-gate: committed e031f8df (orchestrator diff-review passed).
  { name: "sweep15-live-report-type-ssot", stakes: "high" },
  { name: "sweep15-dashboard-draft-drilldown", stakes: "high" },
  { name: "sweep15-slide-status-accessible-label", stakes: "high" },
  { name: "sweep15-viewer-authority-labeling", stakes: "high" },
  {
    name: "sweep15-api-boundary-ports",
    stakes: "low",
    commitSubject:
      "refactor(api): route app-layer telemetry and enqueue through owned ports",
  },
  {
    name: "sweep15-web-type-and-module-hygiene",
    stakes: "low",
    commitSubject:
      "refactor(web): shared PeriodStatus and split the oversized report modules",
  },
  {
    name: "sweep15-web-perf-practices",
    stakes: "low",
    commitSubject:
      "perf(web): tab-scoped admin queries, direct dynamic imports, next/font",
  },
  {
    name: "sweep15-simplify-dedup",
    stakes: "low",
    commitSubject:
      "refactor(api,web): remove pass-through layers and dedup status helpers",
  },
  {
    name: "sweep15-ux-lead-completion",
    stakes: "low",
    commitSubject: "feat(web): sticky lead actions and readiness summary",
  },
  { name: "sweep15-ux-head-dashboard-queue", stakes: "high" },
  {
    name: "sweep15-ux-admin-polish",
    stakes: "low",
    commitSubject:
      "feat(web): admin action hierarchy and slide presentation density",
  },
  {
    name: "sweep15-spec-product-map",
    stakes: "low",
    commitSubject: "docs(openspec): product capability map and spec purposes",
  },
];
// ---------------------------------------------------------------------------------------

// Single field on purpose: a complex nested schema after a long implement run
// made agents fail StructuredOutput repeatedly; file lists came back as
// placeholders. The implement lane reports only a prose summary; the change's
// files are derived from git (the SCOPE_SCHEMA agent), the single source of truth.
const IMPL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary"],
  properties: { summary: { type: "string" } },
};

const SCOPE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["dirtyPaths"],
  properties: {
    dirtyPaths: { type: "array", items: { type: "string" } },
  },
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
  required: ["alreadyCommitted", "headSha", "preexistingDirty", "note"],
  properties: {
    alreadyCommitted: { type: "boolean" },
    headSha: { type: "string" },
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

const specPointer = (name) =>
  [
    `Read the FULL spec first and implement EVERY task exactly:`,
    `  openspec/changes/${name}/proposal.md`,
    `  openspec/changes/${name}/design.md`,
    `  openspec/changes/${name}/tasks.md`,
    `  openspec/changes/${name}/specs/   (delta specs — the normative requirements)`,
    `Plan anchors (line numbers) may be slightly stale; trust the current code.`,
  ].join("\n");

async function processChange(CHANGE, index) {
  const tag = `[${index + 1}/${CHANGES.length} ${CHANGE.name}]`;

  // ---- Preflight: git resume checkpoint ----
  phase("Preflight");
  const pre = await agent(
    [
      `Working tree: ${REPO} (branch main, MVP phase).`,
      `Run, from ${REPO}:`,
      `  /usr/bin/git log ${BASE_SHA}..HEAD --oneline -- openspec/changes/${CHANGE.name}/`,
      `  /usr/bin/git log ${BASE_SHA}..HEAD --oneline`,
      `  /usr/bin/git status --porcelain`,
      `Determine: alreadyCommitted = did ANY commit touch openspec/changes/${CHANGE.name}/ (first command non-empty — every implemented change commits its ticked tasks.md), OR does any commit subject mention "${CHANGE.name}"? headSha = current HEAD short sha. preexistingDirty = dirty paths from \`git status --porcelain\` EXCLUDING anything under \`.claude/\`. note = anything genuinely surprising.`,
      `Do NOT edit anything. Report only.`,
    ].join("\n"),
    {
      label: `preflight:${CHANGE.name}`,
      phase: "Preflight",
      model: "haiku",
      effort: "low",
      schema: PREFLIGHT_SCHEMA,
    },
  );

  if (!pre) {
    return {
      change: CHANGE.name,
      status: "error",
      reason: "preflight returned null",
    };
  }
  if (pre.alreadyCommitted) {
    log(`${tag} already committed (${pre.headSha}) — skip.`);
    return {
      change: CHANGE.name,
      status: "skipped-already-committed",
      headSha: pre.headSha,
    };
  }
  const preexistingDirty = pre.preexistingDirty || [];
  if (preexistingDirty.length > 0) {
    log(
      `${tag} ${preexistingDirty.length} pre-existing dirty path(s) — will exclude from this change's commit.`,
    );
  }

  // ---- Implement (Codex lane — GPT writes, Claude reviews) ----
  phase("Implement");
  const implPrompt = [
    `Implement ONE OpenSpec change on a SHARED working tree.`,
    ``,
    `1. Objective: implement the OpenSpec change "${CHANGE.name}" at ${REPO} (branch main, MVP phase), including its unit and real-DB integration tests, leaving ALL edits uncommitted in the working tree.`,
    ``,
    `2. Files: ${specPointer(CHANGE.name)}`,
    `The tasks.md checklist enumerates the exact files and steps; tick the checkboxes in tasks.md as you complete them (editing tasks.md IS part of the change).`,
    ``,
    `3. Interfaces: the delta specs under openspec/changes/${CHANGE.name}/specs/ are the normative contract; design.md fixes the decisions. Do not deviate from design.md decisions or reopen its Non-Goals.`,
    ``,
    `4. Constraints:`,
    `- DO NOT commit, DO NOT \`git add\`, DO NOT \`prisma migrate reset\`, DO NOT touch git at all — leave edits in the working tree for review.`,
    `- Do NOT touch any file unrelated to this change.`,
    `- Hard repo standards (violating any fails review):`,
    ...STANDARDS.map((s, i) => `  ${i + 1}. ${s}`),
    `- Tests: write/repair the unit + real-DB integration tests the tasks specify. Test DB is UP (customreport_test). Integration tests self-fixture (Prisma 7 reset does not auto-seed). Mirror existing patterns.`,
    ``,
    `5. Verification — run change-local checks YOURSELF (NEVER the full monorepo suite, NEVER migrate-reset):`,
    `  pnpm --filter @customreport/api db:generate   # only if Prisma-client TS errors (TS2339 on a known model)`,
    `  pnpm --filter @customreport/api typecheck   # and/or --filter @customreport/web if web files changed`,
    `  cd ${REPO} && pnpm exec eslint <your changed files> --max-warnings 0   # NEVER \`eslint .\` (OOM)`,
    `  cd ${REPO}/apps/api && pnpm exec vitest run <your changed test files>   # do NOT wrap vitest in rtk (mis-parses TSX -> 0 tests)`,
    ``,
    `When done, return ONLY a prose summary: one paragraph on what you actually changed and the result of your change-local checks. (You do NOT need to list files — the harness derives the changed set from git directly.)`,
  ].join("\n");
  const implOpts = (label) => ({
    label,
    phase: "Implement",
    // PROVENANCE: codex-implementer -> grok (spend cap, 2026-07-15 ~08:00) ->
    // in-harness Claude (classifier denied grok, ~09:30) -> codex-implementer
    // again (user reset the Codex cap, ~10:30).
    agentType: "codex-implementer",
    model: "sonnet",
    effort: "medium",
    schema: IMPL_SCHEMA,
  });

  // Derive the change's files FROM GIT, not from the implement agent. The
  // change's own files = current dirty MINUS the harness's own scripts
  // (.claude/) MINUS anything dirty before the run.
  const deriveChangedFiles = async () => {
    const scope = await agent(
      [
        `Run, from ${REPO}: \`/usr/bin/git status --porcelain\`.`,
        `Return dirtyPaths = the path part of EVERY line, verbatim (for a rename "A -> B", return B). Do NOT edit anything; report only.`,
      ].join("\n"),
      {
        label: `scope:${CHANGE.name}`,
        phase: "Implement",
        model: "haiku",
        effort: "low",
        schema: SCOPE_SCHEMA,
      },
    );
    const changedFiles = (scope?.dirtyPaths || []).filter((p) => {
      if (p.startsWith(".claude/")) return false;
      return CHANGE.skipImplement ? true : !preexistingDirty.includes(p);
    });
    return { scope, changedFiles };
  };

  let impl = CHANGE.skipImplement
    ? {
        summary:
          "skipImplement: change already on the working tree; verify/gate on the current uncommitted state only",
      }
    : await agent(implPrompt, implOpts(`impl:${CHANGE.name}`));

  if (!impl) {
    return {
      change: CHANGE.name,
      status: "error",
      reason:
        "implement returned null (possible codex CLI failure/limit — orchestrator decides fallback)",
    };
  }

  let { scope, changedFiles } = await deriveChangedFiles();

  // Liveness gate: a lane that reports success over an EMPTY diff is a failed
  // lane (spend caps and watchdog kills have produced exactly this), not a
  // reviewable change. One retry, then park for the orchestrator.
  if (changedFiles.length === 0 && !CHANGE.skipImplement) {
    log(`${tag} implement produced an EMPTY diff — liveness retry (1 of 1).`);
    impl = await agent(
      [
        `NOTE: a previous attempt at this task reported completion but left ZERO file edits on the working tree. Treat this as a fresh start and make the edits for real this time.`,
        ``,
        implPrompt,
      ].join("\n"),
      implOpts(`impl-retry:${CHANGE.name}`),
    );
    if (!impl) {
      return {
        change: CHANGE.name,
        status: "error",
        reason: "implement retry returned null",
      };
    }
    ({ scope, changedFiles } = await deriveChangedFiles());
  }
  if (changedFiles.length === 0) {
    return {
      change: CHANGE.name,
      status: "error",
      reason: "no change files detected from git (after one liveness retry)",
      implSummary: impl.summary,
      scope,
    };
  }
  const scopeArg = changedFiles.map((p) => `'${p}'`).join(" ");

  // ---- Verify (2 adversarial Claude lenses — cross-vendor vs the GPT implementation) ----
  phase("Verify");
  const diffCmd = `cd ${REPO} && /usr/bin/git --no-pager diff HEAD -- ${scopeArg}`;
  const verifyHead = [
    `Adversarially verify an UNCOMMITTED change on the working tree at ${REPO} for: ${CHANGE.name}.`,
    `Read the intent FIRST: openspec/changes/${CHANGE.name}/proposal.md, design.md, tasks.md, and the delta specs under openspec/changes/${CHANGE.name}/specs/ (the normative requirements).`,
    `Read the actual change: run \`${diffCmd}\`. This change's files are: ${changedFiles.join(", ")}. Any of these that is NEWLY CREATED will not appear in the diff — read those in full. IGNORE any other dirty file: not this change.`,
    `READ THE TEST DIFF BEFORE THE CODE DIFF: implement lanes have quietly loosened existing test assertions to fit their change — any weakened/deleted assertion in a pre-existing test is at least "major".`,
    `Use codegraph_explore to trace call paths around changed symbols. Be skeptical; default to finding a hole, not approving.`,
    `SCOPE DISCIPLINE (loop-termination rule): before rating a finding "blocker" or "major", check it against THIS change's DECLARED scope (tasks.md + design.md Goals/Non-Goals + the proposal's disposition table of refuted claims). A Non-Goal, a refuted-and-dispositioned claim, or a pre-existing / cross-cutting concern the change does not claim to fix is severity "minor" + a FOLLOW-UP — NEVER a blocker. Only the change's OWN new code being wrong, a regression it introduces, or a legitimate flow it breaks is blocker/major.`,
    ``,
  ].join("\n");

  const lensCompleteness = [
    verifyHead,
    `LENS — ENUMERATED COMPLETENESS + REACHABILITY.`,
    `Build the checklist YOURSELF from openspec/changes/${CHANGE.name}/tasks.md (every task) and every requirement/scenario in the delta specs. Confirm the diff satisfies EVERY item; name any missing or partial one.`,
    `Then ask the proposal's own reachability question: after this diff, can the bad outcome the proposal describes still be reached by any concrete input/flow? Trace it.`,
    `For each gap: file:line, concrete scenario (specific inputs -> wrong/leaked outcome), severity.`,
  ].join("\n");

  const lensRegression = [
    verifyHead,
    `LENS — REGRESSION + STANDARDS + TEST TEETH.`,
    `Regression question: which legitimate existing flows touch the changed symbols? Trace each and confirm it still works; name any the diff breaks or falsely rejects.`,
    `Check the diff against repo standards: any new let/mutation where const/pure would do; any fallback/silent default (\`?? "..."\`, \`.default()\`); any non-English UI string in apps/web tsx; any ticket/phase/change-slug comment prefix; any hand-rolled tRPC chain; any function > 50 lines or file > 250 lines introduced; any period-dual-state atomicity regression (a Report write updating only one of the two period representations).`,
    `Confirm new/changed tests have TEETH — would they fail if the fix were reverted? Flag any test asserting on fabricated error meta rather than a ground-truth DB error.`,
    `For each issue: file:line, concrete scenario, severity.`,
  ].join("\n");

  const lensOpts = (label) => ({
    label,
    phase: "Verify",
    model: "opus",
    effort: "high",
    schema: VERIFY_SCHEMA,
  });
  const verdicts = await parallel([
    () => agent(lensCompleteness, lensOpts(`verify:completeness`)),
    () => agent(lensRegression, lensOpts(`verify:regression`)),
  ]);
  // A lens can die on a transient API error; one retry before the dead-slot
  // rule parks the change (a dead verifier slot is NOT a clean review).
  if (!verdicts[0]) {
    log(`${tag} completeness lens died — one retry.`);
    verdicts[0] = await agent(
      lensCompleteness,
      lensOpts(`verify-retry:completeness`),
    );
  }
  if (!verdicts[1]) {
    log(`${tag} regression lens died — one retry.`);
    verdicts[1] = await agent(
      lensRegression,
      lensOpts(`verify-retry:regression`),
    );
  }

  const verifyFindings = verdicts
    .filter(Boolean)
    .flatMap((v) => v.findings || []);
  const isBlocking = (f) => f.severity === "blocker" || f.severity === "major";
  const verifyBlockers = verifyFindings.filter(isBlocking);
  // Both lenses must actually report: a dead verifier slot is NOT a clean review.
  const verifyIncomplete = verdicts.filter(Boolean).length < 2;

  // ---- Gate (full monorepo gate + full api integration suite) ----
  phase("Gate");
  const gate = await agent(
    [
      `Run the FULL local quality gate for the uncommitted change ${CHANGE.name} at ${REPO}. Run each step as a SEPARATE command (the foreground shell caps at 600s; do not chain them all into one). Do NOT edit any code. Do NOT touch git. Report results only.`,
      ``,
      `1. cd ${REPO} && pnpm --filter @customreport/api db:generate   # pnpm ops wipe the .prisma client; regenerate before typecheck`,
      `2. cd ${REPO} && pnpm typecheck`,
      `3. cd ${REPO} && pnpm lint            # eslint . && stylelint && lint:prisma:typecheck — the full lint, not just eslint`,
      `4. cd ${REPO} && pnpm test            # full unit suite (excludes *.integration.test.ts)`,
      `5. cd ${REPO} && pnpm --filter @customreport/api test:integration   # the FULL api real-DB integration suite, single-worker; postgres container customreport-postgres-1 must be up. Do NOT wrap vitest in rtk. Report integrationTests=fail if ANY integration file fails, and list every failing file in redFiles.`,
      ``,
      `For each of typecheck/lint/unitTests/integrationTests report pass|fail|skip. redFiles = failing test files (empty if none). summary = a short digest; for ANY failure include the precise error excerpt (file, message) so the orchestrator can act without re-running.`,
    ].join("\n"),
    {
      label: `gate:${CHANGE.name}`,
      phase: "Gate",
      model: "sonnet",
      effort: "medium",
      schema: GATE_SCHEMA,
    },
  );

  const gateGreen =
    gate &&
    gate.typecheck === "pass" &&
    gate.lint === "pass" &&
    gate.unitTests === "pass" &&
    gate.integrationTests === "pass";

  // ---- Live verify (only for flagged changes; a red drive parks the change) ----
  phase("LiveVerify");
  const live =
    CHANGE.liveVerify && gateGreen
      ? await agent(
          [
            `Live-verify an UNCOMMITTED change in the REAL browser: ${CHANGE.name} at ${REPO}.`,
            `Execute the manual/live verification steps from openspec/changes/${CHANGE.name}/proposal.md (its verification section) and tasks.md against a live app.`,
            `Boot recipe (docker web/api images are STALE — run from source):`,
            `- API from source: cd ${REPO}/apps/api && (pnpm dev in a BACKGROUND shell); serves :3002. Postgres container customreport-postgres-1 is already up (DB customreport_dev).`,
            `- Web from source: cd ${REPO}/apps/web && (pnpm dev in a BACKGROUND shell); serves :3000. Wait for both to answer before driving.`,
            `- Dev auth: POST /auth/dev-login on the API :3002 as lead1@ (AUTH_DEV_MODE); the cookie works cross-port on :3000.`,
            `- Drive with the Playwright MCP browser tools (load them via ToolSearch: query "playwright browser", max_results 30).`,
            `Walk each verification step; for every step record observed vs expected. Any step whose observed behavior contradicts the spec is a finding (severity major or blocker). When finished, kill the dev servers you started.`,
            `verdict "clean" ONLY if every step behaved as specified.`,
          ].join("\n"),
          {
            label: `live:${CHANGE.name}`,
            phase: "LiveVerify",
            model: "sonnet",
            effort: "high",
            schema: VERIFY_SCHEMA,
          },
        )
      : null;
  const liveBlockers = live ? (live.findings || []).filter(isBlocking) : [];
  const liveFailed = CHANGE.liveVerify && gateGreen && !live;

  const blockers = [...verifyBlockers, ...liveBlockers];

  // ---- Decide ----
  const base = {
    change: CHANGE.name,
    stakes: CHANGE.stakes,
    impl: { summary: impl.summary, changedFiles },
    preexistingDirty,
    verify: {
      completeness: verdicts[0],
      regression: verdicts[1],
      blockers: verifyBlockers,
    },
    gate,
    live,
    blockers,
  };

  if (!gateGreen) {
    log(`${tag} GATE RED — parking. ${gate ? gate.summary : "gate null"}`);
    return { ...base, status: "parked-gate-red" };
  }
  if (verifyIncomplete) {
    log(
      `${tag} a verify lens died — parking (dead slot is not a clean review).`,
    );
    return { ...base, status: "parked-verify-incomplete" };
  }
  if (liveFailed) {
    log(`${tag} live-verify agent died — parking.`);
    return { ...base, status: "parked-live-verify-dead" };
  }
  if (blockers.length > 0) {
    log(`${tag} ${blockers.length} BLOCKER finding(s) — parking.`);
    return { ...base, status: "parked-blocker" };
  }
  if (CHANGE.stakes === "high") {
    return {
      ...base,
      status: "await-orchestrator-commit",
      commitReady: true,
      commitPaths: changedFiles,
    };
  }

  // Low-stakes: commit in-workflow.
  phase("Commit");
  const commit = await agent(
    [
      `Commit the uncommitted change ${CHANGE.name} on branch main at ${REPO}. The full gate already passed; do NOT re-run it. Do NOT push.`,
      `Stage EXACTLY these paths and NOTHING else: \`cd ${REPO} && git add\` followed by each of:`,
      ...changedFiles.map((p) => `    ${p}`),
      `Do NOT use \`git add .\` or \`git add -A\`. After staging, run \`/usr/bin/git status --porcelain\` and confirm the STAGED set is exactly the paths above; if a path above is somehow not dirty, or staging pulled in anything else, STOP and report committed:false with the surprise in summary.`,
      `Then \`git commit\` with subject: ${CHANGE.commitSubject || `feat: ${CHANGE.name}`}`,
      `Body: one short paragraph summarizing the change per its proposal's Why section (read openspec/changes/${CHANGE.name}/proposal.md). No ticket/BL prefixes.`,
      `End the commit message with exactly these trailer lines:`,
      `  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`,
      `  Claude-Session: https://claude.ai/code/session_01QUUqyN76KZrtARyVcFg8i7`,
      `If a pre-commit hook reformats staged files, re-add them and retry the commit once. Report committed, the new short sha, and a one-line summary listing the committed paths.`,
    ].join("\n"),
    {
      label: `commit:${CHANGE.name}`,
      phase: "Commit",
      model: "haiku",
      effort: "low",
      schema: COMMIT_SCHEMA,
    },
  );

  if (!commit || !commit.committed) {
    return { ...base, status: "commit-failed", commit };
  }
  log(`${tag} committed ${commit.sha}.`);
  return { ...base, status: "committed", sha: commit.sha };
}

const ledger = [];
for (let i = 0; i < CHANGES.length; i++) {
  const result = await processChange(CHANGES[i], i);
  ledger.push(result);
  // Stop the wave on any non-progress state so the tree stays consistent for the
  // next sequential change; the orchestrator resolves the halt then re-launches.
  const ok =
    result.status === "committed" ||
    result.status === "skipped-already-committed";
  if (!ok) {
    log(`Halting wave at ${result.change} (status=${result.status}).`);
    break;
  }
}

return { ledger };
