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

const REPO = "/Users/wrk/work/customreport";
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
    name: "fix-fillfrom-version-assertion",
    stakes: "low",
    // No OpenSpec dir — maintenance fix of one stale assertion. (Same #11 debt class
    // as fix-integration-fixtures, committed 4a83f6de; this is the 4th red file the
    // handoff missed.) This run ALSO re-validates the harness fixes: full-integration
    // gate, git-diff-HEAD review scope, git-derived commit paths, major-blocks-commit.
    spec: {
      inline: [
        "Fix ONE pre-existing RED api integration test, the last of the #11 (add-section-optimistic-lock) debt. Test-only — touch ONLY the test file, no production code.",
        "",
        "FILE — apps/api/src/modules/report-sections/fill-from.integration.test.ts",
        "Failing test: `LeadFormService — fillFrom (integration) > copies items from source section and returns count` (assertion at line ~128).",
        "GROUND TRUTH (I ran it): the test calls `service.fillFrom(targetSectionId, sourceSectionId, userId, 1)` — the 4th argument (1) is the optimistic-lock expectedVersion that #11 added. LeadFormService forwards it: `repo.fillFromSection(targetSectionId, sourceSectionId, expectedVersion)` (3 args, confirmed at apps/api/src/modules/report-sections/lead-form.service.ts:136). But the assertion `expect(repo.fillFromSection).toHaveBeenCalledWith(targetSectionId, sourceSectionId)` still passes only 2 args, so vitest's recorded actual call `[targetSectionId, sourceSectionId, 1]` fails the matcher.",
        "FIX: add the forwarded expectedVersion as the third expected argument so the assertion matches AND gains teeth on the OCC-version forwarding. Read lead-form.service.ts around line 136 to confirm EXACTLY what value is forwarded (it is the `expectedVersion` parameter = the literal 1 the test passes as fillFrom's 4th arg). Set the matcher to `toHaveBeenCalledWith(targetSectionId, sourceSectionId, 1)` (or the precise expression the service forwards). Change nothing else; do not touch any production file.",
        "",
        "Confirm green by running this file through the api integration runner (apps/api `test:integration`; test DB customreport_test is up). Do NOT run a full monorepo gate and do NOT touch git.",
      ].join("\n"),
    },
    seam: "ONLY apps/api/src/modules/report-sections/fill-from.integration.test.ts. No production code, no schema, no migration, no other test file.",
    caveat:
      "Do not weaken the assertion — strengthen it: the third arg must be the actual forwarded expectedVersion so the test now proves the version reaches the repository (the OCC invariant #11 needs covered). Do not edit lead-form.service.ts or any other file.",
    mustCover: [
      "fill-from.integration.test.ts line ~128: toHaveBeenCalledWith now includes the forwarded expectedVersion as the third argument, matching the real 3-arg repo.fillFromSection call; the test passes.",
      "The assertion has TEETH: it asserts the version value forwarded (1), not a wildcard — it would fail if the service stopped forwarding the version.",
      "Only the one test file is touched; zero production-code edits in the diff.",
      "The FULL api integration suite is now green (this was the last red file).",
    ],
    reachability:
      "Is the third-argument value the assertion expects the ACTUAL value the service forwards (read lead-form.service.ts), not a guess — so the test passes for the right reason rather than by loosening the matcher?",
    regression:
      "Did anything other than the one assertion change? Is any production file in the diff (there must NOT be)? Confirm the whole api integration suite is green against customreport_test.",
    integrationTargets:
      "fill-from.integration.test.ts (and confirm the previously-fixed weekly-report.* files stay green)",
    commitSubject:
      "test(report-sections): assert fillFrom forwards expectedVersion to the repo",
    commitBody: [
      "fill-from.integration.test.ts asserted repo.fillFromSection was called with",
      "(target, source) only, but the optimistic-lock change made the service forward",
      "a third expectedVersion argument, so the actual 3-arg call failed the matcher",
      "and left the integration suite red. Add the forwarded version as the third",
      "expected argument — fixing the red AND giving the test teeth on version",
      "forwarding (the OCC invariant). Last of the #11 integration-fixture debt; the",
      "full api integration suite is now green.",
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
      `Return ONLY the structured object with REAL values (never placeholders like "a","b","c" or "summary placeholder"): a one-paragraph summary of what you actually changed; filesTouched = the EXACT repo-relative paths you edited, taken verbatim from \`git status --porcelain\` (run it before returning); testFilesAdded = only files you newly created; the pass/fail/notrun status of each local check with detail; any stale plan anchors; any open questions. The orchestrator commits the files git reports dirty, so do NOT leave any unrelated edits in the tree.`,
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
  // Scope the review to THIS change only: each change is processed from a clean
  // committed base, so the uncommitted working-tree diff vs HEAD IS exactly this
  // change. (git diff BASE would show the whole branch — every prior change too —
  // and make verifiers/Codex flag pre-existing reds as if this change caused them.)
  const diffCmd = `cd ${REPO} && git --no-pager diff HEAD -- . ':(exclude)openspec'`;
  const verifyHead = [
    `Adversarially verify an UNCOMMITTED change on the working tree at ${REPO} for: ${CHANGE.name}.`,
    CHANGE.spec && CHANGE.spec.inline
      ? `Intent (inline task):\n${CHANGE.spec.inline}`
      : `Read the intent: openspec/changes/${CHANGE.name}/proposal.md and design.md.`,
    `Read the actual change: run \`${diffCmd}\` (this is ONLY the uncommitted work for this change, on top of HEAD — not the whole branch).`,
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
  // A "major" finding (e.g. "the tree is red", "this guard bricks a legit flow")
  // must stop an auto-commit just like a blocker; only "minor" is note-only.
  const isBlocking = (f) => f.severity === "blocker" || f.severity === "major";
  const verifyBlockers = verifyFindings.filter(isBlocking);

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
      `5. cd ${REPO} && pnpm --filter @customreport/api test:integration   # the FULL api real-DB integration suite (vitest --config vitest.integration.config.ts; it loads ../../.env.test which sets DATABASE_URL=customreport_test; postgres container customreport-postgres-1 must be up). Do NOT wrap vitest in rtk. This change is expected to leave the WHOLE suite green; report integrationTests=fail if ANY integration file fails, and list every failing file in redFiles. Sanity-check that this change's target area (${CHANGE.integrationTargets}) is among the green.`,
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
  const codexBlockers = codexFindings.filter(isBlocking);

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
      // Advisory only — the orchestrator derives the real paths via
      // `git diff --name-only HEAD` (impl.filesTouched can be unreliable).
      commitPathsAdvisory: [...impl.filesTouched, ...impl.testFilesAdded],
      commitSubject: CHANGE.commitSubject,
      commitBody: CHANGE.commitBody,
    };
  }

  // Low-stakes: commit in-workflow. Codex "unavailable" is tolerated for low-stakes (noted).
  phase("Commit");
  const commit = await agent(
    [
      `Commit the uncommitted change ${CHANGE.name} on branch impl/backlog-2026-06-30 at ${REPO}. The full gate already passed; do NOT re-run it.`,
      `Determine the paths to stage FROM GIT, not from any provided list: run \`cd ${REPO} && git status --porcelain\`. The tree was clean from a committed base before this change, so every dirty path IS part of this change — EXCEPT anything under \`.claude/\` (the harness's own scripts), which you must NEVER stage.`,
      `If the ONLY dirty paths are under .claude/ (i.e. there is nothing real to commit), STOP and report committed:false with that in summary.`,
      `Otherwise stage exactly the non-.claude dirty paths: \`cd ${REPO} && git add <each non-.claude dirty path>\` (do NOT use \`git add .\` or \`git add -A\`), then \`git commit\` with this message:`,
      ``,
      `  Subject: ${CHANGE.commitSubject}`,
      ``,
      `  Body:`,
      CHANGE.commitBody,
      ``,
      `  End the commit message with exactly this trailer line:`,
      `  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`,
      ``,
      `If a pre-commit hook reformats staged files, re-add them and retry the commit once. After committing, confirm the tree is clean (git status --porcelain shows only .claude/, if anything). Report committed, the new short sha, and a one-line summary listing the committed paths.`,
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
