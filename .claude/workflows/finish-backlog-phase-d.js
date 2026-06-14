export const meta = {
  name: "finish-backlog-phase-d",
  description:
    "ultracode finish 2026-06-14: diagnose+fix the head period drift (empty future week shown as current), live-verify rethink-pipeline behavior on the clean seed and archive it if clean, apply the <header> a11y nit, full gates + push-less report. Branch only.",
  whenToUse:
    "User at the cinema, full autonomy. Dev DB reseeded. Sequential browser use.",
  phases: [
    {
      title: "Diagnose",
      detail:
        "period-drift root cause (read-only) + rethink live behavioral verify",
    },
    { title: "Fix", detail: "apply safe period fix + <header> nit" },
    { title: "Finalize", detail: "rethink archive if clean, gates, report" },
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

const DIAG_SCHEMA = {
  type: "object",
  required: ["rootCause", "fixLocation", "fixRisk", "recommendedFix"],
  properties: {
    rootCause: { type: "string" },
    fixLocation: {
      type: "string",
      enum: ["seed", "app-logic", "none", "unclear"],
    },
    fixRisk: { type: "string", enum: ["low", "medium", "high"] },
    recommendedFix: { type: "string" },
    evidence: { type: "string" },
  },
};

const VERIFY_SCHEMA = {
  type: "object",
  required: ["verdict", "summary"],
  properties: {
    verdict: { type: "string", enum: ["pass", "fail"] },
    summary: { type: "string" },
    screenshots: { type: "array", items: { type: "string" } },
    issues: { type: "array", items: { type: "string" } },
  },
};

const COMMON_RULES = `
Repo: ${REPO} (repo root; pnpm only). Read ${REPO}/CLAUDE.md and obey it.
- Production UI strings English; surgical edits; no magic numbers; no theme/dark-mode work.
- Never weaken/delete tests to go green; update to the new contract.
- Do NOT push to any remote. Do NOT touch prod DB. Branch is feat/finish-backlog-2026-06-13 — commit here only.
- NEVER stage/revert apps/web/src/components/weekly-report/__snapshots__/product-accordion.test.tsx.snap (pre-existing mod).
- Dev DB is disposable: reseed with PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=1 pnpm db:fresh:advanced (per CLAUDE.md) ONLY if a seed fix needs it; never touch prod.
- Dev servers run :3000/:3002 — do NOT kill them; do NOT run pnpm build.
- Commit trailer (EXACTLY): "${TRAILER}". Stage explicit paths, never git add -A.
- Screenshots: "mkdir -p ${SHOTS}" first; screenshot failure must not block.`;

const AGENT_ATTEMPTS = 3;
async function agentWithRetry(promptText, opts) {
  for (let i = 0; i < AGENT_ATTEMPTS; i++) {
    const p =
      i === 0
        ? promptText
        : `RETRY ${i} of an attempt that hit its turn limit. Edits + tasks.md boxes are ON DISK — orient with git status/log, CONTINUE, leave room for gates + StructuredOutput.\n\nOriginal task:\n${promptText}`;
    try {
      const r = await agent(p, opts);
      if (r) return r;
      log(`${opts.label}: attempt ${i + 1} null`);
    } catch (e) {
      log(`${opts.label}: attempt ${i + 1} threw (${String(e).slice(0, 120)})`);
    }
  }
  return null;
}

// ---- Phase 1: diagnose (read-only period root cause) + rethink live verify ----
phase("Diagnose");
const [diag, rethinkVerify] = await parallel([
  () =>
    agent(
      `READ-ONLY diagnosis (NO edits, NO commits) of the HEAD report "period drift" in ${REPO}.
Symptom: after a fresh reseed whose log says active period = 2026-06-08..2026-06-14, /head/report (and the head dashboard) show Week 26 "Jun 22-28, 2026 (Current)" — an EMPTY future week — as the current period, so head reads "No submissions / not started". The lead/viewer published weeks (Jun 1-7, May 25-31) have full data.
Find the ROOT CAUSE. Read:
- prisma/seed-simple.ts (which periods/reports it creates; how it computes the active/current week; does it create a Jun 22-28 period? what marks isCurrent / periodStatus='active'?).
- the head "current period" resolution: weeklyReport.get default (no reportId) on the API side, head-report-shell.tsx active-period logic, and how the canonical /head/report redirect picks a reportId.
- the period model in prisma/schema.prisma (periodStart/periodEnd/status fields).
Decide: is this a SEED data problem (the seed creates/marks a future week as active) or APP-LOGIC (the resolver picks the latest-by-date period instead of the one containing 'today' / the seeded active)? Give the minimal SAFE fix and its risk. Prefer fixing the SEED if it is seed data (disposable DB). For app-logic, only call it low-risk if it is a small, testable change.
${COMMON_RULES}
Return StructuredOutput (DIAG_SCHEMA): rootCause; fixLocation (seed|app-logic|none|unclear); fixRisk; recommendedFix (concrete: file + change); evidence (file:line cites).`,
      {
        label: "diagnose:period-drift",
        phase: "Diagnose",
        schema: DIAG_SCHEMA,
      },
    ),
  () =>
    agent(
      `LIVE behavioral verification of OpenSpec change "rethink-pipeline-state-vs-completeness" in ${REPO} on the freshly reseeded stand. You MAY read code and drive the browser, but make NO edits and NO commits (verification only).
Use Playwright MCP (load via ToolSearch) at http://localhost:3000, dev-login as a lead (e.g. /auth/dev-login?role=lead). Open the lead report form. Verify the rethink contract (design.md D1-D3 + specs/lead-pipeline-card):
1. Add a risk in the Risks section covering a stage -> the SDLC pipeline stage chip AND the product card left edge recolor to that severity IMMEDIATELY, no manual save.
2. Remove that risk -> the stage/edge revert.
3. A stage covered by both at-risk and blocker shows BLOCKED (highest severity wins).
4. The right-side completeness affordance (dashed ring + N/M stages) is INDEPENDENT of health colour and does NOT stick to "complete" after an add-then-remove cycle.
5. Reload the page -> empty stages stay empty (no stale persisted completeness).
6. Slides (?mode=slides) stage status matches the live card.
Save screenshots of the key states to ${SHOTS}/d-rethink-*.png.
${COMMON_RULES}
Return StructuredOutput (VERIFY_SCHEMA): verdict pass/fail; summary (each of the 6 checks); screenshots; issues (any divergence, with repro).`,
      {
        label: "verify:rethink-live",
        phase: "Diagnose",
        schema: VERIFY_SCHEMA,
      },
    ),
]);

log(
  `period-drift: ${diag ? `${diag.fixLocation}/${diag.fixRisk}` : "diag failed"}`,
);
log(`rethink-live: ${rethinkVerify ? rethinkVerify.verdict : "verify failed"}`);

// ---- Phase 2: fix (period drift if safe + <header> nit) ----
phase("Fix");

// Only auto-apply the period fix when the diagnosis says it is a concrete,
// low/medium-risk seed or app-logic change. High-risk/unclear -> leave for the user.
let periodFix = null;
const fixable =
  diag &&
  (diag.fixLocation === "seed" || diag.fixLocation === "app-logic") &&
  diag.fixRisk !== "high";
if (fixable) {
  periodFix = await agentWithRetry(
    `Apply this diagnosed fix for the head period drift in ${REPO}. Diagnosis (JSON): ${JSON.stringify(diag)}
Apply ONLY the recommendedFix, minimally. If fixLocation is "seed": edit prisma/seed-simple.ts so the ACTIVE/current report is the week that contains "today" (or the intended recent active week) and NO empty future week is marked current; then reseed: PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=1 pnpm db:fresh:advanced. If "app-logic": make the minimal resolver change + add a unit test pinning that the current period is the one containing the reference date (not the latest-by-date).
Then VERIFY at :3000 (Playwright MCP): /head/report now shows the populated current week (not an empty future week); dashboard shows the lead as started. Screenshot ${SHOTS}/d-period-after.png.
Gates: pnpm typecheck && pnpm lint + vitest for any touched package. Commit (explicit paths, "fix: head current-period resolution / seed (period drift)", trailer).
${COMMON_RULES}
Return StructuredOutput: status done/blocked/failed; summary (what changed + the live result); commit; screenshots.`,
    { label: "fix:period-drift", phase: "Fix", schema: IMPL_SCHEMA },
  );
} else {
  log(
    `period-drift fix NOT auto-applied (${diag ? diag.fixLocation + "/" + diag.fixRisk : "no diag"}) — left for the user`,
  );
}

// <header> a11y nit (codex review): WeeklyReportPage page-header uses <div>; lead uses <header>.
const headerNit = await agentWithRetry(
  `Tiny a11y/semantics fix in ${REPO}: in apps/web/src/components/weekly-report/weekly-report-page.tsx the page header row (the "{/* Page header */}" block, currently a <div className="flex flex-wrap items-center justify-between gap-4">) should be a semantic <header> element to match lead-form.tsx's header. Change ONLY that opening <div> to <header> and its matching closing </div> to </header>. Nothing else. If a snapshot/test asserts the old tag, update it honestly.
Gates: pnpm typecheck + vitest for weekly-report-page.test.tsx. Commit (explicit path, "refactor(weekly-report): use semantic <header> for the page header", trailer).
${COMMON_RULES}
Return StructuredOutput: status done/failed; summary; commit.`,
  { label: "fix:header-nit", phase: "Fix", schema: IMPL_SCHEMA },
);

// ---- Phase 3: rethink archive (only if live verify passed) + gates + report ----
phase("Finalize");
let rethinkArchive = null;
if (rethinkVerify && rethinkVerify.verdict === "pass") {
  rethinkArchive = await agentWithRetry(
    `The OpenSpec change "rethink-pipeline-state-vs-completeness" in ${REPO} PASSED live behavioral verification on the clean seed. Now verify + archive it.
1. Follow .claude/skills/openspec-verify-change/SKILL.md: all tasks checked, coherent vs artifacts.
2. If clean: follow .claude/skills/openspec-archive-change/SKILL.md — SYNC its delta specs into openspec/specs/ (lead-pipeline-card) and archive the change. Commit ("chore(openspec): archive rethink-pipeline-state-vs-completeness", trailer).
3. Any gap -> do NOT archive; return blocked with the gap.
${COMMON_RULES}
Return StructuredOutput: status done(=archived)/blocked/failed; summary; commit.`,
    {
      label: "archive:rethink",
      phase: "Finalize",
      schema: IMPL_SCHEMA,
      model: "sonnet",
    },
  );
} else {
  log(
    `rethink NOT archived (verify ${rethinkVerify ? rethinkVerify.verdict : "failed"}) — stays active`,
  );
}

const gates = await agentWithRetry(
  `Run gates in ${REPO} after phase D: pnpm typecheck && pnpm lint && pnpm test. Report exact failures. A failure clearly traceable to a phase-D commit -> minimal fix + commit (own files, trailer); else report only. Do NOT build, do NOT kill dev servers. Confirm :3000 answers (curl --noproxy '*' -s -o /dev/null -w '%{http_code}' http://localhost:3000/).
${COMMON_RULES}
Return StructuredOutput: status done/failed; summary (each gate + :3000 code).`,
  { label: "gates", phase: "Finalize", schema: IMPL_SCHEMA },
);

const report = await agent(
  `Append "## Phase D — 2026-06-14 cinema run" to /tmp/finish-backlog-report.md in ${REPO} (do not overwrite earlier content).
Input (JSON): ${JSON.stringify({ diag, periodFix: periodFix ? { status: periodFix.status, summary: periodFix.summary, commit: periodFix.commit ?? null } : "not auto-applied", rethinkVerify, rethinkArchive: rethinkArchive ? { status: rethinkArchive.status, summary: rethinkArchive.summary } : "not archived", headerNit: headerNit ? { status: headerNit.status } : null, gates })}
Russian, one thought per line. Cover: period-drift root cause + whether fixed or left for the user (+ why); rethink live-verify verdict (6 checks) + archived or not; header nit; gates + :3000; what still needs the user (merge PR #10, any high-risk item left). Note screenshots in ${SHOTS}.
Return the file path + an 8-line digest.`,
  { label: "report", phase: "Finalize" },
);

return {
  periodDrift: diag
    ? {
        fixLocation: diag.fixLocation,
        fixRisk: diag.fixRisk,
        fixed: periodFix ? periodFix.status : "not-applied",
      }
    : "diag-failed",
  rethink: {
    verify: rethinkVerify ? rethinkVerify.verdict : "failed",
    archived: rethinkArchive ? rethinkArchive.status === "done" : false,
  },
  headerNit: headerNit ? headerNit.status : "failed",
  gates: gates ? gates.status : "unknown",
  report: report ?? "report died",
};
