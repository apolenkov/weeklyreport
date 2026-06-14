export const meta = {
  name: "finish-backlog-phase-b",
  description:
    "Autonomous phase B: complete polish (1.3 split-button + 2.x risk dialog single-col), unify top action toolbars (port lead idiom to head), implement rethink-pipeline (active, NOT archived), archive refactor-lifecycle + redesign (screenshots), decompose defer-uat (artifacts only), final gates + report. Advisor-ratified 2026-06-14. No push.",
  whenToUse:
    "Launch AFTER finish-backlog-2026-06-13 (phase A) finishes. User asleep, full autonomy, advisor decided forks.",
  phases: [
    {
      title: "Implement",
      detail:
        "polish, unify-toolbars, rethink (active), then archive lifecycle/redesign",
    },
    { title: "Decompose", detail: "defer-uat artifacts only — no code" },
    {
      title: "Finalize",
      detail:
        "live-verify done; gates -> build -> restart stand -> morning report",
    },
  ],
};

const REPO = "/home/user/work/customreport";
const SHOTS = "/tmp/finish-backlog-shots";
const TRAILER =
  "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>";

const IMPL_SCHEMA = {
  type: "object",
  required: ["status", "summary"],
  properties: {
    status: { type: "string", enum: ["done", "blocked", "failed"] },
    summary: { type: "string" },
    commit: { type: "string" },
    screenshots: { type: "array", items: { type: "string" } },
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
- Do NOT push to any remote. Do NOT touch prod DB. Do NOT start dark-mode/theme/background work.
- The file apps/web/src/components/weekly-report/__snapshots__/product-accordion.test.tsx.snap has a PRE-EXISTING uncommitted modification — never stage or revert it.
- Current branch is feat/finish-backlog-2026-06-13 — commit here, never checkout/switch/create branches, never push.
- If you must run pnpm install/add: append --network-concurrency=1.
- e2e/ is eslint-ignored and not tsc-gated; if you touch e2e, validate with "npx playwright test --list" and "node --check".
- Dev servers run on :3000/:3002 with hot reload — do NOT kill them (except the Finalize build step, which is the only place allowed to).
- Local/dev/test DBs are disposable (MVP rule): reseed/reset freely with PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION per CLAUDE.md; never touch prod.
- Commit trailer (use EXACTLY): "${TRAILER}".
- Screenshots: save under ${SHOTS} (run "mkdir -p ${SHOTS}" first). Screenshot-production failure MUST NOT block the change — note it and proceed.`;

function reviewPrompt(id, lens, implSummary, extra) {
  return `READ-ONLY adversarial review (lens: ${lens}) of OpenSpec change "${id}" just implemented in ${REPO}. Run git/grep/read/test/browser commands but make NO edits and NO commits.
Implementer's claim: ${implSummary}
Locate its commit(s): "git log --oneline -12" then "git show <hash>". Verify against openspec/changes/${id}/ artifacts.
Hunt for: (a) tasks checked but not implemented; (b) correctness bugs in the diff; (c) broken shared contracts / cross-role seams; (d) dishonest tests (weakened/deleted assertions, tests that cannot fail); (e) repo-rule violations: Russian production UI strings, magic numbers, orphaned imports, unrelated reformatting; (f) for UI changes — plausible match to the user intent in the proposal.
${extra ?? ""}
Report ONLY findings you verified are real (cite file:line or commit). severity: blocker = wrong behavior/broken gate; major = real defect, cheap to fix now; minor = note for later.`;
}

function fixPrompt(id, findings) {
  return `Fix the verified review findings for OpenSpec change "${id}" in ${REPO}.
Findings (JSON): ${JSON.stringify(findings)}
Minimal fixes only — no scope creep. Re-run gates: pnpm typecheck && pnpm lint + targeted vitest. Commit (stage only files you touched by explicit path, conventional "fix:" message mentioning ${id}, same co-author trailer).
${COMMON_RULES}
Return StructuredOutput: status done/failed; summary; commit.`;
}

function archivePrompt(id) {
  return `Verify and archive the OpenSpec change "${id}" in ${REPO} (its implementation passed adversarial review; visual acceptance is deferred to the PR per the autonomous-run rule).
1. Follow ${REPO}/.claude/skills/openspec-verify-change/SKILL.md: confirm implementation is complete, coherent vs openspec/changes/${id}/ artifacts; ALL tasks checked.
2. Only if verification is CLEAN: follow ${REPO}/.claude/skills/openspec-archive-change/SKILL.md — sync delta specs into openspec/specs/ where the lifecycle requires, then archive (e.g. "npx openspec archive ${id} --yes" if available; else the skill's manual steps). Commit the archive move (stage only openspec/ paths, "chore(openspec): archive ${id}", co-author trailer).
3. If verification finds gaps (any unchecked task, any mismatch): do NOT archive, return status "blocked" with the gap list.
${COMMON_RULES}
Return StructuredOutput: status done(=archived)/blocked/failed; summary; commit.`;
}

const AGENT_ATTEMPTS = 3;
async function agentWithRetry(promptText, opts) {
  for (let i = 0; i < AGENT_ATTEMPTS; i++) {
    const p =
      i === 0
        ? promptText
        : `RETRY ${i} of a previous attempt that hit its turn limit mid-work. Its edits and tasks.md checkboxes are already ON DISK — orient with "git status --short" + "git log --oneline -6", then CONTINUE from where it stopped; do not redo finished work. Budget turns to run gates and return StructuredOutput even if some tasks remain (status "blocked" with the remainder).\n\nOriginal task:\n${promptText}`;
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

// implement -> reviews -> fix -> (optional) archive
async function runChange({ id, implPrompt, lenses, reviewExtra, doArchive }) {
  const impl = await agentWithRetry(implPrompt, {
    label: `apply:${id}`,
    phase: "Implement",
    schema: IMPL_SCHEMA,
  });
  if (!impl)
    return { id, status: "failed", summary: "implementer died after retries" };
  if (impl.status !== "done") {
    return {
      id,
      status: impl.status,
      summary: impl.summary,
      openQuestions: impl.openQuestions ?? [],
      screenshots: impl.screenshots ?? [],
    };
  }

  const reviews = await parallel(
    lenses.map(
      (lens) => () =>
        agent(reviewPrompt(id, lens, impl.summary, reviewExtra), {
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
    log(`${id}: ${mustFix.length} must-fix -> fixer`);
    const fix = await agentWithRetry(fixPrompt(id, mustFix), {
      label: `fix:${id}`,
      phase: "Implement",
      schema: IMPL_SCHEMA,
    });
    fixSummary = fix ? `${fix.status}: ${fix.summary}` : "fixer died";
    fixFailed = !fix || fix.status !== "done";
  }

  let archive = null;
  if (doArchive && !fixFailed) {
    archive = await agentWithRetry(archivePrompt(id), {
      label: `archive:${id}`,
      phase: "Implement",
      schema: IMPL_SCHEMA,
      model: "sonnet",
    });
  }

  log(
    `${id}: done${archive && archive.status === "done" ? " + archived" : doArchive ? " (archive blocked)" : " (active by design)"} — ${mustFix.length} fixed, ${minors.length} minor`,
  );
  return {
    id,
    status: "done",
    archived: archive ? archive.status === "done" : false,
    archiveNote: archive ? archive.summary : "left active (by design)",
    summary: impl.summary,
    commit: impl.commit ?? null,
    screenshots: impl.screenshots ?? [],
    openQuestions: impl.openQuestions ?? [],
    reviewFindings: { mustFix, minors },
    fixSummary,
  };
}

phase("Implement");
const results = [];

// 1) Finish polish: 1.3 split-button + 2.x risk dialog (single-column). Then archive.
log("=== polish: 1.3 + 2.x (1/5) ===");
results.push(
  await runChange({
    id: "polish-lead-toolbar-and-risk-dialog",
    implPrompt: `Complete the REMAINING tasks of OpenSpec change "polish-lead-toolbar-and-risk-dialog" in ${REPO}. Tasks 1.1, 1.2, 3.1, 3.2 (+ their tests/gates) were done in phase A — verify they are checked, then do the rest:
- 1.3 Fill-from/copy SPLIT-BUTTON (DECIDED): consolidate into ONE control in lead/fill-from-button.tsx — the MAIN click copies/fills from the latest submitted period; an attached chevron (▾) opens the dropdown to pick a specific past period (keep the existing search + confirm flow). REMOVE the separate copy control. Update report-toolbar wiring if it passes a separate copy button. Keep behavior + aria.
- 2.1/2.2/2.3 Risk dialog redesign (DECIDED — single column, "clear, sharp, not sprawling"): in lead/risk-edit-dialog.tsx change the shell from max-w-4xl two-column to SINGLE COLUMN max-w-2xl, p-5. Stack the text fields full-width top-to-bottom (Title/description, Impact, Mitigation), then a compact grouped "Classification" block (a light bordered sub-panel) holding Severity chips on one row and Stage multi-select below. Calm competing emphasis (one accent). KEEP every field, validation ("Select at least one stage."), and behavior intact — presentation only. Capture before/after screenshots to ${SHOTS}. Update snapshot tests HONESTLY to the new DOM.
- 1.4 ensure a render/unit test per changed control (split-button: main-click copies, chevron opens list; risk dialog: renders all fields in the new layout).
- 4.1 gates: pnpm typecheck && pnpm lint + vitest for touched web/ui packages.
- 4.2 live re-check at :3000 (lead form + ?mode=slides) via Playwright MCP (ToolSearch); confirm split-button copies and the risk dialog layout; screenshots to ${SHOTS}.
Apply frontend-design judgement for the risk dialog visual pass (read .claude/skills/frontend-design/SKILL.md if present). Commit per logical unit (explicit paths, never -A), conventional messages naming the change.
${COMMON_RULES}
Return StructuredOutput: status done (=all tasks complete) / blocked / failed; summary per task + gate results; commit; screenshots; openQuestions.`,
    lenses: ["spec-fidelity", "correctness-and-contracts"],
    doArchive: true,
  }),
);

// 2) unify-top-action-toolbars — port lead toolbar idiom to the head action row.
log("=== unify-top-action-toolbars (2/5) ===");
results.push(
  await runChange({
    id: "unify-top-action-toolbars",
    implPrompt: `Implement OpenSpec change "unify-top-action-toolbars" in ${REPO}. Read its proposal.md + tasks.md + design.md (D1–D5, the precise spec) fully. This MUST build on the FINAL lead toolbar styling just completed in polish-lead-toolbar-and-risk-dialog.
DECISIONS (advisor, 2026-06-14 — "by analogy with lead" = a PORT, not an invention):
- Anchor on the lead unified pill toolbar (report-shell/report-toolbar.tsx) as the reference component. Mirror its container framing exactly.
- Head report action row (head/head-report-shell.tsx:145, the bare "flex flex-wrap items-center justify-end gap-x-5 gap-y-2"): wrap its controls in the SAME unified pill container, grouped by intent: [scope toggle | view-mode toggle] then [Present / Print / Agent-review]. The controls float today; put them in one bar like lead.
- Present/Print stay LABELED text+icon pills (they are primary actions — Print is the green accent in the live UI). Do NOT collapse primaries to icon-only.
- Apply the SAME idiom in head SLIDES mode (the shell renders the row directly above the deck).
- Audit scope = REPORT SURFACES ONLY (lead form header, head dashboard/review, viewer) — NOT all app top bars. Record which already match vs diverge; align divergent ones; note any intentionally-distinct surface. Do NOT scope-creep into unrelated top bars.
- TASK 2.0 (HIGHEST PRIORITY — a real bug, "viewer полетел"): the published viewer (app/(app)/reports/[reportId]/page.tsx) renders its OWN <h1>Status Report</h1> + Report-ID + a bare action row, THEN mounts WeeklyReportPage which renders its OWN "Status Report · Live · N/N" header — the title is DOUBLED on screen. Fix it the head way: drop the wrapper's duplicate <h1>/context bar, route the viewer actions (Back to Archive / Presentation / Print / Agent review) through WeeklyReportPage's \`toolbar\` slot, and put them in the unified pill bar. Keep all hrefs/aria/behavior. Verify in the live browser that only ONE "Status Report" title shows on the viewer; screenshot before/after.
Use the frontend-design skill for the visual pass (read .claude/skills/frontend-design/SKILL.md). Reuse archived head-toolbar-parity / unify-head-toolbar-controls tokens+components; do not fork. Named consts, no magic numbers; UI strings English.
Tests: render tests for the regrouped head action row (controls present, grouped, aria/hrefs preserved); update snapshots honestly. Gates: pnpm typecheck && pnpm lint + vitest for touched web packages. Live re-check at :3000 (head report form + slides) via Playwright MCP; before/after screenshots to ${SHOTS}.
NOTE: phase A's driver-findings task 2.4 already edited head-report-shell.tsx (PeriodNavigator) — rebase your understanding on the CURRENT file; do not revert that.
Commit per logical unit (explicit paths).
${COMMON_RULES}
Return StructuredOutput: status done/blocked/failed; summary incl. the audit table; commit; screenshots; openQuestions.`,
    lenses: ["spec-fidelity", "correctness-and-contracts"],
    doArchive: true,
  }),
);

// 3) rethink-pipeline — DEEP behavioral change. Implement + heaviest review. DO NOT archive, DO NOT sync specs.
log("=== rethink-pipeline (3/5) — implement only, NOT archived ===");
results.push(
  await runChange({
    id: "rethink-pipeline-state-vs-completeness",
    implPrompt: `Implement OpenSpec change "rethink-pipeline-state-vs-completeness" in ${REPO}. Design is DECIDED — read design.md (D1-D3) + tasks.md + specs/lead-pipeline-card/spec.md fully. This is the deepest, most regression-heavy change in the batch (CLAUDE.md flags the product/period status area). Read existing status/sync tests BEFORE changing semantics; extend them, never weaken them.
Work tasks 1.4 -> 1.6 (single source: status derived from covering risks; blocker>at-risk>on-track; remove the unbacked-stage warning) then 2.1 -> 2.3 (left edge severity from any stage owner's covering risk; right-side completeness affordance = dashed/dotted outline ring while incomplete + an "N/M stages" counter, never the health hue; tests proving health and completeness are INDEPENDENT and multi-risk priority).
"My part complete" (D1) = every stage the lead OWNS for the product has an explicit status set; per product.
Reuse the existing risk-coverage predicate from the archived unify-risk-stage-status (do NOT invent a parallel one). Touch lead/sdlc-pipeline.tsx, the status derivation in lib/mappers/lead-form.ts (deriveEffectiveStageStatus — this change SUPERSEDES the PRJ-2 "explicit chip status must win" comment; document why), and the sync bridge as needed.
Gates: pnpm typecheck && pnpm lint + vitest for touched web packages. Live-verify at :3000 (Playwright MCP) on SEEDED data: add a risk in the Risks section and confirm the stage chip + product left edge recolor IMMEDIATELY with no manual sync; screenshots to ${SHOTS}.
Commit per logical unit (explicit paths, conventional messages naming the change).
${COMMON_RULES}
Return StructuredOutput: status done/blocked/failed; summary per task + the live-verify result (did adding a risk recolor the chip+edge immediately?); commit; screenshots; openQuestions.`,
    lenses: [
      "spec-fidelity",
      "correctness-and-contracts",
      "test-honesty-and-regressions",
    ],
    reviewExtra: `CRITICAL EXTRA for this change: verify IN THE LIVE BROWSER on seeded data (Playwright MCP via ToolSearch, dev-login as lead) that (1) adding a risk in the Risks section immediately recolors the covering stage chip AND the product left edge AND the slide/preview, with NO manual sync; (2) a stage covered by both at-risk and blocker shows blocked (highest severity wins); (3) the old "unbacked stage" warning is gone; (4) the completeness affordance is independent of health colour (red health + complete input, and green health + incomplete input, both render correctly). A green unit suite is NOT sufficient — confirm the behavior on screen. Flag ANY divergence as blocker.`,
    doArchive: false, // advisor: leave active, do not sync specs, flag for human behavioral review
  }),
);

// 4) refactor-lead-dialog-lifecycle — code + 5.2 walk done in phase A; archive (PR is the acceptance gate).
log("=== refactor-lead-dialog-lifecycle (4/5) — archive ===");
const refArchive = await agentWithRetry(
  `Archive the OpenSpec change "refactor-lead-dialog-lifecycle" in ${REPO}. Code (1-4), gates (5.1), and the live walk (5.2) are done (5.2 was verified in phase A). 5.3 "user acceptance" is satisfied for an autonomous run by the PR gate (merge to main is blocked and awaits the user) — record this in tasks.md 5.3 as "autonomous-run acceptance deferred to PR review" and check it.
1. Verify per ${REPO}/.claude/skills/openspec-verify-change/SKILL.md: all tasks complete/coherent. If 5.2 is somehow unchecked (phase A blocked), do the live walk now (Playwright MCP, :3000, dev-login lead): +Add Risk -> cancel -> view snapshot -> Back to current -> no dialog reopens; same for Decision; risk-dialog form-race survives autosave; Toggle All still syncs. Screenshots to ${SHOTS}.
2. Then archive per ${REPO}/.claude/skills/openspec-archive-change/SKILL.md (sync delta specs where required), commit ("chore(openspec): archive refactor-lead-dialog-lifecycle", trailer).
3. Real gap -> do NOT archive, return blocked with the gap.
${COMMON_RULES}
Return StructuredOutput: status done(=archived)/blocked/failed; summary; commit; screenshots.`,
  {
    label: "archive:refactor-lead-dialog-lifecycle",
    phase: "Implement",
    schema: IMPL_SCHEMA,
  },
);
results.push({
  id: "refactor-lead-dialog-lifecycle",
  status: refArchive ? refArchive.status : "failed",
  archived: refArchive ? refArchive.status === "done" : false,
  archiveNote: refArchive ? refArchive.summary : "archive agent died",
  summary: refArchive ? refArchive.summary : "archive agent died",
  commit: refArchive ? (refArchive.commit ?? null) : null,
  screenshots: refArchive ? (refArchive.screenshots ?? []) : [],
});

// 5) redesign-head-slide-density — capture AFTER screenshots (7.2), accept via PR (7.3), archive.
log("=== redesign-head-slide-density (5/5) — screenshots + archive ===");
const redesign = await agentWithRetry(
  `Finish + archive the OpenSpec change "redesign-head-slide-density" in ${REPO}. Code (groups 1-6) and gates (7.1) are done; only 7.2 (screenshots) + 7.3 (acceptance) remain.
1. Capture the AFTER screenshots (task 7.2) at :3000 via Playwright MCP (head deck ?mode=slides, dev-login as head): one lead, many leads, an empty-section lead, a dense-decisions lead, and fullscreen. Save to ${SHOTS}/redesign-<state>.png. The "before" is the parent of the implementation commit — do NOT rebuild it; just note that in tasks.md 7.2. Screenshot-production failure must NOT block archiving — note what you got and proceed.
2. Record 7.3 as "autonomous-run acceptance deferred to PR review (screenshots attached); merge to main awaits the user" and check it.
3. Verify per openspec-verify-change SKILL, then archive per openspec-archive-change SKILL (sync delta specs where required), commit ("chore(openspec): archive redesign-head-slide-density", trailer).
${COMMON_RULES}
Return StructuredOutput: status done(=archived)/blocked/failed; summary; commit; screenshots = the saved paths.`,
  {
    label: "archive:redesign-head-slide-density",
    phase: "Implement",
    schema: IMPL_SCHEMA,
  },
);
results.push({
  id: "redesign-head-slide-density",
  status: redesign ? redesign.status : "failed",
  archived: redesign ? redesign.status === "done" : false,
  archiveNote: redesign ? redesign.summary : "archive agent died",
  summary: redesign ? redesign.summary : "archive agent died",
  commit: redesign ? (redesign.commit ?? null) : null,
  screenshots: redesign ? (redesign.screenshots ?? []) : [],
});

// ---- Phase 2: defer-uat decomposition (artifacts only, NO code) ----
phase("Decompose");
const deferUat = await agentWithRetry(
  `Artifact-only decomposition of OpenSpec change "defer-uat-codequality-vercel-2026-05-26" in ${REPO}. NO source-code edits. NO modernization run (that is the known "parallel-army-refactor-revert-bait" hazard). The user chose "decompose and narrow"; the advisor ratified artifacts-only tonight.
Read defer-uat-codequality-vercel-2026-05-26/proposal.md + tasks.md and its "Child changes" list. Then:
1. Mark Wave 1 (UAT sweep 4 roles) and Wave 2 (fix found bugs) as ALREADY COVERED by the 2026-06-11/13 ai-ui-driver runs that produced driver-findings-2026-06-11 (now implemented). Cite that in the proposal.
2. The child plan "migrate-to-biome" is OBSOLETE — the repo went the OTHER way (Biome removed, ESLint+Prettier kept; see CLAUDE.md "Lint stack"). Remove/strike that child from the plan and note the reversal. If a separate openspec/changes/migrate-to-biome directory exists and is a dead draft, leave a clear OBSOLETE note in its proposal (do NOT delete files).
3. Re-scope the genuine remainder as SEPARATE future changes, each needing its OWN grilled plan before any code: (a) code-quality-modernization (HOT-ZONE, characterization tests first), (b) dependency-upgrades (minor/patch batch + isolated majors), (c) ui-ux-vercel-audit (research-only memo). Write these as short proposal stubs under openspec/changes/<id>/proposal.md with an explicit "Start condition: grilled plan + user go" — unchecked tasks.md, NO code.
4. Update defer-uat's own tasks.md to reflect this decomposition (waves 1-2 covered; wave 3 split into the stubs; biome obsolete). Keep defer-uat ACTIVE as the umbrella tracker — do NOT archive it.
Commit ONLY openspec/ artifact paths ("chore(openspec): decompose + narrow defer-uat (biome obsolete, waves 1-2 covered)", trailer).
${COMMON_RULES}
Return StructuredOutput: status done/blocked/failed; summary of the decomposition; commit.`,
  { label: "decompose:defer-uat", phase: "Decompose", schema: IMPL_SCHEMA },
);

// ---- Phase 3: final gates (live-verify already done above) + morning report ----
phase("Finalize");
const gates = await agentWithRetry(
  `Run the full repo gates in ${REPO} after phase B. Live-browser verification is already done per change — this step is gates + build + stand restart.
1. pnpm typecheck && pnpm lint && pnpm test — report exact failures. A failure clearly traceable to a phase-B commit -> minimal fix + commit (own files, trailer); else report only.
2. Only THEN build (it kills the stand): "npx kill-port 3000 3002 || true", then pnpm build.
3. Restart the stand: "cd ${REPO} && nohup pnpm dev > /tmp/devwatch-phaseb.log 2>&1 &" and poll http://localhost:3000/ (curl --noproxy '*') until 200 or 60s.
${COMMON_RULES}
Return StructuredOutput: status done/failed; summary listing each gate result and final :3000 state.`,
  { label: "final-gates", phase: "Finalize", schema: IMPL_SCHEMA },
);

const report = await agent(
  `Write the phase-B autonomous-run report to /tmp/finish-backlog-report.md (overwrite) in ${REPO}.
Input (JSON): ${JSON.stringify({ results, deferUat, gates })}
Cross-check commit hashes against "git log --oneline -40" and the openspec archive directory ("ls openspec/changes/archive | head").
Format: Russian prose, ONE thought per line, no fact-chaining with arrows/semicolons. Sections:
1) Итог одной строкой (сколько изменений done, сколько архивировано, сколько активны/blocked).
2) Таблица: change -> статус -> архив -> коммит.
3) ВИЗУАЛЬНЫЕ изменения: для каждого (polish risk-dialog, unify-toolbars, redesign, rethink) — путь к скриншотам в ${SHOTS}. ОБЯЗАТЕЛЬНО строка: "Самопроверка тестами + живой DOM пройдена; визуально человеком НЕ принято — скриншоты в PR."
4) rethink-pipeline — отдельной строкой: реализован, НЕ заархивирован, specs НЕ синхронизированы; нужна ручная проверка поведения (риск снизу красит чип+кромку сразу). Что именно проверить.
5) defer-uat — что разложено (biome устарел, waves 1-2 покрыты, остаток в стабы).
6) Открытые вопросы к утру (openQuestions + minor findings + blocked).
7) Ворота и состояние стенда :3000.
8) Что НЕ делалось: push в main (предохранитель), снапшот product-accordion не тронут, армия модернизации не запускалась.
Return the file path and a 8-line digest.`,
  { label: "morning-report", phase: "Finalize" },
);

return {
  done: results.filter((r) => r.status === "done").length,
  archived: results.filter((r) => r.archived).length,
  active: results
    .filter((r) => r.status === "done" && !r.archived)
    .map((r) => r.id),
  blocked: results.filter((r) => r.status === "blocked").map((r) => r.id),
  failed: results.filter((r) => r.status === "failed").map((r) => r.id),
  deferUat: deferUat ? deferUat.status : "unknown",
  gates: gates ? gates.status : "unknown",
  screenshots: results.flatMap((r) => r.screenshots ?? []),
  report: report ?? "report agent died",
};
