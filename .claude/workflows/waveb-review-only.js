export const meta = {
  name: "waveb-review-only",
  description:
    "Review an ALREADY-IMPLEMENTED, uncommitted change on the shared tree (no implement, no commit): 2 adversarial verifiers + full gate + Codex, scoped to an explicit file list so parallel-session edits elsewhere are ignored. Used to salvage a change whose implement stage completed but whose workflow crashed before review.",
  phases: [{ title: "Verify" }, { title: "Gate" }, { title: "Codex" }],
};

const REPO = "/home/user/work/customreport";

// ---- the change under review (make-publish-atomic, #16) ----
const CHANGE = {
  name: "make-publish-atomic",
  // Explicit scope — ONLY these files are this change's work. Concurrent
  // parallel-session edits outside this list must be IGNORED.
  scopeTracked: [
    "apps/api/src/infrastructure/trpc/trpc.router.ts",
    "apps/api/src/modules/period/__tests__/lifecycle-write-gate.test.ts",
    "apps/api/src/modules/period/period.contract.test.ts",
    "apps/api/src/modules/period/period.integration.test.ts",
    "apps/api/src/modules/period/period.prisma-repository.ts",
    "apps/api/src/modules/period/period.service.test.ts",
    "apps/api/src/modules/period/period.service.ts",
    "apps/api/src/modules/publication/publication.contract.test.ts",
    "apps/api/src/modules/publication/publication.integration.test.ts",
    "apps/api/src/modules/publication/publication.prisma-repository.ts",
    "apps/api/src/modules/publication/publication.service.test.ts",
    "apps/api/src/modules/publication/publication.service.ts",
  ],
  scopeNew: [
    "apps/api/src/modules/period/period.publish-atomicity.integration.test.ts",
    "apps/api/src/infrastructure/trpc/review-publish-target.test.ts",
  ],
  mustCover: [
    "period.prisma-repository publishPeriod: tx.report.updateMany({where:{id, periodStatus:{not:'published'}}, data: buildTransition('publish',...)}) capturing {count}; count===0 -> no-op (NO snapshot rebuild); count===1 -> findUniqueOrThrow(reportFullIncludeForSnapshot) + snapshot write in the SAME $transaction.",
    "period.service publishPeriod: both counters (customreportReportsSubmittedTotal, customreportPeriodStateTransitionsTotal) AND the ingestion enqueue run ONLY when count===1; the transition counter from-label is the row's prior periodStatus (open vs reopened), never hardcoded.",
    "publication.service publishReport: conditional write on periodStatus!='published' (NOT legacy status); fast-path rejection tests periodStatus==='published' (so a reopened period stays publishable); prior periodStatus surfaced for the from-label.",
    "publication.service: snapshot rebuild + ingestion enqueue + both counters gated on count===1; zero-transition returns the already-published assembled report (same idempotent choice as the period path), never a second rebuild.",
    "trpc.router review.publish + review.assembledReport resolve target via getCurrentEditableId (newest non-archived open/reopened, periodStart<=now, periodStart desc then id desc), replacing ctx.session.activeReportId; review.dashboard moved off its looser inline query onto the SAME resolver; dead activeReportId null-checks removed for publish/assembledReport; dashboard keeps its empty-result response.",
    "resolver-returns-nothing: review.publish/assembledReport raise a domain 'no active period' error mapped to a tRPC error (NOT acting on a stale id); dashboard keeps empty-result.",
    "getCurrentEditableId reused unchanged (NOT getActiveReportId, which adds a published fallback the publish/dashboard paths must not have); not forked.",
    "period-dual-state CI matcher (lifecycle-write-gate.test.ts) extended to recognize report.updateMany as a guarded buildTransition-sourced lifecycle write — and STILL HAS TEETH: a raw updateMany of lifecycle fields NOT sourced from buildTransition would still trip it (the matcher was not loosened to a blanket allow).",
    "characterization tests added and now PASS (FAIL before fix): two concurrent publishPeriod transition ONCE; concurrent review.publish same; DB-resolved target wins over a stale activeReportId; reopened period republishable emitting from:'reopened'.",
    "telemetry-contract tests: a redundant concurrent publish increments each counter EXACTLY once for BOTH paths; from-label carries actual prior periodStatus, never hardcoded from:'open'.",
  ],
  reachability:
    "Under a double-click or two concurrent head tabs, can EITHER publish path still transition the period twice, rebuild the snapshot twice, or double-increment a counter? Any path where the from-label is hardcoded 'open' for a reopened period, or where review.publish still acts on a stale ctx.session.activeReportId instead of the DB-resolved target?",
  regression:
    "Does a legitimate single publish still transition the row, rebuild the snapshot once, enqueue ingestion once, increment both counters once? Does a reopened period still publish (periodStatus-keyed fast-path must not reject it)? Do review.dashboard / assembledReport / publish now ALL resolve the identical period? Is the zero-transition idempotent result the same shape across both paths (not a 500)? Does the dual-state matcher still pass with updateMany recognized AND still reject a non-buildTransition lifecycle updateMany?",
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
