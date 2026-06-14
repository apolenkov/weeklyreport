export const meta = {
  name: "finish-backlog-2026-06-13",
  description:
    "Finish the section-A ready backlog: driver-findings (risky 4, archive), polish-subset (1.1/1.2/3.1/3.2, no archive), refactor-lead-dialog live-walk verify (no archive). Implement -> 2-3 review lenses -> fix -> verify/archive, agentWithRetry.",
  whenToUse:
    "Section A of docs/handoff-finish-backlog-2026-06-13.md. Sequential to avoid browser contention. No push. Two acceptance-gated changes archive only after the user signs off.",
  phases: [
    {
      title: "Implement",
      detail:
        "sequential: driver-findings (archive), polish-subset (no archive)",
    },
    {
      title: "Verify",
      detail:
        "refactor-lead-dialog live walk 5.2 + gates, hold archive for 5.3",
    },
  ],
};

const REPO = "/Users/wrk/work/customreport";
const TRAILER =
  "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>";

const IMPL_SCHEMA = {
  type: "object",
  required: ["status", "summary"],
  properties: {
    status: { type: "string", enum: ["done", "blocked", "failed"] },
    summary: { type: "string" },
    commit: { type: "string" },
    openQuestions: { type: "array", items: { type: "string" } },
  },
};

const REVIEW_SCHEMA = {
  type: "object",
  required: ["findings"],
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        required: ["title", "severity", "detail"],
        properties: {
          title: { type: "string" },
          severity: { type: "string", enum: ["blocker", "major", "minor"] },
          detail: { type: "string" },
          file: { type: "string" },
        },
      },
    },
  },
};

const COMMON_RULES = `
Repo: ${REPO} (work from repo root; pnpm only, never npm/yarn).
Read ${REPO}/CLAUDE.md first and obey it. Hard rules:
- Production UI strings in apps/web/src/**/*.tsx must be English (Russian only in data/comments/tests).
- Surgical edits: touch only what the change requires; never reformat unrelated code; remove orphans your edit created.
- Never weaken or delete a test just to get green; update tests to the NEW contract when the change redefines it.
- No magic numbers in logic — named consts.
- Do NOT push to any remote under any circumstances. Do NOT touch prod DB. Do NOT start dark-mode/theme/background work.
- The file apps/web/src/components/weekly-report/__snapshots__/product-accordion.test.tsx.snap has a PRE-EXISTING uncommitted modification — never stage or revert it.
- The current branch is feat/finish-backlog-2026-06-13 — commit here, never checkout/switch/create branches, never push.
- If you must run pnpm install/add: append --network-concurrency=1 (repo-known hazard: parallel install wipes node_modules).
- e2e/ is eslint-ignored and not tsc-gated; if you touch e2e, validate with "npx playwright test --list" and "node --check".
- Dev servers run on :3000/:3002 with hot reload — do not kill them.
- Local/dev/test DBs are disposable (MVP rule): reseed/reset freely with the PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION env var per CLAUDE.md; never touch anything named prod.
- Commit trailer (use EXACTLY): "${TRAILER}".`;

function reviewPrompt(id, lens, implSummary) {
  return `READ-ONLY adversarial review (lens: ${lens}) of OpenSpec change "${id}" just implemented in ${REPO}. You may run git/grep/read/test commands but must make NO edits and NO commits.
Implementer's claim: ${implSummary}
Locate its commit(s): "git log --oneline -10" then "git show <hash>". Verify against openspec/changes/${id}/ artifacts.
Hunt for: (a) tasks checked but not implemented; (b) correctness bugs in the diff; (c) broken shared contracts (packages/shared consumers, cross-role seams); (d) dishonest tests (weakened/deleted assertions, tests that cannot fail); (e) repo-rule violations: Russian production UI strings, magic numbers, orphaned imports, unrelated reformatting; (f) for UI changes — plausible match to the user intent in the proposal.
Report ONLY findings you verified are real (cite file:line or commit). severity: blocker = wrong behavior/broken gate; major = real defect, cheap to fix now; minor = note for later.`;
}

function fixPrompt(id, findings) {
  return `Fix the verified review findings for OpenSpec change "${id}" in ${REPO}.
Findings (JSON): ${JSON.stringify(findings)}
Minimal fixes only — no scope creep. Re-run gates: pnpm typecheck && pnpm lint + targeted vitest for the packages you touched. Commit (stage only files you touched by explicit path, conventional "fix:" message mentioning ${id}, same co-author trailer).
${COMMON_RULES}
Return StructuredOutput: status done/failed; summary; commit.`;
}

function archivePrompt(id) {
  return `Verify and archive the OpenSpec change "${id}" in ${REPO} (its implementation passed adversarial review).
1. Follow ${REPO}/.claude/skills/openspec-verify-change/SKILL.md: confirm implementation is complete, correct, coherent vs openspec/changes/${id}/ artifacts; ALL tasks checked.
2. Only if verification is CLEAN: follow ${REPO}/.claude/skills/openspec-archive-change/SKILL.md — sync delta specs into openspec/specs/ where the lifecycle requires, then archive the change (use the openspec CLI, e.g. "npx openspec archive ${id} --yes" if available; otherwise the skill's manual steps). Commit the archive move (stage only openspec/ paths it touched, "chore(openspec): archive ${id}", co-author trailer).
3. If verification finds gaps (any unchecked task, any mismatch): do NOT archive, make no edits, return status "blocked" with the gap list — the change stays active.
${COMMON_RULES}
Return StructuredOutput: status done(=archived)/blocked/failed; summary; commit.`;
}

const AGENT_ATTEMPTS = 3;
async function agentWithRetry(promptText, opts) {
  for (let i = 0; i < AGENT_ATTEMPTS; i++) {
    const p =
      i === 0
        ? promptText
        : `RETRY ${i} of a previous attempt that hit its turn limit mid-work. Its edits and tasks.md checkboxes are already ON DISK — orient with "git status --short" + "git log --oneline -5", then CONTINUE from where it stopped; do not redo finished work. Budget your turns: leave room to run the gates and return StructuredOutput even if some tasks remain unchecked (then status "blocked" with the remainder listed).\n\nOriginal task:\n${promptText}`;
    try {
      const r = await agent(p, opts);
      if (r) return r;
      log(`${opts.label}: attempt ${i + 1}/${AGENT_ATTEMPTS} returned null`);
    } catch (e) {
      log(
        `${opts.label}: attempt ${i + 1}/${AGENT_ATTEMPTS} threw (${String(e).slice(0, 140)})`,
      );
    }
  }
  return null;
}

// implement -> reviews -> fix -> (optional) archive, for ONE change.
async function runChange({ id, implPrompt, lenses, doArchive }) {
  const impl = await agentWithRetry(implPrompt, {
    label: `apply:${id}`,
    phase: "Implement",
    schema: IMPL_SCHEMA,
  });
  if (!impl) {
    return { id, status: "failed", summary: "implementer died after retries" };
  }
  if (impl.status !== "done") {
    return {
      id,
      status: impl.status,
      summary: impl.summary,
      openQuestions: impl.openQuestions ?? [],
    };
  }

  const reviews = await parallel(
    lenses.map(
      (lens) => () =>
        agent(reviewPrompt(id, lens, impl.summary), {
          label: `review:${id}:${lens}`,
          phase: "Implement",
          schema: REVIEW_SCHEMA,
        }),
    ),
  );
  const findings = reviews.filter(Boolean).flatMap((r) => r.findings);
  const mustFix = findings.filter(
    (f) => f.severity === "blocker" || f.severity === "major",
  );
  const minors = findings.filter((f) => f.severity === "minor");

  let fixSummary = null;
  let fixFailed = false;
  if (mustFix.length > 0) {
    log(`${id}: ${mustFix.length} must-fix finding(s) -> fixer`);
    const fix = await agentWithRetry(fixPrompt(id, mustFix), {
      label: `fix:${id}`,
      phase: "Implement",
      schema: IMPL_SCHEMA,
    });
    fixSummary = fix ? `${fix.status}: ${fix.summary}` : "fixer agent died";
    fixFailed = !fix || fix.status !== "done";
  }

  let archive = null;
  if (doArchive && !fixFailed) {
    archive = await agentWithRetry(archivePrompt(id), {
      label: `archive:${id}`,
      phase: "Implement",
      schema: IMPL_SCHEMA,
    });
  }

  log(
    `${id}: done${archive && archive.status === "done" ? " + archived" : doArchive ? " (archive blocked/held)" : " (archive intentionally held)"} — ${mustFix.length} fixed, ${minors.length} minor`,
  );
  return {
    id,
    status: "done",
    archived: archive ? archive.status === "done" : false,
    archiveNote: archive ? archive.summary : "not archived (held by design)",
    summary: impl.summary,
    commit: impl.commit ?? null,
    openQuestions: impl.openQuestions ?? [],
    reviewFindings: { mustFix, minors },
    fixSummary,
  };
}

// ---- Phase 1: implement the two code changes, sequentially ----
phase("Implement");
const results = [];

// 1) driver-findings: risky 4 (2.1-2.4) + gate 2.5; all carry decisions; archive.
log("=== driver-findings-2026-06-11 (1/3) ===");
const driverImpl = `Implement the OpenSpec change "driver-findings-2026-06-11" in ${REPO}.
Start: "git status --short" and "git log --oneline -5" to orient. Read ALL artifacts in openspec/changes/driver-findings-2026-06-11/ (proposal.md, design.md if present, specs/, tasks.md). Tasks 1.1-1.5 are ALREADY done — start at the first unchecked task under "## Risky" (2.1) and work 2.1 -> 2.2 -> 2.3 -> 2.4 -> 2.5 in order, checking boxes as you go.
Every risky task ALREADY HAS A DECISION written in tasks.md (2.2 scope-by-access, 2.3 add Export-PDF, etc.) — follow it; do NOT block on these, they are resolved.
Per-task discipline (the change file demands it): re-verify each finding/fix in the LIVE browser at http://localhost:3000 (Playwright MCP via ToolSearch; dev-login as the named role) BEFORE checking its box — the driver skeptic is fallible in both directions. Follow ${REPO}/.claude/skills/openspec-apply-change/SKILL.md.
This is a regression-heavy, cross-role area: read existing tests before changing query/error-policy/period semantics and extend them to the new contract (2.1 adds a client-error-policy delta that MUST be covered by formatter + retry-predicate tests; 2.5 enforces this).
Gates before EACH commit (fix everything YOUR edits broke): pnpm typecheck && pnpm lint, plus vitest for the packages you touched. One task = one commit; stage ONLY files this change touched (git add by explicit path, never -A); conventional message naming the change in the body.
If a task genuinely conflicts with a repo rule or lacks a decision the artifacts do not answer, STOP and return status "blocked" with the exact question — do not improvise.
${COMMON_RULES}
Return StructuredOutput: status done/blocked/failed; summary = what shipped per task + gate results; commit = hash(es); openQuestions = anything for the user.`;
results.push(
  await runChange({
    id: "driver-findings-2026-06-11",
    implPrompt: driverImpl,
    lenses: [
      "spec-fidelity",
      "correctness-and-contracts",
      "test-honesty-and-regressions",
    ],
    doArchive: true,
  }),
);

// 2) polish-subset: ONLY 1.1, 1.2, 1.4, 3.1, 3.2, 4.1, 4.2. SKIP 1.3 and all of section 2 (design items, section B of the handoff). No archive.
log("=== polish-lead-toolbar-and-risk-dialog [subset] (2/3) ===");
const polishImpl = `Implement a STRICT SUBSET of the OpenSpec change "polish-lead-toolbar-and-risk-dialog" in ${REPO}.
Read openspec/changes/polish-lead-toolbar-and-risk-dialog/{proposal.md,tasks.md} first.
DO EXACTLY these tasks, in this order, checking their boxes as you finish:
- 1.1 Archive toggle: remove the archived-count signal that reads as a CTA; make it a quiet inert indicator (ArchiveToggle -> report-shell/toolbar-icon-button.tsx). Keep switch behavior + aria.
- 1.2 Version "Coming soon" control: fully rounded, visually consistent with the 32x32 sibling controls (lead/version-coming-soon.tsx).
- 3.1 Slide hero: align the status badge ("Blockers", h-11) to the same height/baseline as sibling row elements in slides/lead-slide-hero.tsx. Named const, no magic number.
- 3.2 Verify 3.1 across statuses (on-track/at-risk/blocked) and product counts so no row wraps or misaligns.
- 1.4 Add a unit/render test per changed control (shape/aria/behavior).
- 4.1 Gates: pnpm typecheck && pnpm lint + vitest for touched web/ui packages.
- 4.2 Live re-check each changed item at :3000 (form + ?mode=slides) via Playwright MCP (ToolSearch); confirm before/after behavior. Save any screenshots under /tmp/finish-backlog-shots/ (mkdir -p first).
DO NOT TOUCH, do not implement, do not block on, and do not check: task 1.3 (fill-from/copy merge) and ALL of section 2 (risk-edit-dialog redesign). These are DESIGN items deferred to a separate round — leave their boxes unchecked and their code untouched. They are NOT a blocker for the subset above.
Presentation-only work: no logic/behavior changes beyond what each item states. UI strings stay English.
Commit discipline: one logical commit per task or a small batch; stage ONLY files you touched (explicit paths, never -A); conventional message naming the change in the body. Run gates before committing.
${COMMON_RULES}
Return StructuredOutput: status done (=the subset is complete; 1.3/§2 intentionally left) / blocked / failed; summary per task + gate results; commit = hash(es); openQuestions.`;
results.push(
  await runChange({
    id: "polish-lead-toolbar-and-risk-dialog",
    implPrompt: polishImpl,
    lenses: ["spec-fidelity", "correctness-and-contracts"],
    doArchive: false,
  }),
);

// ---- Phase 2: refactor-lead-dialog-lifecycle — verify only (live walk 5.2), archive HELD for 5.3 user acceptance ----
phase("Verify");
log("=== refactor-lead-dialog-lifecycle [verify only] (3/3) ===");
const refactorVerify = await agentWithRetry(
  `Verification-only pass for the OpenSpec change "refactor-lead-dialog-lifecycle" in ${REPO}. The code (tasks 1-4) and gates (5.1) are ALREADY done and committed. Only tasks 5.2 (live walk) and 5.3 (user acceptance) remain.
Your job: execute task 5.2 and report — DO NOT archive (5.3 needs the user's explicit sign-off, which you cannot give).
1. Re-run the gates to confirm still-green at HEAD: pnpm typecheck && pnpm lint, plus vitest for the web package (apps/web). Record exact results.
2. Live browser walk at http://localhost:3000 (Playwright MCP via ToolSearch; dev-login as lead) per task 5.2:
   - "+ Add Risk" -> cancel -> view a snapshot/version -> "Back to current" -> assert NO dialog reopens.
   - Same flow for "+ Add Decision".
   - Risk-dialog form-race (design D? / task 3.1): open the risk dialog, type text + pick a severity, trigger an autosave->invalidate cycle, assert the typed text/severity SURVIVE.
   - After "Toggle All": assert all sections still sync (task 4.1 groupSyncKey removal did not break it).
   Save screenshots of each checkpoint under /tmp/finish-backlog-shots/refactor-<n>.png (mkdir -p first).
3. Check the box on 5.2 in tasks.md ONLY if the live walk passes cleanly; commit that single tasks.md edit ("docs(openspec): record 5.2 live-walk pass for refactor-lead-dialog-lifecycle", co-author trailer). Leave 5.3 UNCHECKED.
DO NOT archive. DO NOT edit source code. If the live walk reveals a real regression, do NOT check 5.2 — return status "blocked" with the exact repro.
${COMMON_RULES}
Return StructuredOutput: status done (=5.2 walk clean, ready for user acceptance) / blocked (=regression found) / failed; summary = gate results + each walk checkpoint outcome + screenshot paths; commit; openQuestions.`,
  {
    label: "verify:refactor-lead-dialog-lifecycle",
    phase: "Verify",
    schema: IMPL_SCHEMA,
  },
);
results.push({
  id: "refactor-lead-dialog-lifecycle",
  status: refactorVerify ? refactorVerify.status : "failed",
  archived: false,
  archiveNote: "held for 5.3 user acceptance",
  summary: refactorVerify ? refactorVerify.summary : "verify agent died",
  commit: refactorVerify ? (refactorVerify.commit ?? null) : null,
  openQuestions: refactorVerify ? (refactorVerify.openQuestions ?? []) : [],
});

return {
  changes: results.map((r) => ({
    id: r.id,
    status: r.status,
    archived: r.archived ?? false,
    commit: r.commit ?? null,
    mustFix: r.reviewFindings ? r.reviewFindings.mustFix.length : 0,
    minors: r.reviewFindings ? r.reviewFindings.minors.length : 0,
    openQuestions: r.openQuestions ?? [],
    fixSummary: r.fixSummary ?? null,
    summary: r.summary,
  })),
};
