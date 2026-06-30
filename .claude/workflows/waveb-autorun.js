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
    name: "transactional-snapshot-restore",
    stakes: "high",
    spec: { dir: true },
    seam: "admin-snapshot-write.queries.ts (wrap saveSnapshot's writes in ONE interactive prisma.$transaction; add targeted upsert*/remove* queries). admin-group.queries.ts::ensureFallbackReportingGroup (widen to the tx-client type). snapshot-admin.service.ts, project-admin.service.ts, reminder-admin.service.ts, period-admin.service.ts (rewrite add/edit/remove to call targeted repo methods, NOT getSnapshot->saveSnapshot). admin.prisma-repository.ts + the AdminRepository interface in admin-shared.ts (entity-level methods) + the in-memory test repository. Tests: admin.service.test.ts, admin.integration.test.ts, admin.contract.test.ts. Touch ONLY admin module files. (admin.* seam 12/13/14 already committed — #19 next, no conflict.)",
    caveat:
      "ATOMICITY: wrap every DB write of saveSnapshot — currentRules read, upsertGroups, ensureFallbackReportingGroup (it does reportingGroup.upsert, so it MUST run under tx, not the raw client), upsertUsers, upsertProjects, upsertPeriods, upsertReminderRules — in a SINGLE prisma.$transaction(async (tx) => ...). Widen each upsert* helper AND ensureFallbackReportingGroup from PrismaService to the Prisma transaction-client type (follow the lead-form.prisma-repository.ts pattern). ONLY the post-commit PolicyApplicator loop and the final getSnapshot read stay OUTSIDE the transaction. Preserve the resolveLifecycle non-transition period write inside (do not derive coupled lifecycle fields from one field). " +
      "TARGETED (non-destructive): replace whole-snapshot destructive reconcile (removedUserIds/removedProjectIds/removedRuleIds branches) with entity-level upsert/delete keyed by id. Removals route ONLY through explicit remove* methods (removeUser honors the existing FK-reference guard + P2003 skip; removeProject archives by id; removeReminderRule deletes by id). The retained saveSnapshot is ADDITIVE-ONLY: it NEVER deletes or archives a row merely for being absent from the payload (design D2). " +
      "PeriodAdminService.upsertPeriod MUST call the targeted upsertPeriod (NOT getSnapshot->saveSnapshot) so a single-period edit never re-writes stale copies of groups/users/projects/rules; when the upsert CREATES a period, run PolicyApplicatorService.applyToPeriod for it AFTER the write commits (mirror saveSnapshot's newlyCreatedPeriods post-commit step), never inside the period write. " +
      "Re-express admin.service.test.ts cases that encode destructive reconcile as intended behavior against the targeted mutations — do NOT weaken or delete coverage. No schema change, no migration, no API wire-shape change.",
    mustCover: [
      "saveSnapshot: ALL its DB writes (currentRules read, upsertGroups, ensureFallbackReportingGroup, upsertUsers, upsertProjects, upsertPeriods, upsertReminderRules) run inside ONE prisma.$transaction(async (tx) => ...); a mid-write throw rolls the WHOLE restore back (no partial state, no stray default group). Proven by a real-DB partial-restore-rollback test (a later phase throws -> DB unchanged).",
      "every upsert* helper AND ensureFallbackReportingGroup are widened to the Prisma transaction-client type and run under tx (not the raw client) — follow lead-form.prisma-repository.ts.",
      "PolicyApplicator.applyToPeriod stays strictly AFTER the transaction returns (asserted by structure that the applicator loop is OUTSIDE the $transaction callback); resolveLifecycle non-transition write preserved inside.",
      "destructive reconcile branches (removedUserIds/removedProjectIds/removedRuleIds) REMOVED from the per-phase helpers; removals route only through explicit remove* methods; saveSnapshot is ADDITIVE-ONLY (a user/project/rule absent from the supplied snapshot is NOT deleted/archived). Proven by an additive-only test + a concurrent-insert-survives test.",
      "targeted upsertUser/removeUser (delete honors the FK guard + P2003 skip), upsertProject/removeProject (archive by id), upsertReminderRule/removeReminderRule (delete by id), upsertPeriod (one period by id, preserve resolveLifecycle) implemented in the write queries + wired through admin.prisma-repository.ts.",
      "the four services (Snapshot/Project/Reminder/Period Admin) call the targeted repo methods instead of getSnapshot->mutate->saveSnapshot; PeriodAdminService.upsertPeriod uses targeted upsertPeriod (no stale re-write of unrelated collections) and runs the post-commit applicator on a CREATE; each service still returns its tRPC procedure's expected response shape.",
      "AdminRepository interface (admin-shared.ts) extended with the entity-level methods + the additive-only saveSnapshot contract documented; the in-memory test repository implements the SAME surface so contract tests exercise it.",
      "tests: partial-restore rollback (real-DB), concurrent-insert window closed (a row inserted between read+write survives an unrelated targeted edit), explicit removals touch only the named row, upsertPeriod touches only the named period + triggers post-commit applicator on create, additive-only saveSnapshot; re-expressed destructive-reconcile cases (coverage not weakened).",
    ],
    reachability:
      "After this change, can ANY admin mutation still destroy unrelated data — a user created in the read-write window (SAML JIT login) reconciled away, an absent row deleted/archived for snapshot-absence, or a single-period edit re-writing stale copies of groups/users/projects/rules? Can a mid-write failure leave the org half-restored (a stray default group, users gone but projects untouched) rather than fully rolled back?",
    regression:
      "Does a legitimate snapshot restore / single-entity edit still persist correctly and return the expected tRPC response shape? Does ensureFallbackReportingGroup still provision the fallback group (now under tx)? Does a newly-created period still get PolicyApplicator applied (post-commit)? Is resolveLifecycle's non-transition write preserved? Does the in-memory test repo match the prisma repo's new contract (no contract-test drift)? Are the re-expressed destructive-reconcile tests still meaningful (teeth), not just deleted?",
    integrationTargets:
      "the new admin real-DB tests (partial-restore rollback, concurrent-insert survival, targeted-removal isolation, upsertPeriod isolation, additive-only) + admin.integration.test.ts + admin.contract.test.ts; the whole api unit + integration suite stays green.",
    commitSubject:
      "fix(admin): transactional, targeted snapshot restore (no destructive reconcile)",
    commitBody: ["(orchestrator commits high-stakes after diff review)"].join(
      "\n",
    ),
  },
];
// ---------------------------------------------------------------------------------------

// Single field on purpose: (1) a complex nested schema after a long implement run
// made the agent fail StructuredOutput 5x and crash the whole workflow; (2) even a
// 2-field schema, the implement agent twice returned a PLACEHOLDER file list
// ("a","b","c" / ["a"]), which silently emptied the scoped review diff. So the
// implement agent reports only a prose summary; the change's files are derived from
// git (the SCOPE_SCHEMA agent), the single source of truth.
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
    // Every dirty path from `git status --porcelain` (the path part only), verbatim.
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
  required: ["alreadyCommitted", "headSha", "preexistingDirty", "note"],
  properties: {
    alreadyCommitted: { type: "boolean" },
    headSha: { type: "string" },
    // Non-.claude paths already dirty BEFORE this change runs = concurrent
    // parallel-session work. Recorded so the change's own files can be isolated
    // (changedFiles MINUS preexistingDirty) and that parallel work is never staged.
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
      `Determine: alreadyCommitted = does ANY commit subject in that log mention "${CHANGE.name}" (the change name or its commit subject "${CHANGE.commitSubject || CHANGE.name}")? headSha = current HEAD short sha. preexistingDirty = the list of dirty paths from \`git status --porcelain\` EXCLUDING anything under \`.claude/\` (these are concurrent parallel-session edits, NOT this change). A dirty tree is NORMAL here (a parallel session may be editing docs/domain files) — do NOT treat it as an error; just list those paths in preexistingDirty. note = anything genuinely surprising.`,
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
  // Parallel-session edits (preexistingDirty) are tolerated, never staged. The
  // change's own files = changedFiles MINUS this set MINUS .claude/.
  const preexistingDirty = pre.preexistingDirty || [];
  if (preexistingDirty.length > 0) {
    log(
      `${tag} ${preexistingDirty.length} pre-existing dirty path(s) (parallel work) — will exclude from this change's commit.`,
    );
  }

  // ---- Implement ----
  phase("Implement");
  // skipImplement: the change is ALREADY on the working tree (e.g. a prior run
  // implemented it but crashed before review, or a transient API error parked it).
  // Skip re-implementing; verify/gate/Codex run on the current uncommitted state.
  const impl = CHANGE.skipImplement
    ? {
        summary:
          "skipImplement: change already on the working tree; verify/gate/Codex on the current uncommitted state only",
      }
    : await agent(
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
          `Do NOT touch any file unrelated to this change (a parallel session may be editing docs/domain files — leave those alone). When done, return ONLY a prose summary: one paragraph on what you actually changed and the result of your change-local checks. (You do NOT need to list files — the harness derives the changed set from git directly.)`,
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

  // Derive the change's files FROM GIT, not from the implement agent — it has
  // twice returned a placeholder list, which silently empties the scoped review
  // diff. git status is ground truth.
  const scope = await agent(
    [
      `Run, from ${REPO}: \`git status --porcelain\`.`,
      `Return dirtyPaths = the path part of EVERY line, verbatim (for a rename "A -> B", return B). Do NOT edit anything; report only.`,
    ].join("\n"),
    {
      label: `scope:${CHANGE.name}`,
      phase: "Implement",
      effort: "low",
      schema: SCOPE_SCHEMA,
    },
  );

  // The change's own files = current dirty MINUS the harness's own scripts
  // (.claude/) MINUS parallel-session work. In normal mode parallel work is
  // whatever was already dirty before implement (preexistingDirty). In
  // skipImplement mode the change itself is already dirty (so preexistingDirty
  // would wrongly exclude it) — fall back to excluding the known parallel globs.
  // Parallel-session globs are excluded in BOTH modes: a code change does not
  // touch docs/CONTEXT/openspec, and the parallel session writes there DURING a
  // run (so they are absent from the preflight preexistingDirty snapshot and
  // would otherwise leak into a normal-mode changedFiles, as #19's run showed).
  const PARALLEL_GLOBS = ["docs/", "CONTEXT.md", "AGENTS.md", "openspec/"];
  const changedFiles = (scope?.dirtyPaths || []).filter((p) => {
    if (p.startsWith(".claude/")) return false;
    if (PARALLEL_GLOBS.some((g) => p === g || p.startsWith(g))) return false;
    return CHANGE.skipImplement ? true : !preexistingDirty.includes(p);
  });
  if (changedFiles.length === 0) {
    return {
      change: CHANGE.name,
      status: "error",
      reason:
        "no change files detected from git (after excluding parallel work)",
      implSummary: impl.summary,
      scope,
    };
  }
  const scopeArg = changedFiles.map((p) => `'${p}'`).join(" ");

  // ---- Verify (2 adversarial lenses) ----
  phase("Verify");
  // Scope the review to THIS change's files only — `git diff HEAD` on those paths,
  // not the whole branch (prior changes) and not parallel-session edits elsewhere.
  const diffCmd = `cd ${REPO} && git --no-pager diff HEAD -- ${scopeArg}`;
  const verifyHead = [
    `Adversarially verify an UNCOMMITTED change on the working tree at ${REPO} for: ${CHANGE.name}.`,
    CHANGE.spec && CHANGE.spec.inline
      ? `Intent (inline task):\n${CHANGE.spec.inline}`
      : `Read the intent: openspec/changes/${CHANGE.name}/proposal.md and design.md.`,
    `Read the actual change: run \`${diffCmd}\`. This change's files are: ${changedFiles.join(", ")}. Any of these that is NEWLY CREATED will not appear in the diff — read those in full. IGNORE any other dirty file (CONTEXT.md, docs/, etc.): that is concurrent parallel-session work, not this change.`,
    `Use codegraph_explore to trace call paths around changed symbols. Be skeptical; default to finding a hole, not approving.`,
    `SCOPE DISCIPLINE (this is the loop-termination rule): before rating a finding "blocker" or "major", check it against THIS change's DECLARED scope (its tasks + design.md Goals/Non-Goals). A Non-Goal, or a pre-existing / cross-cutting concern the change does not claim to fix (a different concurrency pair, a sibling procedure it does not touch, an issue equally present BEFORE this change), is severity "minor" + a FOLLOW-UP — NEVER a blocker. Only the change's OWN new code being wrong, a regression it introduces, or a legitimate flow it breaks is blocker/major.`,
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
      `SCOPE DISCIPLINE: rate a finding "blocker"/"major" ONLY if it is the change's OWN new code being wrong, a regression it introduces, or a legit flow it breaks. A Non-Goal (per design.md), or a pre-existing / cross-cutting concern this change does not claim to fix (a different concurrency pair, an untouched sibling procedure, an issue equally present before this change), is "minor" + a follow-up — do NOT block on it or keep drilling it.`,
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
    impl: { summary: impl.summary, changedFiles },
    preexistingDirty,
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
      commitPaths: changedFiles,
      commitSubject: CHANGE.commitSubject,
      commitBody: CHANGE.commitBody,
    };
  }

  // Low-stakes: commit in-workflow. Codex "unavailable" is tolerated for low-stakes (noted).
  phase("Commit");
  const commit = await agent(
    [
      `Commit the uncommitted change ${CHANGE.name} on branch impl/backlog-2026-06-30 at ${REPO}. The full gate already passed; do NOT re-run it.`,
      `Stage EXACTLY these paths and NOTHING else (a parallel session may have other dirty files — never stage those): \`cd ${REPO} && git add\` followed by each of:`,
      ...changedFiles.map((p) => `    ${p}`),
      `Do NOT use \`git add .\` or \`git add -A\`. After staging, run \`git status --porcelain\` and confirm the STAGED set is exactly the paths above; if a path above is somehow not dirty, or staging pulled in anything else, STOP and report committed:false with the surprise in summary.`,
      `Then \`git commit\` with this message:`,
      ``,
      `  Subject: ${CHANGE.commitSubject}`,
      ``,
      `  Body:`,
      CHANGE.commitBody,
      ``,
      `  End the commit message with exactly this trailer line:`,
      `  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`,
      ``,
      `If a pre-commit hook reformats staged files, re-add them and retry the commit once. After committing, the only remaining dirty paths should be .claude/ and any parallel-session files — that is expected. Report committed, the new short sha, and a one-line summary listing the committed paths.`,
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
