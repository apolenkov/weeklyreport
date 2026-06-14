export const meta = {
  name: "finish-backlog-phase-c",
  description:
    "ultracode live-walk rework 2026-06-14: head toolbar 1:1 with lead (reuse lead components, move Export-PDF/Publish into pill, AgentReview same height), risk dialog NEW balanced 2-col, slides card (risk/decision content + equal height + verify statuses on clean seed), reports history (default no-archive, URL stable, nav active independent). Branch only, no push, no archive (PR is the gate).",
  whenToUse:
    "After the dev DB reseed (active period 2026-06-08..14). User handed off (ultracode); advisor decided. Sequential to avoid browser contention.",
  phases: [
    {
      title: "Implement",
      detail: "head-toolbar, risk-dialog, slides, history — sequential",
    },
    { title: "Review", detail: "adversarial lenses + fix" },
    { title: "Finalize", detail: "gates (no build), report" },
  ],
};

const REPO = "/Users/wrk/work/customreport";
const SHOTS = "/tmp/finish-backlog-shots";
const CHANGE = "lead-live-walk-2026-06-14";
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
Repo: ${REPO} (repo root; pnpm only). Read ${REPO}/CLAUDE.md and obey it.
- Production UI strings in apps/web/src/**/*.tsx must be English (Russian only in data/comments/tests).
- Surgical edits; never reformat unrelated code; remove orphans your edit creates.
- Never weaken/delete a test to go green; update tests to the NEW contract.
- No magic numbers — named consts / shared tokens.
- Do NOT push. Do NOT touch prod DB. No dark-mode/theme/background work (research-only).
- The snapshot apps/web/src/components/weekly-report/__snapshots__/product-accordion.test.tsx.snap has a PRE-EXISTING uncommitted mod — never stage or revert it.
- Branch is feat/finish-backlog-2026-06-13 — commit here; never checkout/switch/push.
- Dev DB was JUST reseeded: active period 2026-06-08..2026-06-14, Vasily owns Dev/Test/DevOps/Support, content exists. Do NOT reseed again.
- Dev servers run :3000/:3002 — do NOT kill them.
- Commit trailer (EXACTLY): "${TRAILER}".
- Screenshots: "mkdir -p ${SHOTS}" first; failure to screenshot must NOT block — note and proceed.
- This is ONE change "${CHANGE}". Check its tasks.md boxes as you go. Do NOT archive it (PR is the acceptance gate).`;

const AGENT_ATTEMPTS = 3;
async function agentWithRetry(promptText, opts) {
  for (let i = 0; i < AGENT_ATTEMPTS; i++) {
    const p =
      i === 0
        ? promptText
        : `RETRY ${i} of an attempt that hit its turn limit. Edits + tasks.md boxes are ON DISK — orient with "git status --short" + "git log --oneline -6", CONTINUE from where it stopped, leave room for gates + StructuredOutput.\n\nOriginal task:\n${promptText}`;
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

phase("Implement");
const impl = [];

// 1) HEAD TOOLBAR 1:1 WITH LEAD — the repeatedly-missed item. Structural reuse, not parallel styling.
log("=== head toolbar 1:1 (1/4) ===");
impl.push(
  await agentWithRetry(
    `Task group 5 of openspec/changes/${CHANGE}/tasks.md — make the HEAD report toolbar pixel-identical to the LEAD report toolbar. This is the user's 3rd-time complaint ("you didn't get it"), so do NOT style a parallel head row — make head STRUCTURALLY REUSE the lead toolbar's components and control set so 1:1 is guaranteed.
Read FIRST, as the reference contract: how the LEAD report assembles its toolbar — apps/web/src/components/lead/lead-form.tsx (its ReportToolbar usage + the controls it passes: view-mode, fill-from, present/print/export-pdf/publish, archive, etc.), report-shell/report-toolbar.tsx, and head/head-report-shell.tsx (current head arrangement). Read .claude/skills/frontend-design/SKILL.md and apply it as "match this existing component exactly", NOT new aesthetics.
Concrete requirements:
- The head action line (Product/Leads · Edit/Slides · Present · Print · Agent review) must use the SAME components, heights, radii, gaps, and idiom as the lead toolbar. Reuse lead's controls; do not fork styles.
- AgentReviewComingSoon (report-shell/agent-review-coming-soon.tsx) must be the SAME height as every other pill control (it renders ~26px now; the others use the touch-target height). Make ALL pill controls share ONE height token. The "compact" variant that makes it shorter must match.
- MOVE Export-PDF and Publish INTO the toolbar pill, alongside Present and Print (today they live in the WeeklyReportPage header row for head). One consolidated bar. Keep all behavior, hrefs, aria, and the publish mutation intact.
- Apply in BOTH head modes (form + slides).
Gates before commit: pnpm typecheck && pnpm lint + vitest for touched web packages. Add/extend render tests asserting the head controls share the lead idiom + one height + Export-PDF/Publish present in the pill. Commit per logical unit (explicit paths). Live-verify at :3000 (Playwright MCP via ToolSearch, dev-login head, /head/report/<id> form + ?mode=slides) at 1728 AND ~1280 widths (wrap, not clip). Screenshots: ${SHOTS}/c-head-toolbar-form-1728.png, c-head-toolbar-slides-1728.png, c-head-toolbar-1280.png. Check task-group 5 boxes.
${COMMON_RULES}
Return StructuredOutput: status done/blocked/failed; summary (what moved into the pill, the shared height token, how 1:1 is structural); commit; screenshots; openQuestions.`,
    { label: `impl:head-toolbar`, phase: "Implement", schema: IMPL_SCHEMA },
  ),
);

// 2) RISK DIALOG — NEW balanced two-column (NOT the old max-w-4xl).
log("=== risk dialog 2-col (2/4) ===");
impl.push(
  await agentWithRetry(
    `Task group 1 of openspec/changes/${CHANGE}/tasks.md — redesign lead/risk-edit-dialog.tsx into a BALANCED TWO-COLUMN layout. PR #10 made it single-column; live it is too TALL (~885px). Do NOT just revert to the old max-w-4xl two-column (that was the original "overloaded" complaint). Design a NEW balanced grid.
Read .claude/skills/frontend-design/SKILL.md; apply "clear, justified, no dead space".
Target: moderate width (~max-w-3xl), two columns of COMPARABLE height so neither leaves stray empty space; fields aligned on a grid (perpendicular/parallel); total height comfortably under 92vh on a 900px viewport. Suggested split: left column = the text fields (Risk / Impact / Mitigation); right column = the Classification block (SDLC stages, severity, product). Keep EVERY field, the "Select at least one stage" validation, the pre-checked-stages info strip, sticky footer, and all behavior. Update snapshot tests honestly.
Gates: pnpm typecheck && pnpm lint + vitest (lead). Live-verify at :3000 (open Add Risk on a lead product); screenshots ${SHOTS}/c-risk-dialog-before.png (if recoverable) + c-risk-dialog-after.png. Commit (explicit paths). Check task-group 1 boxes.
${COMMON_RULES}
Return StructuredOutput: status; summary; commit; screenshots; openQuestions.`,
    { label: `impl:risk-dialog`, phase: "Implement", schema: IMPL_SCHEMA },
  ),
);

// 3) SLIDES product card — content + equal height + VERIFY statuses on clean seed.
log("=== slides card (3/4) ===");
impl.push(
  await agentWithRetry(
    `Task groups 2 + 3 of openspec/changes/${CHANGE}/tasks.md — slides/lead-product-grid.tsx.
(2.1) Surface risk/decision CONTENT on each product card, not just the counts in the footer. Today ItemList shows current/next items and the footer shows only "N risks / N decisions". Show the actual risk titles and decision titles on the card (reuse the ItemList style; keep it readable, cap with "+N more" like the items). Keep counts or fold them into the section header.
(2.2) EQUAL-HEIGHT cards across each grid row (currently each card sizes to content). Use a grid/flex technique that makes cards in a row share height; the footer should sit at the bottom (mt-auto already present).
(3.1) VERIFY slide statuses on the freshly reseeded data: rethink-pipeline changed slide status derivation (section-slide-utils floorSlideStageStatus → deriveEffectiveStageStatus). At :3000 ?mode=slides (dev-login lead), confirm each product's StatusBadge matches the live card/pipeline status (add a risk → badge reflects it; remove → reverts). If a REAL mismatch exists, fix it in the slide derivation (section-slide-utils.ts / lead-form mapper) and note it touches rethink-pipeline scope. If statuses are correct, record that the earlier "statuses wrong" was the dirty-seed/period-drift state.
Gates: pnpm typecheck && pnpm lint + vitest (slides). Add/extend tests (card renders risk/decision content; equal-height contract; status derivation). Screenshots ${SHOTS}/c-slides-cards-after.png. Commit (explicit paths). Check task-group 2 + 3 boxes.
${COMMON_RULES}
Return StructuredOutput: status; summary (incl. the slide-status verdict: real bug fixed vs was-dirty-seed); commit; screenshots; openQuestions.`,
    { label: `impl:slides-card`, phase: "Implement", schema: IMPL_SCHEMA },
  ),
);

// 4) REPORTS HISTORY — default no-archive, URL stable, nav active independent.
log("=== reports history (4/4) ===");
impl.push(
  await agentWithRetry(
    `Task group 4 of openspec/changes/${CHANGE}/tasks.md — reports history behavior. Files: app/(app)/reports/page.tsx (HistoryArchiveToggle + tab/archive state) and navigation/nav-bar.tsx (History link active state).
(4.1) History MUST default to showing WITHOUT archive (archive off by default).
(4.2) Toggling the archive switch MUST NOT change the URL — no query-param churn / no router push that rewrites the address. Keep archive state local (or non-URL) so the address stays stable.
(4.3) The nav "History" link active/selected state MUST be independent of the archive toggle — toggling archive must never make "History" look un-highlighted. Check how nav-bar.tsx computes the active link (likely pathname/query based) and decouple it from the archive query param.
Gates: pnpm typecheck && pnpm lint + vitest (reports + navigation). Add tests: default no-archive; toggling archive does not change the URL; History nav stays active regardless of archive. Live-verify at :3000 (/reports, toggle archive, watch the address bar + the History nav highlight). Screenshot ${SHOTS}/c-history-after.png. Commit (explicit paths). Check task-group 4 boxes.
${COMMON_RULES}
Return StructuredOutput: status; summary; commit; screenshots; openQuestions.`,
    { label: `impl:history`, phase: "Implement", schema: IMPL_SCHEMA },
  ),
);

// ---- Review ----
phase("Review");
const okImpl = impl.filter(Boolean).filter((r) => r.status === "done");
const implDigest = okImpl.map((r) => r.summary).join("\n---\n");
const reviews = await parallel(
  [
    "spec-fidelity-and-user-intent",
    "correctness-and-contracts",
    "test-honesty",
  ].map(
    (lens) => () =>
      agent(
        `READ-ONLY adversarial review (lens: ${lens}) of OpenSpec change "${CHANGE}" in ${REPO} (live-walk rework). NO edits, NO commits.
Implementers' claims:\n${implDigest}
Find the change's commits ("git log --oneline -16", "git show <hash>"). Verify against openspec/changes/${CHANGE}/{proposal.md,tasks.md}.
Focus: (a) head toolbar actually reuses lead components and is 1:1 (one shared height incl AgentReview; Export-PDF + Publish in the pill) — the user rejected this twice; be strict; (b) risk dialog is a NEW balanced 2-col, not the old overloaded 4xl, height under 92vh; (c) slides show risk/decision content + equal-height + status derivation correct; (d) history default no-archive + URL stable + nav active independent; (e) repo-rule violations (Russian UI strings, magic numbers, orphaned imports, unrelated reformat, dishonest tests).
Report ONLY verified-real findings (cite file:line/commit). severity: blocker=wrong behavior/broken gate; major=real defect cheap to fix; minor=note.`,
        { label: `review:${lens}`, phase: "Review", schema: REVIEW_SCHEMA },
      ),
  ),
);
const findings = reviews.filter(Boolean).flatMap((r) => r.findings);
const mustFix = findings.filter(
  (f) => f.severity === "blocker" || f.severity === "major",
);
const minors = findings.filter((f) => f.severity === "minor");

let fix = null;
if (mustFix.length > 0) {
  log(`${mustFix.length} must-fix -> fixer`);
  fix = await agentWithRetry(
    `Fix the verified review findings for OpenSpec change "${CHANGE}" in ${REPO}.
Findings (JSON): ${JSON.stringify(mustFix)}
Minimal fixes only. Re-run gates: pnpm typecheck && pnpm lint + targeted vitest. Re-verify any UI fix live at :3000 + screenshot to ${SHOTS}. Commit (explicit paths, "fix: ${CHANGE} ...").
${COMMON_RULES}
Return StructuredOutput: status done/failed; summary; commit; screenshots.`,
    { label: `fix:${CHANGE}`, phase: "Review", schema: IMPL_SCHEMA },
  );
}

// ---- Finalize (NO build — keep the stand up for the user's morning review) ----
phase("Finalize");
const gates = await agentWithRetry(
  `Run gates in ${REPO} after the phase-C live-walk rework: pnpm typecheck && pnpm lint && pnpm test. Report exact failures. A failure clearly traceable to a phase-C commit -> minimal fix + commit (own files, trailer); else report only. Do NOT run pnpm build and do NOT kill the dev servers — leave :3000 up for the user's morning review. Confirm :3000 still answers (curl --noproxy '*' -s -o /dev/null -w '%{http_code}' http://localhost:3000/).
${COMMON_RULES}
Return StructuredOutput: status done/failed; summary (each gate result + :3000 code).`,
  { label: "gates", phase: "Finalize", schema: IMPL_SCHEMA },
);

const report = await agent(
  `Append a phase-C section to /tmp/finish-backlog-report.md in ${REPO} (do not overwrite the existing phase-B content; add "## Phase C — live-walk rework 2026-06-14").
Input (JSON): ${JSON.stringify({ impl: impl.map((r) => (r ? { status: r.status, summary: r.summary, commit: r.commit ?? null, screenshots: r.screenshots ?? [] } : null)), mustFix, minors, fix: fix ? { status: fix.status, summary: fix.summary } : null, gates })}
Russian prose, one thought per line. Cover: per-item status (head toolbar, risk dialog, slides, history); the slide-status verdict (real bug vs dirty-seed); screenshots in ${SHOTS}; "self-verified via tests+DOM, NOT visually accepted by human"; head-toolbar flagged for the parent session to eyeball; gates + :3000 state; change ${CHANGE} left ACTIVE (not archived).
Return the file path + an 8-line digest.`,
  { label: "report", phase: "Finalize" },
);

return {
  items: impl.map((r) =>
    r ? { status: r.status, commit: r.commit ?? null } : { status: "died" },
  ),
  mustFix: mustFix.length,
  minors: minors.length,
  fix: fix ? fix.status : "none",
  gates: gates ? gates.status : "unknown",
  screenshots: impl.filter(Boolean).flatMap((r) => r.screenshots ?? []),
  report: report ?? "report died",
};
