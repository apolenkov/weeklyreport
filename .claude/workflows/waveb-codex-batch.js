export const meta = {
  name: "waveb-codex-batch",
  description:
    "Implement ONE group of seam-DISJOINT low-stakes web-UI OpenSpec changes in PARALLEL on the shared tree via Codex lanes (edit-only, no toolchain), then ONE combined gate, then per-change 2 Claude adversarial lenses (fan-out), then commit each fully-green change separately. Cross-vendor by construction: GPT writes, Claude reviews.",
  phases: [
    { title: "Preflight" },
    { title: "Implement" },
    { title: "Gate" },
    { title: "Verify" },
    { title: "Commit" },
  ],
};

const REPO = "/home/user/work/customreport";
const BASE_SHA = "9781a54f";

const STANDARDS = [
  "Exemplary code standard: functional/immutable (const, pure fns, map/filter/reduce + spread; avoid let/mutation); files < 250 lines; functions <= 50 lines; cognitive complexity < 10.",
  'NO fallbacks / silent defaults for product config (no `?? "localhost"`, no `.default()` in env.schema).',
  "UI strings in apps/web/**/*.tsx stay English (JSX/toast/aria/placeholder). Russian only in DB/seed data, comments, test fixtures.",
  "Comment hygiene: NO ticket/phase/change-slug prefixes in comments. Explain the WHY of current code only; never narrate what the code already says.",
  "Strict lint rules are ERRORS: require-await, no-unnecessary-condition, prefer-string-raw, jsdoc-on-private-helper. Changed paths MUST pass `eslint --max-warnings 0`.",
  "Reuse canonical helpers and existing test patterns in the same folder.",
];

// ---------------------------------------------------------------------------------------
// CONFIG: ONE group of disjoint low-stakes web-UI changes. Manifests verified pairwise
// disjoint (w2b triage). The commit stages ONLY these paths.
const GROUP = [
  {
    name: "admin-products-tab-state",
    files: [
      "openspec/changes/admin-products-tab-state/tasks.md",
      "apps/web/src/features/admin/ui/products-tab.tsx",
    ],
    testFiles: ["apps/web/src/features/admin/ui/products-tab.test.tsx"],
  },
  {
    name: "dashboard-skeleton-columns",
    files: [
      "openspec/changes/dashboard-skeleton-columns/tasks.md",
      "apps/web/src/features/dashboard/ui/dashboard-skeleton.tsx",
    ],
    testFiles: [
      "apps/web/src/features/dashboard/ui/dashboard-skeleton.test.tsx",
      "apps/web/src/features/dashboard/ui/__snapshots__/dashboard-skeleton.test.tsx.snap",
    ],
  },
  {
    name: "lead-form-save-indicator-truth",
    files: [
      "openspec/changes/lead-form-save-indicator-truth/tasks.md",
      "apps/web/src/shared/ui/report-shell/save-now-button.tsx",
    ],
    testFiles: [
      "apps/web/src/shared/ui/report-shell/save-now-button.test.tsx",
      "apps/web/src/hooks/use-lead-form-autosave.test.tsx",
    ],
    extraNote:
      "apps/web/src/hooks/use-lead-form-autosave.ts is READ-ONLY reference for this change — do not edit it.",
  },
  {
    name: "pdf-export-button-truthful-status",
    files: [
      "openspec/changes/pdf-export-button-truthful-status/tasks.md",
      "apps/web/src/features/pdf-export/ui/export-pdf-button.tsx",
    ],
    testFiles: [
      "apps/web/src/features/pdf-export/ui/export-pdf-button.test.tsx",
    ],
  },
  {
    name: "slides-react-defects",
    files: [
      "openspec/changes/slides-react-defects/tasks.md",
      "apps/web/src/features/slides/ui/head-slide-carousel.tsx",
      "apps/web/src/features/slides/ui/status-slide-deck.tsx",
      "apps/web/src/features/slides/ui/slide-article-rows.tsx",
    ],
    testFiles: [
      "apps/web/src/features/slides/ui/status-slide-deck.test.tsx",
      "apps/web/src/features/slides/ui/slide-article-rows.test.tsx",
      "apps/web/src/features/slides/ui/head-slide-carousel.test.tsx",
    ],
  },
  {
    name: "viewer-period-navigator-scope",
    files: [
      "openspec/changes/viewer-period-navigator-scope/tasks.md",
      "apps/web/src/features/period/ui/period-navigator.tsx",
      "apps/web/src/features/viewer/ui/viewer-report-shell.tsx",
    ],
    testFiles: [
      "apps/web/src/features/period/ui/period-navigator.test.tsx",
      "apps/web/src/features/viewer/ui/viewer-report-shell.test.tsx",
    ],
  },
  {
    name: "weekly-report-view-gaps",
    files: [
      "openspec/changes/weekly-report-view-gaps/tasks.md",
      "apps/web/src/features/report-sections/ui/weekly-report-page-view.ts",
      "apps/web/src/features/report-sections/ui/weekly-report-page-helpers.ts",
      "apps/web/src/features/report-sections/ui/use-weekly-report-page.ts",
    ],
    testFiles: [
      "apps/web/src/features/report-sections/ui/weekly-report-page.test.tsx",
    ],
    extraNote:
      "The proposal allows one NEW co-located test file if weekly-report-page.test.tsx is insufficient — if you create one, it must live in the same ui/ folder.",
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

const specPointer = (name) =>
  [
    `Read the FULL spec first and implement EVERY task exactly:`,
    `  openspec/changes/${name}/proposal.md`,
    `  openspec/changes/${name}/tasks.md   (tick its checkboxes as you complete tasks — EXCEPT the gates section, which the harness runs)`,
    `  openspec/changes/${name}/specs/   (delta specs — the normative requirements)`,
    `design.md may not exist; proposal + tasks + delta specs are the contract. Plan anchors (line numbers) may be slightly stale; trust the current code.`,
  ].join("\n");

// ---- Preflight (once) ----
phase("Preflight");
const pre = await agent(
  [
    `Working tree: ${REPO} (branch main, MVP phase).`,
    `Run, from ${REPO}:`,
    ...GROUP.map(
      (c) =>
        `  /usr/bin/git log ${BASE_SHA}..HEAD --oneline -- openspec/changes/${c.name}/`,
    ),
    `  /usr/bin/git status --porcelain`,
    `committedNames = the change names whose per-change git log above is NON-EMPTY (every implemented change commits its ticked tasks.md). preexistingDirty = every dirty path EXCLUDING anything under \`.claude/\`. note = anything genuinely surprising.`,
    `Do NOT edit anything. Report only.`,
  ].join("\n"),
  {
    label: `preflight:batch`,
    phase: "Preflight",
    model: "haiku",
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

// ---- Implement (PARALLEL Codex lanes, edit-only) ----
phase("Implement");
const implResults = await parallel(
  todo.map(
    (CHANGE) => () =>
      agent(
        [
          `Implement ONE OpenSpec change on a SHARED working tree at ${REPO} (branch main, MVP phase), ALONGSIDE other agents editing OTHER files concurrently.`,
          ``,
          `1. Objective: implement the OpenSpec change "${CHANGE.name}" with its unit tests, leaving ALL edits uncommitted.`,
          ``,
          `2. Files — HARD ISOLATION (a violation corrupts a concurrent agent's work): touch ONLY these paths (create/modify), NOTHING else:`,
          ...[...CHANGE.files, ...(CHANGE.testFiles || [])].map(
            (p) => `  ${p}`,
          ),
          CHANGE.extraNote ? `Note: ${CHANGE.extraNote}` : ``,
          ``,
          `3. Interfaces: ${specPointer(CHANGE.name)}`,
          ``,
          `4. Constraints:`,
          `- Do NOT run ANY toolchain command: NO prisma generate, NO pnpm typecheck, NO eslint, NO vitest, NO build. They share global state (.prisma client, turbo cache, Next dist) with concurrent agents and run later, once, in the combined gate. Reason about correctness by READING; do not execute checks.`,
          `- Do NOT touch git at all (no add/commit/stash/restore).`,
          `- Hard repo standards (violating any fails review):`,
          ...STANDARDS.map((s, i) => `  ${i + 1}. ${s}`),
          `- Tests must have TEETH (fail if the fix is reverted). Mirror existing test patterns in the same folder.`,
          ``,
          `5. Verification: NONE in this lane (edit-only) — the combined gate runs typecheck/lint/tests once for the whole batch afterwards.`,
          ``,
          `When done, return ONLY a one-paragraph prose summary of what you changed. Do NOT claim any check passed — you ran none.`,
        ]
          .filter(Boolean)
          .join("\n"),
        {
          label: `impl:${CHANGE.name}`,
          phase: "Implement",
          agentType: "codex-implementer",
          model: "sonnet",
          effort: "medium",
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
    `4. cd ${REPO} && pnpm test`,
    `5. cd ${REPO} && pnpm --filter @customreport/api test:integration   # full real-DB suite; container customreport-postgres-1 must be up; do NOT wrap vitest in rtk`,
    ``,
    `For each of typecheck/lint/unitTests/integrationTests report pass|fail|skip. redFiles = the list of FAILING test files (empty if none) — precise paths. summary = a short digest; for ANY failure include the precise error excerpt (file, message) so the orchestrator can attribute it to a change.`,
  ].join("\n"),
  {
    label: `gate:batch`,
    phase: "Gate",
    model: "sonnet",
    effort: "medium",
    schema: GATE_SCHEMA,
  },
);

const typeLintGreen = gate && gate.typecheck === "pass" && gate.lint === "pass";
const redFiles = (gate && gate.redFiles) || [];

// ---- Verify (per change: 2 Claude lenses, fanned out) ----
phase("Verify");
function scopeArg(CHANGE) {
  return [...CHANGE.files, ...(CHANGE.testFiles || [])]
    .map((p) => `'${p}'`)
    .join(" ");
}
function diffCmd(CHANGE) {
  return `cd ${REPO} && /usr/bin/git --no-pager diff HEAD -- ${scopeArg(CHANGE)}`;
}
function verifyHead(CHANGE) {
  return [
    `Adversarially verify an UNCOMMITTED change on the working tree at ${REPO}: ${CHANGE.name}.`,
    `Read the intent FIRST: openspec/changes/${CHANGE.name}/proposal.md, tasks.md, and the delta specs under openspec/changes/${CHANGE.name}/specs/.`,
    `This change's files: ${[...CHANGE.files, ...(CHANGE.testFiles || [])].join(", ")}. Read the diff: \`${diffCmd(CHANGE)}\`. A NEWLY CREATED file will not appear in that diff — read it in full. IGNORE every other dirty file (other changes in this batch): not your concern.`,
    `READ THE TEST DIFF BEFORE THE CODE DIFF: any weakened/deleted assertion in a pre-existing test is at least "major".`,
    `SCOPE DISCIPLINE (loop-termination): rate a finding blocker/major ONLY if it is THIS change's own new code being wrong, a regression it introduces, or a legit flow it breaks. A Non-Goal, a refuted-and-dispositioned claim, or a pre-existing/cross-cutting issue equally present before this change, is "minor" + a follow-up — never a blocker.`,
  ].join("\n");
}

const reviews = await parallel(
  implemented.flatMap((CHANGE) => [
    () =>
      agent(
        [
          verifyHead(CHANGE),
          `LENS — ENUMERATED COMPLETENESS + REACHABILITY. Build the checklist YOURSELF from tasks.md (every task) and every requirement/scenario in the delta specs. Confirm the diff satisfies EVERY item; name any missing or partial one. Then ask the proposal's own reachability question: can the bad outcome it describes still be reached? For each gap: file:line, concrete scenario, severity.`,
        ].join("\n"),
        {
          label: `verify:${CHANGE.name}`,
          phase: "Verify",
          model: "opus",
          effort: "high",
          schema: VERIFY_SCHEMA,
        },
      ).then((v) => ({ name: CHANGE.name, kind: "verify", v })),
    () =>
      agent(
        [
          verifyHead(CHANGE),
          `LENS — REGRESSION + STANDARDS + TEST TEETH. Which legitimate existing flows touch the changed components? Trace each; name any the diff breaks or falsely rejects. Check for: new let/mutation where const/pure fits; non-English UI string in apps/web tsx; ticket/phase/change-slug comment prefix; function > 50 lines or file > 250 lines introduced. Confirm new/changed tests have TEETH (fail on revert). For each issue: file:line, concrete scenario, severity.`,
        ].join("\n"),
        {
          label: `regress:${CHANGE.name}`,
          phase: "Verify",
          model: "opus",
          effort: "high",
          schema: VERIFY_SCHEMA,
        },
      ).then((v) => ({ name: CHANGE.name, kind: "regress", v })),
  ]),
);

const findingsByName = new Map(implemented.map((c) => [c.name, []]));
const lensCountByName = new Map(implemented.map((c) => [c.name, 0]));
for (const r of reviews.filter(Boolean)) {
  if (r.v) {
    lensCountByName.set(r.name, lensCountByName.get(r.name) + 1);
    if (r.v.findings) findingsByName.get(r.name).push(...r.v.findings);
  }
}
const isBlocking = (f) => f.severity === "blocker" || f.severity === "major";

// ---- Commit (per change; only fully-green ones) ----
phase("Commit");
const ledger = [];
for (const CHANGE of implemented) {
  const findings = findingsByName.get(CHANGE.name) || [];
  const blockers = findings.filter(isBlocking);
  const own = [...CHANGE.files, ...(CHANGE.testFiles || [])];
  const ownRed = redFiles.filter((rf) =>
    own.some((p) => rf === p || rf.endsWith(`/${p}`) || p.endsWith(`/${rf}`)),
  );

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
  // A dead lens slot is NOT a clean review.
  if ((lensCountByName.get(CHANGE.name) || 0) < 2) {
    ledger.push({ name: CHANGE.name, status: "parked-verify-incomplete" });
    continue;
  }
  if (blockers.length > 0) {
    ledger.push({ name: CHANGE.name, status: "parked-blocker", blockers });
    continue;
  }

  const commit = await agent(
    [
      `Commit ONE change (${CHANGE.name}) on branch main at ${REPO}. The combined gate already passed and this change's tests are green; do NOT re-run the gate. Do NOT push.`,
      `Stage EXACTLY these paths and NOTHING else (skip a path that is not dirty): ${own.join(", ")}.`,
      `Run \`cd ${REPO} && git add\` with exactly those paths (NEVER \`git add .\`/\`-A\`). Then \`/usr/bin/git status --porcelain\` and confirm the STAGED set is a subset of those paths; if staging pulled in anything else, STOP and report committed:false with the surprise.`,
      `Craft the commit subject yourself from openspec/changes/${CHANGE.name}/proposal.md's Why section: conventional-commit format \`fix(web): <what actually changed>\`, <= 90 chars. Body: one short paragraph per the proposal's Why. No ticket/BL prefixes.`,
      `End the commit message with exactly these trailer lines:`,
      `  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`,
      `  Claude-Session: https://example.invalid/private-review`,
      `If a pre-commit hook reformats staged files, re-add exactly those paths and retry once. Report committed, the new short sha, and the committed paths.`,
    ].join("\n"),
    {
      label: `commit:${CHANGE.name}`,
      phase: "Commit",
      model: "sonnet",
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
    redFiles,
    summary: gate && gate.summary,
  },
  implFailed: implFailed.map((c) => c.name),
  ledger,
  preexistingDirty,
};
