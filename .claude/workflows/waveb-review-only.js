export const meta = {
  name: "waveb-review-only",
  description:
    "Review an ALREADY-IMPLEMENTED, uncommitted change on the shared tree (no implement, no commit): 2 adversarial verifiers + full gate + Codex, scoped to an explicit file list so parallel-session edits elsewhere are ignored. Used to salvage a change whose implement stage completed but whose workflow crashed before review.",
  phases: [{ title: "Verify" }, { title: "Gate" }, { title: "Codex" }],
};

const REPO = "/Users/ap/work/weeklyreport";

// ---- the change under review (needs-attention-to-good, calibration slices 22+23) ----
const CHANGE = {
  name: "needs-attention-to-good",
  // Explicit scope — ONLY these files are this slice's work. Concurrent edits
  // outside this list must be IGNORED. report-slides.tsx is DELETED (tracked).
  scopeTracked: [
    "apps/web/src/features/slides/ui/head-slides-client.test.tsx",
    "apps/web/src/features/slides/ui/head-slides-client.tsx",
    "apps/web/src/features/slides/ui/lead-slides-client.clamp.test.tsx",
    "apps/web/src/features/slides/ui/lead-slides-client.test.tsx",
    "apps/web/src/features/slides/ui/lead-slides-client.tsx",
    "apps/web/src/features/slides/ui/report-slides.tsx",
    "apps/web/src/features/viewer/ui/viewer-report-shell.test.tsx",
    "openspec/changes/needs-attention-to-good/tasks.md",
  ],
  scopeNew: [],
  mustCover: [
    "viewer-report-shell.test.tsx: every comment that referenced OpenSpec change/task IDs ('viewer-live-status (task 5.1)' etc.) is rewritten to state the load-bearing WHY only. ANTI-GAMING: no re-labeled archaeology (issue IDs, dates, 'per spec X' as substitutes) anywhere in the file.",
    "viewer-report-shell.test.tsx addressed-older-period test: fixtures are now dispatched by QUERY IDENTITY (key/procedure path), not mockImplementationOnce call order/count; an added or reordered hook call cannot silently swap fixtures. The test's assertions prove the SAME behaviors as before — nothing weakened or deleted.",
    "report-slides.tsx (shallow variant->mode wrapper) is deleted; every former consumer (lead-slides-client, head-slides-client and their tests) now uses StatusSlideDeck directly with the correct mode prop; no import of ReportSlides remains anywhere in the repo.",
    "slide-grid-cells.test.ts is UNTOUCHED (its seed finding was stale — already fixed by harden-test-suite-quality) and the stale re-grade is recorded in needs-attention-to-good/tasks.md wave notes per the campaign's checklist rule.",
    "tasks.md ticks for slices 22/23 accurately reflect what was done vs recorded-stale; no unrelated task ticked.",
  ],
  reachability:
    "Grep-level: does any file still import/reference ReportSlides or pass 'variant' where 'mode' is expected? Does any comment in viewer-report-shell.test.tsx still smuggle change/task archaeology, including re-labeled forms? Is there any remaining ordering-dependence in the mock dispatch (a mockImplementationOnce chain whose meaning changes if a hook is added)?",
  regression:
    "Do lead and head slide surfaces render identically to before (mode mapping correct for both)? Do all touched test suites still assert the same behaviors (no deleted/weakened assertion vs HEAD)? Do the touched files pass eslint --max-warnings 0 and the web typecheck?",
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

const scopeArg = [...CHANGE.scopeTracked].map((p) => `'${p}'`).join(" ");
const diffCmd = `cd ${REPO} && git --no-pager diff HEAD -- ${scopeArg}`;
const newFilesNote = `This change also ADDS new untracked files not shown by the diff above — read them in full: ${CHANGE.scopeNew.join(", ")}.`;

const verifyHead = [
  `Adversarially verify an UNCOMMITTED, already-implemented change on the working tree at ${REPO}: ${CHANGE.name}.`,
  `Read the intent: openspec/changes/${CHANGE.name}/proposal.md, design.md, tasks.md.`,
  `Read the actual change: run \`${diffCmd}\`. ${newFilesNote}`,
  `IMPORTANT: ignore any edits to CONTEXT.md or docs/ — those are concurrent parallel-session work, NOT part of this change.`,
  `Use codegraph_explore to trace call paths around changed symbols. Be skeptical; default to finding a hole, not approving.`,
  ``,
].join("\n");

phase("Verify");
const lensCompleteness = [
  verifyHead,
  `LENS — ENUMERATED COMPLETENESS + CONCURRENCY REACHABILITY.`,
  `Confirm the diff handles EVERY one of these; name any missing or partial:`,
  ...CHANGE.mustCover.map((m, i) => `  [${i + 1}] ${m}`),
  ``,
  `Then the reachability question: ${CHANGE.reachability}`,
  `For each gap: file:line, concrete scenario (specific inputs -> wrong outcome under concurrency), severity.`,
].join("\n");

const lensRegression = [
  verifyHead,
  `LENS — REGRESSION + STANDARDS + TEST TEETH.`,
  `Regression question: ${CHANGE.regression}`,
  `Check the diff against repo standards: any new let/mutation where const/pure would do; any fallback/silent default; any non-English UI string; any ticket/phase/change-slug comment prefix; any hand-rolled tRPC chain; any function > 50 lines or file > 250 lines introduced; any period-dual-state atomicity regression (a Report lifecycle write whose data is NOT sourced from buildTransition).`,
  `Confirm new/changed tests have TEETH — would the concurrency tests FAIL if the updateMany predicate were reverted to a plain update? Would the matcher test FAIL if a raw lifecycle updateMany were introduced? Flag any test asserting on fabricated state rather than a ground-truth concurrent DB outcome.`,
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

phase("Gate");
const gate = await agent(
  [
    `Run the FULL local quality gate for the uncommitted change ${CHANGE.name} at ${REPO}. Run each step as a SEPARATE command (the foreground shell caps at 600s). Do NOT edit any code. Do NOT touch git. Report results only.`,
    ``,
    `1. cd ${REPO} && pnpm --filter @customreport/api db:generate   # regenerate the .prisma client first`,
    `2. cd ${REPO} && pnpm typecheck`,
    `3. cd ${REPO} && pnpm lint`,
    `4. cd ${REPO} && pnpm test            # full unit suite`,
    `5. cd ${REPO} && pnpm --filter @customreport/api test:integration   # FULL real-DB integration suite (postgres container customreport-postgres-1 up; loads ../../.env.test). Do NOT wrap vitest in rtk.`,
    ``,
    `Report pass|fail|skip for each. redFiles = every failing test file (empty if none). summary = a short digest; for ANY failure include the precise error excerpt. Confirm the new period.publish-atomicity.integration.test.ts and the publication/period concurrency + telemetry tests are among the green.`,
  ].join("\n"),
  {
    label: `gate:${CHANGE.name}`,
    phase: "Gate",
    effort: "medium",
    schema: GATE_SCHEMA,
  },
);

phase("Codex");
const codex = await agent(
  [
    `You are an independent, read-only adversarial reviewer of an UNCOMMITTED, already-implemented change on the working tree at ${REPO}: ${CHANGE.name}.`,
    `Intent: openspec/changes/${CHANGE.name}/{proposal,design,tasks}.md.`,
    `Read the diff: \`${diffCmd}\`. ${newFilesNote}`,
    `IGNORE CONTEXT.md / docs/ edits (concurrent parallel-session work, not this change).`,
    `This is a CONCURRENCY + ATOMICITY change (publish TOCTOU) plus a DB-resolved publish target. Hunt hard for: a remaining double-transition / double-counter / double-snapshot path under a race; a reopened period that the periodStatus-keyed fast-path wrongly rejects; review.publish still reading a stale ctx.session.activeReportId; a zero-transition that 500s instead of returning idempotently; a lifecycle-write-gate matcher that was LOOSENED (no longer catches a non-buildTransition lifecycle updateMany); a from-label hardcoded 'open' for a reopened period.`,
    `Return verdict "clean" ONLY if you found nothing real. Otherwise "issues" with each finding's file, line, concrete scenario, severity (blocker/major/minor).`,
  ].join("\n"),
  {
    label: `codex:${CHANGE.name}`,
    phase: "Codex",
    effort: "high",
    agentType: "codex:codex-rescue",
    schema: VERIFY_SCHEMA,
  },
);

const verifyFindings = verdicts
  .filter(Boolean)
  .flatMap((v) => v.findings || []);
const codexFindings = codex ? codex.findings || [] : [];
const isBlocking = (f) => f.severity === "blocker" || f.severity === "major";
const blockers = [...verifyFindings, ...codexFindings].filter(isBlocking);
const gateGreen =
  gate &&
  gate.typecheck === "pass" &&
  gate.lint === "pass" &&
  gate.unitTests === "pass" &&
  gate.integrationTests === "pass";

return {
  change: CHANGE.name,
  gateGreen,
  gate,
  verify: { completeness: verdicts[0], regression: verdicts[1] },
  codex: {
    status: codex ? codex.verdict : "unavailable",
    findings: codexFindings,
  },
  blockers,
  recommendation:
    gateGreen && blockers.length === 0 && codex
      ? "COMMIT-READY (orchestrator: review diff then commit the scope paths)"
      : "DO NOT COMMIT — resolve blockers / gate / null-Codex first",
  scopeToCommit: [...CHANGE.scopeTracked, ...CHANGE.scopeNew],
};
