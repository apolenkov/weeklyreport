export const meta = {
  name: "overnight-everything",
  description:
    "Full overnight autonomy: capture feedback, implement+review+archive all OpenSpec changes, research memos, ai-ui-driver over 4 roles with low-risk autofix, final gates + morning report",
  whenToUse:
    "Launch from a fresh session for the overnight marathon (decisions grilled 2026-06-10, no push, tiered models)",
  phases: [
    {
      title: "Capture",
      detail:
        "6 OpenSpec changes from tonight's feedback (2 may already exist)",
    },
    {
      title: "Implement",
      detail: "sequential: apply → review ×2-3 → fix → verify+archive",
      model: "tiered sonnet/main",
    },
    {
      title: "Research",
      detail: "capture-only: driver env-feedback, versions-v2 model",
    },
    {
      title: "Drive",
      detail:
        "stripe acceptance, then ai-ui-driver lead/head/admin/viewer + low-risk autofix",
    },
    {
      title: "Finalize",
      detail: "repo-wide gates, dev stand restart, morning report",
    },
  ],
};

const REPO = "/Users/wrk/work/customreport";

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

const DRIVER_SCHEMA = {
  type: "object",
  required: ["findings", "summary"],
  properties: {
    summary: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        required: ["title", "severity", "detail", "route", "fixRisk"],
        properties: {
          title: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          detail: { type: "string" },
          route: { type: "string" },
          reproSteps: { type: "string" },
          fixRisk: { type: "string", enum: ["low", "risky"] },
        },
      },
    },
  },
};

const COMMON_RULES = `
Repo: ${REPO} (work from repo root; pnpm only, never npm/yarn).
Read ${REPO}/CLAUDE.md first and obey it. Hard rules for tonight:
- Production UI strings in apps/web/src/**/*.tsx must be English (Russian only in data/comments/tests).
- Surgical edits: touch only what the change requires; never reformat unrelated code; remove orphans your edit created.
- Never weaken or delete a test just to get green; update tests to the NEW contract when the change redefines it.
- No magic numbers in logic — named consts.
- Do NOT push to any remote under any circumstances. Do NOT touch prod DB. Do NOT start dark-mode/theme/background work.
- The file apps/web/src/components/weekly-report/__snapshots__/product-accordion.test.tsx.snap has a PRE-EXISTING uncommitted modification — never stage or revert it.
- If you must run pnpm install/add: append --network-concurrency=1 (repo-known hazard: parallel install wipes node_modules).
- e2e/ is eslint-ignored and not tsc-gated; if you touch e2e, validate with "npx playwright test --list" and "node --check".
- Dev servers run on :3000/:3002 with hot reload — do not kill them except where a prompt explicitly says so.
- Local/dev/test DBs are disposable (MVP rule): reseed/reset freely with the PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION env var per CLAUDE.md; never touch anything named prod.`;

const CAPTURE_RULES = `
You are creating ONE OpenSpec change in ${REPO}/openspec/changes/<id>/.
Study an existing recent change directory as the structural template (e.g. openspec/changes/require-risk-stage/) and openspec/config.yaml for lifecycle conventions. Produce: proposal.md (why/what/how), design.md only if real decisions exist, specs/ delta if the change adds a durable behavioral contract, tasks.md with small checkable tasks ending in test + gate tasks. Validate with "npx openspec validate <id>" if available. Make NO source-code edits — artifacts only. If the change directory ALREADY EXISTS (interrupted earlier run), review and complete/fix it instead of recreating. Return a one-paragraph summary.
${COMMON_RULES}`;

const CAPTURES = [
  {
    id: "align-pipeline-arrows",
    brief: `Change id: align-pipeline-arrows. (Directory may already exist — complete it.)
User feedback (lead report SDLC pipeline, apps/web/src/components/lead/sdlc-pipeline.tsx, flex-wrap container ~line 45): arrows between stage chips are NOT vertically aligned — assignee names render below each chip, the row is items-center, so arrows center on the (chip+name) block instead of the chip centerline. Requirement: arrow vertical center == chip vertical center, with and without assignee names, on every wrap row. Likely fix: stage cell becomes a column (chip + name) and arrows align to the chip box height (shared CSS var / grid row). Tests updated honestly.`,
  },
  {
    id: "save-now-pending-indicator",
    brief: `Change id: save-now-pending-indicator. (Directory may already exist — complete it.)
User feedback (apps/web/src/components/report-shell/save-now-button.tsx): while the manual save mutation is pending the button must show work in progress: spinner replaces the icon, aria-busy set, repeat clicks disabled, accent green fill (existing primary token, e.g. var(--color-starbucks-accent)) with white icon; revert on settle. Wire pending state end-to-end from the mutation. Unit test for pending render + disabled behavior.`,
  },
  {
    id: "head-toolbar-parity",
    brief: `Change id: head-toolbar-parity.
User feedback: the lead report toolbar (apps/web/src/components/report-shell/report-toolbar.tsx — rounded pill bar: border border-[rgba(0,0,0,0.08)] bg-[var(--color-surface-hover)]/70 px-2 py-1.5 rounded-[var(--radius)]) and the lead form header row are the style wanted on HEAD pages too. Survey head surfaces (dashboard / review) and port the same container style and control arrangement. Second part: where toolbar controls are text buttons, convert to compact 32px icon buttons with aria-label + tooltip, consistently on BOTH lead and head toolbars; behavior identical. Component-level parity, not a theme/rebrand. NOTE: runs AFTER defer-versions-coming-soon in tonight's queue — the version nav will already be hidden; design the toolbar around the remaining controls.`,
  },
  {
    id: "slides-product-autofit",
    brief: `Change id: slides-product-autofit.
User feedback (/lead/report/<id>?mode=slides, apps/web/src/components/slides/lead-slides-client.tsx — article.slide-frame ~680px): when picking a product via SlideProductChips the slide content should auto-align/fit the whole slide («авто-выравнивание по всему слайду, по аналогии как когда тему добавляем»). Study existing slides auto-fit/balance logic (rotateIfNeeded, redesign-head-slide-density artifacts in openspec/changes/, and what the "add theme" flow does) and capture the minimal consistent behavior: on product switch, content re-measures and distributes/scales to fill the frame without a large empty bottom and without overflow. Vaguest brief of the night: include an explicit "Open questions" section in proposal.md; scope tasks.md to the conservative core.`,
  },
  {
    id: "defer-versions-coming-soon",
    brief: `Change id: defer-versions-coming-soon.
User decision (2026-06-10, grilled and confirmed): version history is DEFERRED — too complex for now, and it has a fidelity bug (user restored v3, stage statuses shown did not match what was saved; a version must fully determine page state and today it does not). Contract:
1. Hide the version navigation UI (VersionHistoryNav Previous/v3/Next inside report-toolbar, apps/web/src/components/lead/version-history-nav.tsx) behind the repo's deferred-feature pattern: ComingSoonBadge tooltip on an inert control (reference: nav-bar.tsx LanguageComingSoonControl; spec: openspec/specs/deferred-feature-pattern).
2. Disable snapshot WRITES too (explicit user choice over keep-writing): stop invoking version-snapshot creation from autosave/manual-save paths; mark every call site with TODO(defer-versions-coming-soon). Restore/read endpoints: loud stub per the deferred-backend rule ("throw new Error('Not implemented -- see TODO(defer-versions-coming-soon)')") or unreachable behind the inert UI. Keep the schema/tables — NO destructive migration.
3. Saving becomes maximally stable (the user's #1 ask): audit autosave + Save-now end-to-end, make sure removing version writes does not break either path, add/extend tests for save reliability (debounce, error surfacing, manual save).
4. Document the fidelity bug in proposal.md as the deferral reason so the future re-enable change starts from it.
Interaction: save-now-pending-indicator lands earlier tonight and also touches SaveNowButton — build on its state.`,
  },
  {
    id: "unify-risk-stage-status",
    brief: `Change id: unify-risk-stage-status.
User-confirmed direction (2026-06-10): «хочется, чтобы риск и статус были согласованы». Today the coupling is half-built: a risk row (severity at-risk, stage Development) exists while the Dev stage chip shows on-track — nothing connects them in that direction. Existing machinery to reuse (apps/web): use-status-risk-sync / use-status-risk-coupling hooks + tests, computeUnbackedStages in components/lead/lead-form-sync-bridge.tsx (at-risk/blocked stages WITHOUT a backing risk are already flagged), deriveEffectiveStageStatus (deliberately disconnected in lib/mappers/lead-form.ts mapLeadProducts — PRJ-2 comment "explicit chip status must win"; this change SUPERSEDES that decision, document why).
Target contract:
1. Risks/blockers are authored ONLY in the Risks section — single source of truth for at-risk/blocked.
2. A non-empty risk covering a stage forces that chip to at least the risk's severity (at-risk < blocked); the chip cannot be on-track while covering risks exist.
3. Setting a chip to at-risk/blocked with no covering risk opens the risk edit dialog prefilled (product, stage, severity); cancel reverts the chip. The "unbacked stage" warning becomes prevention.
4. Setting a chip back to on-track with covering risks asks confirmation "this deletes N risk(s)"; on confirm the covering risks are deleted, then the chip flips.
5. External issue-tracker integration OUT of scope — risks live in the weekly report.
require-risk-stage lands BEFORE this one tonight — build on it. Regression-heavy area (CLAUDE.md): read existing tests before changing sync/query semantics and extend them to the new contract.`,
  },
];

// Tiered models (grill decision 2026-06-10): well-specified mechanical work →
// sonnet; design-heavy / ambiguous → main model (omit). Reviewers/driver/research
// always main. No haiku anywhere.
const SONNET = new Set([
  "defer-uat-codequality-vercel-2026-05-26",
  "wire-prisma-typecheck-gate",
  "add-version-pin",
  "remove-dead-modules",
  "migrate-health-indicator-service",
  "refactor-test-timer-helpers",
  "refactor-test-db-cleanup",
  "refactor-trpc-infra-duplication",
  "refactor-web-trpc-test-harness",
  "hoist-query-error-policy",
  "add-scope-accessed-audit",
  "autofocus-admin-dialogs",
  "mount-agent-review-placeholder",
  "align-pipeline-arrows",
  "save-now-pending-indicator",
]);

const QUEUE = [
  "defer-uat-codequality-vercel-2026-05-26",
  "wire-prisma-typecheck-gate",
  "add-version-pin",
  "remove-dead-modules",
  "migrate-health-indicator-service",
  "refactor-test-timer-helpers",
  "refactor-test-db-cleanup",
  "refactor-trpc-infra-duplication",
  "refactor-web-trpc-test-harness",
  "hoist-query-error-policy",
  "add-scope-accessed-audit",
  "add-role-gate",
  "fix-lead-surface-name-resolution",
  "refactor-lead-mappers",
  "refactor-lead-dialog-lifecycle",
  "fix-section-add-signal-reset",
  "autofocus-admin-dialogs",
  "mount-agent-review-placeholder",
  "redesign-head-slide-density",
  "require-risk-stage",
  "align-pipeline-arrows",
  "save-now-pending-indicator",
  "defer-versions-coming-soon",
  "head-toolbar-parity",
  "slides-product-autofit",
  "unify-risk-stage-status",
];

const RISKY = new Set([
  "require-risk-stage",
  "redesign-head-slide-density",
  "unify-risk-stage-status",
  "slides-product-autofit",
  "defer-versions-coming-soon",
]);

function implPrompt(id) {
  return `Implement the OpenSpec change "${id}" in ${REPO}.
Start: run "git status --short" and "git log --oneline -3" to orient. Read ALL artifacts in openspec/changes/${id}/ (proposal.md, design.md if present, specs/, tasks.md). Some tasks may already be checked — continue from the first unchecked one. Follow the discipline written in ${REPO}/.claude/skills/openspec-apply-change/SKILL.md.
Work through every unchecked task in order, checking boxes in tasks.md as you complete them. If a task demands a product decision the artifacts do not answer, or conflicts with repo rules (theme/dark-mode research-only, no director workflow), STOP and return status "blocked" with the exact open question — do not improvise.
Gates before committing (fix everything YOUR edits broke): pnpm typecheck && pnpm lint, plus vitest for the packages you touched.
Commit when green: stage ONLY files this change touched (git add by explicit path), conventional message with the change id in the body, plus trailer "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>". Never "git add -A".
${COMMON_RULES}
Return StructuredOutput: status done/blocked/failed; summary = what shipped + gate results (plain sentences); commit = hash(es); openQuestions = anything the user must decide in the morning.`;
}

function reviewPrompt(id, lens, implSummary) {
  return `READ-ONLY adversarial review (lens: ${lens}) of OpenSpec change "${id}" just implemented in ${REPO}. You may run git/grep/read/test commands but must make NO edits and NO commits.
Implementer's claim: ${implSummary}
Locate its commit(s): "git log --oneline -8" then "git show <hash>". Verify against openspec/changes/${id}/ artifacts.
Hunt for: (a) tasks checked but not implemented; (b) correctness bugs in the diff; (c) broken shared contracts (packages/shared consumers); (d) dishonest tests (weakened/deleted assertions, tests that cannot fail); (e) repo-rule violations: Russian production UI strings, magic numbers, orphaned imports, unrelated reformatting; (f) for UI changes — plausible match to the user intent in the proposal.
Report ONLY findings you verified are real (cite file:line or commit). severity: blocker = wrong behavior/broken gate; major = real defect, cheap to fix tonight; minor = morning note.`;
}

function fixPrompt(id, findings) {
  return `Fix the verified review findings for OpenSpec change "${id}" in ${REPO}.
Findings (JSON): ${JSON.stringify(findings)}
Minimal fixes only — no scope creep. Re-run gates: pnpm typecheck && pnpm lint + targeted vitest. Commit (stage only files you touched, conventional "fix:" message mentioning ${id}, same co-author trailer).
${COMMON_RULES}
Return StructuredOutput: status done/failed; summary; commit.`;
}

function archivePrompt(id) {
  return `Verify and archive the OpenSpec change "${id}" in ${REPO} (its implementation passed adversarial review tonight).
1. Follow ${REPO}/.claude/skills/openspec-verify-change/SKILL.md: confirm implementation is complete, correct, coherent vs openspec/changes/${id}/ artifacts; all tasks checked.
2. Only if verification is CLEAN: follow ${REPO}/.claude/skills/openspec-archive-change/SKILL.md — sync delta specs into openspec/specs/ where the lifecycle requires, then archive the change (use the openspec CLI, e.g. "npx openspec archive ${id} --yes" if available; otherwise the skill's manual steps). Commit the archive move (stage only openspec/ paths it touched, "chore(openspec): archive ${id}", co-author trailer).
3. If verification finds gaps: do NOT archive, make no edits, return status "blocked" with the gap list — the change stays active for morning review.
${COMMON_RULES}
Return StructuredOutput: status done(=archived)/blocked/failed; summary; commit.`;
}

// A schema-bound agent that hits its turn ceiling before calling
// StructuredOutput THROWS and kills the whole run (happened 3x on
// 2026-06-11). Retry with a continuation prompt: edits and tasks.md
// checkboxes persist on disk, so every attempt advances. The retry prefix
// also changes the cache key, so attempts never collide on resume.
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

// ---- Phase 1: capture feedback as OpenSpec changes ----
phase("Capture");
log(
  "Capturing 6 feedback items as OpenSpec changes (2 may already exist from the interrupted run)",
);
const captureResults = await parallel(
  CAPTURES.map(
    (c) => () =>
      agent(`${c.brief}\n${CAPTURE_RULES}`, {
        label: `capture:${c.id}`,
        phase: "Capture",
      }),
  ),
);
captureResults.forEach((r, i) =>
  log(`capture ${CAPTURES[i].id}: ${r ? "ok" : "FAILED"}`),
);

// One commit for all capture artifacts so the implement phase starts clean.
await agent(
  `In ${REPO}: commit tonight's freshly captured OpenSpec change directories. Run "git status --short" — stage ONLY untracked/modified paths under openspec/changes/ (never the product-accordion snapshot, never source files). Commit message "chore(openspec): capture tonight's feedback changes (6)" with trailer "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>". Return the commit hash.`,
  {
    label: "commit-captures",
    phase: "Capture",
    model: "sonnet",
  },
);

// ---- Phase 2: strictly sequential implementation with review + archive gates ----
phase("Implement");
const results = [];
for (const id of QUEUE) {
  log(`=== ${id} (${results.length + 1}/${QUEUE.length}) ===`);
  const implOpts = {
    label: `apply:${id}`,
    phase: "Implement",
    schema: IMPL_SCHEMA,
  };
  if (SONNET.has(id)) implOpts.model = "sonnet";
  const impl = await agentWithRetry(implPrompt(id), implOpts);
  if (!impl) {
    results.push({
      id,
      status: "failed",
      summary: `implementer died after ${AGENT_ATTEMPTS} attempts — change left active, partial work may be on disk`,
    });
    log(`${id}: FAILED after ${AGENT_ATTEMPTS} attempts, moving on`);
    continue;
  }
  if (impl.status !== "done") {
    results.push({
      id,
      status: impl.status,
      summary: impl.summary,
      openQuestions: impl.openQuestions ?? [],
    });
    log(`${id}: ${impl.status} — ${impl.summary.slice(0, 140)}`);
    continue;
  }

  const lenses = RISKY.has(id)
    ? [
        "spec-fidelity",
        "correctness-and-contracts",
        "test-honesty-and-regressions",
      ]
    : ["spec-fidelity", "correctness-and-contracts"];
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
    log(`${id}: ${mustFix.length} must-fix finding(s) → fixer`);
    const fix = await agentWithRetry(fixPrompt(id, mustFix), {
      label: `fix:${id}`,
      phase: "Implement",
      schema: IMPL_SCHEMA,
    });
    fixSummary = fix ? `${fix.status}: ${fix.summary}` : "fixer agent died";
    fixFailed = !fix || fix.status !== "done";
  }

  // Archive only clean work (grill decision: night DOES archive; gaps stay active).
  let archive = null;
  if (!fixFailed) {
    archive = await agentWithRetry(archivePrompt(id), {
      label: `archive:${id}`,
      phase: "Implement",
      schema: IMPL_SCHEMA,
      model: "sonnet",
    });
  }

  results.push({
    id,
    status: "done",
    archived: archive ? archive.status === "done" : false,
    archiveNote: archive ? archive.summary : "skipped (fix failed)",
    summary: impl.summary,
    commit: impl.commit ?? null,
    openQuestions: impl.openQuestions ?? [],
    reviewFindings: { mustFix, minors },
    fixSummary,
  });
  log(
    `${id}: done${archive && archive.status === "done" ? " + archived" : " (left active)"} — ${mustFix.length} fixed, ${minors.length} minor`,
  );
}

// ---- Phase 3: capture-only research ----
phase("Research");
const research = await parallel([
  () =>
    agent(
      `Capture-only research task in ${REPO} — NO source-code edits, NO commits of source files.
Design how ai-ui-driver runs should collect ENVIRONMENT feedback as a post-run stage: browser console errors, app logs (pnpm logs / pnpm logs:errors), Bugsink, Loki — correlated with the drive timeline. Study .claude/skills/ai-ui-driver/SKILL.md and the observability stack (pnpm observability:up, docker compose files).
Deliverable: a DRAFT OpenSpec change "driver-env-feedback-stage" (proposal.md + unchecked tasks.md, no implementation) in openspec/changes/. Commit only that directory ("chore(openspec): capture driver-env-feedback-stage draft", co-author trailer "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>").
${COMMON_RULES}
Return a one-paragraph summary.`,
      { label: "research:driver-env-feedback", phase: "Research" },
    ),
  () =>
    agent(
      `Capture-only research task in ${REPO} — NO source-code edits, NO commits of source files.
Versions v2: research the CORRECT versioning model for the weekly report, starting from tonight's fidelity bug (restoring v3 showed stage statuses that did not match the saved state — a version must fully determine everything visible on the lead report page). Study the current snapshot implementation (version-history-nav, the snapshot write path being disabled tonight by defer-versions-coming-soon, the Prisma schema), then weigh real alternatives (full-state snapshot vs event-log vs hybrid; restore semantics; interaction with publish/period locks). Web research on best practices is allowed.
Deliverable: a DRAFT OpenSpec change "versions-v2-restore-fidelity" (proposal.md with options+recommendation, unchecked tasks.md, no implementation) in openspec/changes/. Commit only that directory ("chore(openspec): capture versions-v2 draft", co-author trailer "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>").
${COMMON_RULES}
Return a one-paragraph summary.`,
      { label: "research:versions-v2", phase: "Research" },
    ),
]);

// ---- Phase 4: stripe acceptance + ai-ui-driver over all roles ----
phase("Drive");
const stripe = await agentWithRetry(
  `Acceptance pass for the already-Complete OpenSpec change "fix-lead-stripe-and-archived-badges" in ${REPO}.
1. Verify per ${REPO}/.claude/skills/openspec-verify-change/SKILL.md against its artifacts.
2. Verify the SUBSTANCE in the live browser at http://localhost:3000 (Playwright MCP via ToolSearch; dev-login as lead): the Previous/Archived pills behavior described in the proposal. Save screenshots to /tmp/overnight-shots/stripe-<n>.png (mkdir -p first).
3. Clean on both counts → archive it per .claude/skills/openspec-archive-change/SKILL.md + commit. Any doubt → do NOT archive, report the doubt.
${COMMON_RULES}
Return StructuredOutput: status done(=archived)/blocked/failed; summary incl. screenshot paths.`,
  {
    label: "accept:stripe",
    phase: "Drive",
    schema: IMPL_SCHEMA,
  },
);

const ROLES = ["lead", "head", "admin", "viewer"];
const driverRuns = [];
for (const role of ROLES) {
  const run = await agentWithRetry(
    `Execute the ai-ui-driver skill for role "${role}".
Read ${REPO}/.claude/skills/ai-ui-driver/SKILL.md IN FULL and follow it (including its scripts/ helpers and oracle catalogs) against http://localhost:3000 using Playwright MCP tools (load via ToolSearch; use --noproxy for localhost if shelling out). Dev-login stub is enabled.
Known lesson (repo memory): the driver's verify skeptic both false-confirms AND false-dismisses — re-verify every finding in the live browser before reporting; never edit the oracle catalog to silence a finding.
Tonight ~26 OpenSpec changes landed — expect intentional UI changes; compare against the CHANGED contracts (read the archive/openspec dirs when unsure), not stale expectations.
${COMMON_RULES}
Return StructuredOutput: summary; findings[] with fixRisk = "low" (cosmetic/isolated, safe to fix tonight) or "risky" (logic/data/cross-role).`,
    {
      label: `drive:${role}`,
      phase: "Drive",
      schema: DRIVER_SCHEMA,
    },
  );
  driverRuns.push({ role, run });
  log(`drive ${role}: ${run ? `${run.findings.length} findings` : "FAILED"}`);
}

const allFindings = driverRuns
  .filter((d) => d.run)
  .flatMap((d) => d.run.findings.map((f) => ({ ...f, role: d.role })));
let driverFixSummary = "no findings";
if (allFindings.length > 0) {
  const consolidated = await agent(
    `Consolidate tonight's ai-ui-driver findings into ONE OpenSpec change "driver-findings-2026-06-11" in ${REPO}.
Findings (JSON): ${JSON.stringify(allFindings)}
Dedupe across roles. proposal.md groups by route; tasks.md splits "## Low-risk (fix tonight)" vs "## Risky (morning confirmation)" using each finding's fixRisk. Commit only the change directory (chore(openspec) message, co-author trailer "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>").
${CAPTURE_RULES}`,
    { label: "capture:driver-findings", phase: "Drive" },
  );
  if (consolidated) {
    const lowRisk = allFindings.filter((f) => f.fixRisk === "low");
    if (lowRisk.length > 0) {
      const fix = await agentWithRetry(
        `Implement ONLY the tasks under "## Low-risk (fix tonight)" in openspec/changes/driver-findings-2026-06-11/tasks.md in ${REPO}. Check boxes as you go; leave the Risky section untouched. Gates: pnpm typecheck && pnpm lint + targeted vitest. Re-verify each fix in the live browser (:3000, Playwright MCP) before checking its box. Commit (own files only, co-author trailer). Do NOT archive — risky tasks remain for the morning.
${COMMON_RULES}
Return StructuredOutput: status done/blocked/failed; summary; commit.`,
        {
          label: "fix:driver-findings",
          phase: "Drive",
          schema: IMPL_SCHEMA,
        },
      );
      driverFixSummary = fix ? `${fix.status}: ${fix.summary}` : "fixer died";
    } else {
      driverFixSummary = "all findings risky — left for morning";
    }
  }
}

// ---- Phase 5: repo-wide gates + morning report ----
phase("Finalize");
const gates = await agentWithRetry(
  `Run the full repo gates in ${REPO} after tonight's overnight run.
1. pnpm typecheck && pnpm lint && pnpm test — report exact failures.
2. Before "pnpm build": stop dev servers ("npx kill-port 3000 3002 || true"), then pnpm build.
3. After build, restart the stand: "cd ${REPO} && nohup pnpm dev > /tmp/devwatch-overnight.log 2>&1 &" and poll http://localhost:3000/ (curl --noproxy '*') until 200 or 60s.
4. A gate failure clearly traceable to a commit from tonight → minimal fix + commit (own files, co-author trailer); otherwise report only.
${COMMON_RULES}
Return StructuredOutput: status done/failed; summary listing each gate result and the final state of :3000.`,
  {
    label: "final-gates",
    phase: "Finalize",
    schema: IMPL_SCHEMA,
  },
);

const report = await agent(
  `Write the morning report for tonight's overnight run to /tmp/overnight-openspec-report.md (overwrite).
Input (JSON): ${JSON.stringify({ results, stripe, research, driverRuns: driverRuns.map((d) => ({ role: d.role, summary: d.run ? d.run.summary : "failed", count: d.run ? d.run.findings.length : 0 })), driverFixSummary, gates })}
Cross-check commit hashes against "git log --oneline" and the openspec archive directory.
Format: Russian prose, one thought per line, no fact-chaining with arrows/semicolons. Sections:
1) итог одной строкой (сколько изменений done, сколько архивировано, сколько blocked/failed);
2) таблица change → статус → архив → коммит;
3) драйвер: находки по ролям, что исправлено ночью, что ждёт подтверждения;
4) открытые вопросы к утру (openQuestions + minor findings + не-архивированные);
5) ресерчи: два черновика (driver-env-feedback-stage, versions-v2-restore-fidelity);
6) ворота и состояние стенда :3000;
7) что НЕ делалось: push (решение), снапшот product-accordion не тронут.
Return the file path and a 7-line digest.`,
  { label: "morning-report", phase: "Finalize" },
);

return {
  implemented: results.filter((r) => r.status === "done").length,
  archived: results.filter((r) => r.archived).length,
  blocked: results.filter((r) => r.status === "blocked").map((r) => r.id),
  failed: results.filter((r) => r.status === "failed").map((r) => r.id),
  stripe: stripe ? stripe.status : "unknown",
  driverFindings: allFindings.length,
  driverFixSummary,
  gates: gates ? gates.status : "unknown",
  report: report ?? "report agent died",
};
