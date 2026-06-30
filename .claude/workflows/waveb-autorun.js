export const meta = {
  name: "waveb-autorun",
  description:
    "Autonomously implement -> 2 adversarial verifiers -> full gate + integration -> Codex review -> commit a LIST of OpenSpec changes sequentially on the shared tree (low-stakes: workflow commits; high-stakes: returns commitReady for the orchestrator to commit). Git is the resume checkpoint: a change whose name already appears in git log is skipped.",
  phases: [
    { title: "Preflight" },
    { title: "Implement" },
    { title: "Verify" },
    { title: "Gate" },
    { title: "Codex" },
    { title: "Commit" },
  ],
};

const REPO = "/home/user/work/customreport";
const BASE = "chore/exemplary-code-standard";

const STANDARDS = [
  "Exemplary code standard: functional/immutable (const, pure fns, map/filter/reduce + spread; avoid let/mutation); files < 250 lines; functions <= 50 lines; cognitive complexity < 10.",
  'NO fallbacks / silent defaults for product config (no `?? "localhost"`, no `.default()` in env.schema). Mandatory vars are REQUIRED (Zod, no default) read via requireEnv; boot fails loud. THIS STANDARD OVERRIDES any change design.md that proposes a `.default()` or in-code fallback — reconcile to requireEnv + compose `${VAR:?}` in compose files.',
  "UI strings in apps/web/**/*.tsx stay English (JSX/toast/aria/placeholder). Russian only in DB/seed data, comments, test fixtures.",
  "Comment hygiene: NO ticket/phase/change-slug prefixes (no `UFB-052`, `Phase X`, change names) in comments. Explain the WHY of current code only; never narrate what the code already says.",
  "Strict lint rules are ERRORS and bite mid-edit: require-await, no-unnecessary-condition, prefer-string-raw, jsdoc-on-private-helper, x-powered-by. Changed paths MUST pass `eslint --max-warnings 0`.",
  "Reuse canonical helpers (e.g. groupScopeFilter from apps/api/src/lib/group-scope.ts). tRPC procedures MUST use one of the 9 canonical middleware-chain builders (matched by reference identity) — never hand-roll a chain.",
  "Period dual-state invariant: a Report write updates BOTH the new period state AND the legacy period tuple, atomically.",
];

// ----- per-run config: the change LIST. Edit this, re-run with the same scriptPath. -----
// stakes: "low"  -> the workflow commits the change itself when gate-green + no blocker.
// stakes: "high" -> the workflow STOPS short of commit and returns commitReady + paths +
//                   message + diff summary for the orchestrator to review-then-commit.
const CHANGES = [
  {
    name: "fix-integration-fixtures",
    stakes: "low",
    // No OpenSpec dir for this maintenance change — the task is fully inline.
    spec: {
      inline: [
        "Fix THREE pre-existing RED api integration test files. This is test-fixture maintenance debt from prior changes #11 (add-section-optimistic-lock, commit 82f847f7, added ReportSection.version) and #12 (period-uniqueness-db-constraint, added the partial unique index Report_one_open_per_boundary). It is NOT a behavior change — touch ONLY test files, no production code.",
        "",
        "FILE 1 — apps/api/src/modules/weekly-report/weekly-report.integration.test.ts (4 failing: active period / portfolio overview / escalations / historical period)",
        "FILE 2 — apps/api/src/modules/weekly-report/weekly-report.scope-filter.integration.test.ts (2 failing: published period NO signal / signal present)",
        "  GROUND TRUTH (I ran them): all 6 fail with `ZodError: expected number, received undefined` at path sections[N].version, thrown by assembledReportSchema.parse(value) in apps/api/src/modules/published-report-snapshot.ts:80 (called from WeeklyReportPrismaRepository.getWeeklyReport). The fixtures build a PUBLISHED SNAPSHOT whose sections[] (the assembled-report section objects — NOT necessarily a leadSections array) omit the now-REQUIRED numeric version. Find EVERY snapshot-section fixture object these tests feed through getWeeklyReport / parsePublishedSnapshot and add `version: 1` (these files already set version:1 on some objects — mirror that). Read assembledReportSchema and its section schema to confirm exactly which object needs version, and add it everywhere it is missing. Change no other field or assertion.",
        "",
        "FILE 3 — apps/api/src/modules/weekly-report/weekly-report.current-editable.integration.test.ts",
        "  The test `breaks a same-periodStart tie deterministically (concurrent editable periods)` (~line 100) creates TWO `open` periods sharing periodStart 2026-05-18. The partial unique index `Report_one_open_per_boundary` (ON (periodStart, periodEnd) WHERE periodState = 'open') now REJECTS the second insert with P2002. The test's INTENT is the deterministic `id desc` tiebreak of getCurrentEditableId among periods sharing a periodStart. Rework the PREMISE so two rows still tie on periodStart and are both selected by getCurrentEditableId, but they are NOT both periodState='open' (so the partial index permits them).",
        "  Read getCurrentEditableId in apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts to confirm which column(s) it filters on (open/reopened editable set) and the exact ORDER BY (periodStart desc, id desc). Note the local createReport helper does NOT set `periodState` today (it takes the DB default), so to make one row periodState!='open' you must set periodState explicitly — extend createReport to accept/set periodState (keep it dual-state consistent: a `reopened` periodStatus row should carry periodState 'reopened', mirroring how production maps the dual state). The reworked tie should be e.g. one open + one reopened on the same periodStart, asserting the higher `id` wins identically on repeated calls. PRESERVE the test's intent (stable id-desc tiebreak) and its repeated-call stability assertions; do not delete the test or weaken it to a trivial single-row case. Update the stale comment that claims 'two concurrent OPEN editable periods sharing a periodStart is a SUPPORTED state' — it is no longer true after #12.",
        "",
        "Confirm green by running these 3 files through the api integration runner (see apps/api package.json `test:integration`; the test DB customreport_test is up). Do NOT run a full monorepo gate and do NOT touch git.",
      ].join("\n"),
    },
    seam: "ONLY the 3 named weekly-report integration test files (+ their local helpers). No production code, no schema, no migration.",
    caveat:
      "Keep dual-state consistency in the reworked fixture (periodState matches periodStatus). Do not regress the existing passing assertions in file 3 (reopened-over-open, newest-open, archived-exclusion, future-exclusion, empty->null).",
    mustCover: [
      "FILE 1 + FILE 2: every published-snapshot section fixture object (the sections[] parsed by assembledReportSchema) now carries a numeric `version`; no other field/assertion changed; the ZodError 'expected number at sections[N].version' is gone for all 6 tests.",
      "FILE 3 tie test: the two tied rows share periodStart, are BOTH returned-eligible by getCurrentEditableId, but are NOT both periodState='open' (the partial index Report_one_open_per_boundary no longer rejects the insert).",
      "FILE 3 tie test still asserts the deterministic id-desc winner AND repeated-call stability (first === second === expected higher-id row).",
      "FILE 3's other tests (reopened-over-open, newest-open, archived-open exclusion, future exclusion, empty->null) remain unchanged and pass.",
      "Only test files touched; zero production-code edits in the diff.",
    ],
    reachability:
      "Does the reworked tie fixture actually still violate nothing the DB enforces (no two periodState='open' on one boundary), and does it still exercise the id-desc tiebreak rather than accidentally testing periodStart ordering or a single row?",
    regression:
      "Could the added `version` or the createReport periodState extension silently change what another test in these files asserts? Confirm the 3 files are GREEN against customreport_test and no production code was modified.",
    // What the Gate stage must run green for THIS change (besides the full unit gate).
    integrationTargets:
      "the 3 weekly-report integration files: weekly-report.integration.test.ts, weekly-report.scope-filter.integration.test.ts, weekly-report.current-editable.integration.test.ts",
    commitSubject:
      "test(weekly-report): restore integration fixtures to #11/#12 schema invariants",
    commitBody: [
      "Three weekly-report integration files were red from accumulated debt:",
      "- weekly-report.integration.test.ts / weekly-report.scope-filter.integration.test.ts:",
      "  leadSections[] fixtures omitted ReportSection.version (required since the",
      "  optimistic-lock change) -> ZodError. Add version to every fixture entry.",
      "- weekly-report.current-editable.integration.test.ts: the same-periodStart tie",
      "  test created two periodState='open' rows, which the one-open-per-boundary",
      "  partial unique index now rejects. Rework the tie to two editable rows that",
      "  share periodStart without both being periodState='open', preserving the",
      "  deterministic id-desc tiebreak assertion.",
      "Test-only; no production code touched. Clears the integration baseline so the",
      "make-publish-atomic change can verify getCurrentEditableId against green.",
    ].join("\n"),
  },
];
// ---------------------------------------------------------------------------------------

const IMPL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "filesTouched",
    "testFilesAdded",
    "localChecks",
    "staleAnchors",
    "openQuestions",
  ],
  properties: {
    summary: { type: "string" },
    filesTouched: { type: "array", items: { type: "string" } },
    testFilesAdded: { type: "array", items: { type: "string" } },
    localChecks: {
      type: "object",
      additionalProperties: false,
      required: ["typecheck", "lint", "unitTests", "integrationTests"],
      properties: {
        typecheck: { type: "string" },
        lint: { type: "string" },
        unitTests: { type: "string" },
        integrationTests: { type: "string" },
      },
    },
    staleAnchors: { type: "array", items: { type: "string" } },
    openQuestions: { type: "array", items: { type: "string" } },
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
    "build",
    "redFiles",
    "summary",
  ],
  properties: {
    typecheck: { type: "string", enum: ["pass", "fail", "skip"] },
    lint: { type: "string", enum: ["pass", "fail", "skip"] },
    unitTests: { type: "string", enum: ["pass", "fail", "skip"] },
    integrationTests: { type: "string", enum: ["pass", "fail", "skip"] },
    build: { type: "string", enum: ["pass", "fail", "skip", "notrun"] },
    redFiles: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
  },
};

const PREFLIGHT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["alreadyCommitted", "headSha", "treeClean", "note"],
  properties: {
    alreadyCommitted: { type: "boolean" },
    headSha: { type: "string" },
    treeClean: { type: "boolean" },
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
    `Use codegraph_explore to locate the current code — plan anchors (line numbers) may be slightly stale; trust the code and FLAG drift in staleAnchors.`,
  ].join("\n");
}

async function processChange(CHANGE, index) {
  const tag = `[${index + 1}/${CHANGES.length} ${CHANGE.name}]`;

  // ---- Preflight: git resume checkpoint ----
  phase("Preflight");
  const pre = await agent(
    [
      `Working tree: ${REPO} (git branch impl/backlog-2026-06-30).`,
      `Run, from ${REPO}:`,
      `  git log ${BASE}..HEAD --oneline`,
      `  git status --porcelain`,
      `Determine: alreadyCommitted = does ANY commit subject in that log mention "${CHANGE.name}" (the change name or its commit subject "${CHANGE.commitSubject || CHANGE.name}")? headSha = current HEAD short sha. treeClean = is git status --porcelain empty AFTER ignoring any path under \`.claude/\` (the harness's own workflow scripts are not part of any change and never block a run)? If the ONLY dirty entries are under .claude/, treeClean is TRUE. Put anything notable (a genuinely dirty tracked path outside .claude/) in note.`,
      `Do NOT edit anything. Report only.`,
    ].join("\n"),
    {
      label: `preflight:${CHANGE.name}`,
      phase: "Preflight",
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
  if (!pre.treeClean) {
    log(
      `${tag} tree is DIRTY before start (${pre.note}) — halting for orchestrator.`,
    );
    return { change: CHANGE.name, status: "halt-dirty-tree", note: pre.note };
  }

  // ---- Implement ----
  phase("Implement");
  const impl = await agent(
    [
      `You are implementing ONE change on a SHARED working tree at ${REPO}`,
      `(git branch impl/backlog-2026-06-30, MVP phase). DO NOT commit, DO NOT \`git add\`, DO NOT \`prisma migrate reset\`, DO NOT touch git at all — leave edits in the working tree for review.`,
      ``,
      `Change: ${CHANGE.name}.`,
      specBlock(CHANGE),
      ``,
      `Seam caveat: ${CHANGE.seam}`,
      CHANGE.caveat ? `Named caveat: ${CHANGE.caveat}` : ``,
      ``,
      `Hard repo standards (violating any fails review):`,
      ...STANDARDS.map((s, i) => `  ${i + 1}. ${s}`),
      ``,
      `Tests: write/repair the unit + real-DB integration tests the task specifies. Test DB is UP (customreport_test). Integration tests self-fixture (Prisma 7 reset does not auto-seed). Mirror existing patterns.`,
      ``,
      `Run change-local checks YOURSELF (NEVER the full monorepo suite, NEVER migrate-reset):`,
      `  pnpm --filter @customreport/api db:generate   # only if Prisma-client TS errors (TS2339 on a known model)`,
      `  pnpm --filter @customreport/api typecheck`,
      `  cd ${REPO} && pnpm exec eslint <your changed files> --max-warnings 0   # NEVER \`eslint .\` (OOM)`,
      `  cd ${REPO}/apps/api && pnpm exec vitest run <your changed test files>   # do NOT wrap vitest in rtk (mis-parses TSX -> 0 tests)`,
      ``,
      `Return ONLY the structured object: a one-paragraph summary, the EXACT files you touched (repo-relative paths), the test files you added, the pass/fail/notrun status of each local check with detail, any stale plan anchors, and any open questions.`,
    ]
      .filter(Boolean)
      .join("\n"),
    {
      label: `impl:${CHANGE.name}`,
      phase: "Implement",
      effort: "high",
      schema: IMPL_SCHEMA,
    },
  );

  if (!impl) {
    return {
      change: CHANGE.name,
      status: "error",
      reason: "implement returned null",
    };
  }

  // ---- Verify (2 adversarial lenses) ----
  phase("Verify");
  const diffCmd = `cd ${REPO} && git --no-pager diff ${BASE} -- . ':(exclude)openspec'`;
  const verifyHead = [
    `Adversarially verify an UNCOMMITTED change on the working tree at ${REPO} for: ${CHANGE.name}.`,
    CHANGE.spec && CHANGE.spec.inline
      ? `Intent (inline task):\n${CHANGE.spec.inline}`
      : `Read the intent: openspec/changes/${CHANGE.name}/proposal.md and design.md.`,
    `Read the actual change: run \`${diffCmd}\` (work is uncommitted, layered on ${BASE}).`,
    `Use codegraph_explore to trace call paths around changed symbols. Be skeptical; default to finding a hole, not approving.`,
    ``,
  ].join("\n");

  const lensCompleteness = [
    verifyHead,
    `LENS — ENUMERATED COMPLETENESS + CROSS-SCOPE REACHABILITY.`,
    `Confirm the diff handles EVERY one of these; name any missing or partial:`,
    ...CHANGE.mustCover.map((m, i) => `  [${i + 1}] ${m}`),
    ``,
    `Then the reachability question: ${CHANGE.reachability}`,
    `For each gap: file:line, concrete scenario (specific inputs -> wrong/leaked outcome), severity.`,
  ].join("\n");

  const lensRegression = [
    verifyHead,
    `LENS — REGRESSION + STANDARDS + TEST TEETH.`,
    `Regression question: ${CHANGE.regression}`,
    `Check the diff against repo standards: any new let/mutation where const/pure would do; any fallback/silent default (\`?? "..."\`, \`.default()\`); any non-English UI string in apps/web tsx; any ticket/phase/change-slug comment prefix; any hand-rolled tRPC chain; any function > 50 lines or file > 250 lines introduced; any period-dual-state atomicity regression (a Report write updating only one of the two period representations).`,
    `Confirm new/changed tests have TEETH — would they fail if the fix were reverted? Flag any test asserting on fabricated error meta rather than a ground-truth DB error.`,
    `For each issue: file:line, concrete scenario, severity.`,
  ].join("\n");

  const verdicts = await parallel([
    () =>
      agent(lensCompleteness, {
        label: `verify:completeness`,
        phase: "Verify",
        effort: "high",
        schema: VERIFY_SCHEMA,
      }),
    () =>
      agent(lensRegression, {
        label: `verify:regression`,
        phase: "Verify",
        effort: "high",
        schema: VERIFY_SCHEMA,
      }),
  ]);

  const verifyFindings = verdicts
    .filter(Boolean)
    .flatMap((v) => v.findings || []);
  const verifyBlockers = verifyFindings.filter((f) => f.severity === "blocker");

  // ---- Gate (full monorepo gate + this change's integration targets) ----
  phase("Gate");
  const gate = await agent(
    [
      `Run the FULL local quality gate for the uncommitted change ${CHANGE.name} at ${REPO}. Run each step as a SEPARATE command (the foreground shell caps at 600s; do not chain them all into one). Do NOT edit any code. Do NOT touch git. Report results only.`,
      ``,
      `1. cd ${REPO} && pnpm --filter @customreport/api db:generate   # pnpm ops wipe the .prisma client; regenerate before typecheck`,
      `2. cd ${REPO} && pnpm typecheck`,
      `3. cd ${REPO} && pnpm lint            # eslint . && stylelint && lint:prisma:typecheck — the full lint, not just eslint`,
      `4. cd ${REPO} && pnpm test            # full unit suite (excludes *.integration.test.ts)`,
      `5. Integration for THIS change: run ${CHANGE.integrationTargets} via the api integration runner (read apps/api/package.json \`test:integration\`; it needs E2E_DATABASE_URL distinct from DATABASE_URL pointing at customreport_test — reuse whatever that script already sets). Do NOT wrap vitest in rtk.`,
      CHANGE.runBuild ? `6. cd ${REPO} && pnpm build` : ``,
      ``,
      `For each of typecheck/lint/unitTests/integrationTests/build report pass|fail|skip (build = notrun unless step 6 ran). redFiles = the list of failing test files (empty if none). summary = a short digest; for ANY failure include the precise error excerpt (file, message) so the orchestrator can act without re-running.`,
    ]
      .filter(Boolean)
      .join("\n"),
    {
      label: `gate:${CHANGE.name}`,
      phase: "Gate",
      effort: "medium",
      schema: GATE_SCHEMA,
    },
  );

  const gateGreen =
    gate &&
    gate.typecheck === "pass" &&
    gate.lint === "pass" &&
    gate.unitTests === "pass" &&
    gate.integrationTests === "pass" &&
    (gate.build === "pass" || gate.build === "notrun" || gate.build === "skip");

  // ---- Codex review (read-only, adversarial). null slot != clean. ----
  phase("Codex");
  const codex = await agent(
    [
      `You are an independent, read-only adversarial reviewer of an UNCOMMITTED change on the working tree at ${REPO}.`,
      `Change: ${CHANGE.name}.`,
      CHANGE.spec && CHANGE.spec.inline
        ? `Intent (inline task):\n${CHANGE.spec.inline}`
        : `Intent: openspec/changes/${CHANGE.name}/{proposal,design,tasks}.md.`,
      `Read the diff: \`${diffCmd}\`. Trace call paths. Hunt for: a real correctness/security/authz hole the diff leaves open; a legitimate flow this change now FALSELY rejects; a test without teeth; a standards violation. Default to finding a problem.`,
      `Return verdict "clean" ONLY if you found nothing real. Otherwise "issues" with each finding's file, line, concrete scenario, and severity (blocker/major/minor).`,
    ].join("\n"),
    {
      label: `codex:${CHANGE.name}`,
      phase: "Codex",
      effort: "high",
      agentType: "codex:codex-rescue",
      schema: VERIFY_SCHEMA,
    },
  );

  const codexStatus = codex ? codex.verdict : "unavailable";
  const codexFindings = codex ? codex.findings || [] : [];
  const codexBlockers = codexFindings.filter((f) => f.severity === "blocker");

  const blockers = [...verifyBlockers, ...codexBlockers];
  const isAuthzClass = CHANGE.stakes === "high";

  // ---- Decide ----
  const base = {
    change: CHANGE.name,
    stakes: CHANGE.stakes,
    impl: {
      summary: impl.summary,
      filesTouched: impl.filesTouched,
      testFilesAdded: impl.testFilesAdded,
      openQuestions: impl.openQuestions,
      staleAnchors: impl.staleAnchors,
    },
    verify: {
      completeness: verdicts[0],
      regression: verdicts[1],
      blockers: verifyBlockers,
    },
    gate,
    codex: { status: codexStatus, findings: codexFindings },
    blockers,
  };

  if (!gateGreen) {
    log(`${tag} GATE RED — parking. ${gate ? gate.summary : "gate null"}`);
    return { ...base, status: "parked-gate-red" };
  }
  if (blockers.length > 0) {
    log(`${tag} ${blockers.length} BLOCKER finding(s) — parking.`);
    return { ...base, status: "parked-blocker" };
  }
  // High-stakes never auto-commit; and an authz/high-stakes commit requires a
  // non-null Codex pass (a null slot is NOT a clean review).
  if (isAuthzClass) {
    return {
      ...base,
      status:
        codexStatus === "unavailable"
          ? "await-orchestrator-codex-unavailable"
          : "await-orchestrator-commit",
      commitReady: codexStatus !== "unavailable",
      commitPaths: [...impl.filesTouched, ...impl.testFilesAdded],
      commitSubject: CHANGE.commitSubject,
      commitBody: CHANGE.commitBody,
    };
  }

  // Low-stakes: commit in-workflow. Codex "unavailable" is tolerated for low-stakes (noted).
  phase("Commit");
  const paths = [...new Set([...impl.filesTouched, ...impl.testFilesAdded])];
  const commit = await agent(
    [
      `Commit the uncommitted change ${CHANGE.name} on branch impl/backlog-2026-06-30 at ${REPO}. The full gate already passed; do NOT re-run it.`,
      `Stage EXACTLY these paths and nothing else (the tree should contain only this change's edits):`,
      ...paths.map((p) => `  ${p}`),
      `First run \`cd ${REPO} && git status --porcelain\` and confirm every dirty path is in the list above; if a dirty path is NOT in the list, STOP and report committed:false with the surprise in summary (do not commit).`,
      `Then: \`cd ${REPO} && git add <those paths> && git commit\` with this message:`,
      ``,
      `  Subject: ${CHANGE.commitSubject}`,
      ``,
      `  Body:`,
      CHANGE.commitBody,
      ``,
      `  End the commit message with exactly this trailer line:`,
      `  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`,
      ``,
      `If a pre-commit hook reformats staged files, re-add them and retry the commit once. Report committed, the new short sha, and a one-line summary.`,
    ].join("\n"),
    {
      label: `commit:${CHANGE.name}`,
      phase: "Commit",
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
