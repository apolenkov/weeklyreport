export const meta = {
  name: "waveb-change",
  description:
    "Implement ONE Wave B OpenSpec change on the shared tree, then adversarially verify it (no commit, no migrate-reset)",
  phases: [{ title: "Implement" }, { title: "Verify" }],
};

// ----- per-change config: edit this block, re-run with the same scriptPath -----
const CHANGE = {
  name: "scope-period-lifecycle-authz",
  // seam ordering caveat carried from the NIGHT-PLAYBOOK
  seam:
    "trpc.router.ts (period.publish/reopen only — thread ctx.session into reopen), " +
    "trpc.error-mapper.ts (add ONLY PeriodScopeError->FORBIDDEN + PeriodNotFoundError->NOT_FOUND; " +
    "do NOT add a PeriodAccessError branch), admin/period-admin.service.ts (published-date guard). " +
    "Touch ONLY procedures this change names; leave sibling router procedures untouched.",
  // named caveat from the playbook (empty string when none)
  caveat:
    "Reuse the SAME resolver query definitions across weekly-report + period repos (no second copy). " +
    "Do NOT mutate getLatestPublishedId (it feeds the viewer default-report fallback) — ADD getLatestPublishedNonArchivedId. " +
    "Head default-report resolution MUST converge to the lifecycle authz target so a legitimate head is never false-rejected.",
  // enumerated-completeness checklist the verifier must confirm against the diff
  mustCover: [
    "publish: head target = server-derived active editable id; client reportId mismatch rejected (PeriodScopeError->FORBIDDEN), never silently retargeted; admin skips the equality check",
    "reopen: ctx.session threaded; head target = latest-published-non-archived id; mismatch rejected; admin skips",
    "archived report rejected for BOTH publish and reopen, for ALL roles",
    'bare throw "Report not found" -> PeriodNotFoundError -> NOT_FOUND in BOTH publishPeriod and reopenPeriod',
    "weekly-report resolveDefaultReportId head branch -> getCurrentEditableId() ?? getLatestPublishedNonArchivedId(); lead stays getActiveReportId; viewer unchanged",
    "new getLatestPublishedNonArchivedId(archived:false, periodStart desc,id desc); getLatestPublishedId NOT mutated",
    "period-admin updatePeriodManual: published period rejects periodStart/periodEnd/deadline edits (AdminAccessError->FORBIDDEN); weekLabel-only ok; non-published ok",
    "error-mapper adds ONLY the two new classes; no PeriodAccessError reclassification",
  ],
  // change-specific reachability question for the verifier
  reachability:
    "Can a non-admin head reopen/republish a period they are NOT actively working on (a stale, foreign, or archived target) by ANY path the diff left open — the default-resolution branch, a sibling procedure, a missing role gate, or a reportId that bypasses the equality check?",
  // regression question (the legitimate-flow trap this change is prone to)
  regression:
    "Does a real head get false-FORBIDDEN on a legitimate publish/reopen? Trace: does the reportId the head UI submits (via resolveDefaultReportId) now EQUAL the lifecycle authz target after the convergence change? Confirm admin keeps god-mode; confirm the two error classes map correctly and nothing else is over-mapped.",
};
// ------------------------------------------------------------------------------

const REPO = "/home/user/work/customreport";
const BASE = "chore/exemplary-code-standard";

const STANDARDS = [
  "Exemplary code standard: functional/immutable (const, pure fns, map/filter/reduce + spread; avoid let/mutation); files < 250 lines; functions <= 50 lines; cognitive complexity < 10.",
  'NO fallbacks / silent defaults for product config (no `?? "localhost"`, no `.default()` in env.schema). Mandatory vars are REQUIRED (Zod, no default) read via requireEnv; boot fails loud.',
  "UI strings in apps/web/**/*.tsx stay English (JSX/toast/aria/placeholder). Russian only in DB/seed data, comments, test fixtures.",
  "Comment hygiene: NO ticket/phase/change-slug prefixes (no `UFB-052`, `Phase X`) in comments. Explain the WHY of current code only; never narrate what the code already says.",
  "Strict lint rules are ERRORS and bite mid-edit: require-await, no-unnecessary-condition, prefer-string-raw, jsdoc-on-private-helper, x-powered-by. Changed paths MUST pass `eslint --max-warnings 0`.",
  "Reuse canonical helpers (e.g. groupScopeFilter from apps/api/src/lib/group-scope.ts). tRPC procedures MUST use one of the 9 canonical middleware-chain builders (matched by reference identity) — never hand-roll a chain.",
  "Period dual-state invariant: a Report write updates BOTH the new period state AND the legacy period tuple, atomically.",
];

phase("Implement");
const impl = await agent(
  [
    `You are implementing ONE OpenSpec change on a SHARED working tree at ${REPO}`,
    `(git branch impl/backlog-2026-06-30, MVP phase). DO NOT commit, DO NOT \`git add\`, DO NOT \`prisma migrate reset\`, DO NOT touch git at all — leave the edits in the working tree for the human to review and commit.`,
    ``,
    `Change: ${CHANGE.name}. Read its FULL spec first and implement EVERY task exactly:`,
    `  openspec/changes/${CHANGE.name}/proposal.md`,
    `  openspec/changes/${CHANGE.name}/design.md`,
    `  openspec/changes/${CHANGE.name}/tasks.md`,
    `Use codegraph_explore to locate the current code — plan anchors (line numbers) may be slightly stale; trust the code and FLAG any drift in staleAnchors.`,
    ``,
    `Seam caveat for THIS change: ${CHANGE.seam}`,
    CHANGE.caveat ? `Named caveat: ${CHANGE.caveat}` : ``,
    ``,
    `Hard repo standards (violating any fails my review):`,
    ...STANDARDS.map((s, i) => `  ${i + 1}. ${s}`),
    ``,
    `Tests: write the unit + real-DB integration tests the tasks specify. The test DB is UP (customreport_test). Integration tests self-fixture (Prisma 7 reset does not auto-seed). Mirror existing patterns, e.g. apps/api/src/modules/report-sections/leadform-revoke-scope.integration.test.ts and apps/api/src/modules/group-scope.integration.test.ts.`,
    ``,
    `Run change-local checks YOURSELF (but never the full suite, never migrate-reset):`,
    `  pnpm --filter @customreport/api db:generate   # only if Prisma-client TS errors (TS2339 on a known model)`,
    `  pnpm --filter @customreport/api typecheck`,
    `  cd ${REPO} && pnpm exec eslint <your changed files> --max-warnings 0   # NEVER \`eslint .\` (OOM)`,
    `  cd ${REPO}/apps/api && pnpm exec vitest run <your new/changed test files>   # do NOT wrap vitest in rtk (mis-parses TSX -> 0 tests)`,
    ``,
    `Return ONLY the structured object: a one-paragraph summary, the exact files you touched, the test files you added, the pass/fail/notrun status of each local check with detail, any stale plan anchors, and any open questions for the reviewer.`,
  ]
    .filter(Boolean)
    .join("\n"),
  {
    label: `impl:${CHANGE.name}`,
    phase: "Implement",
    effort: "max",
    schema: {
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
    },
  },
);

if (!impl) {
  return {
    implemented: false,
    reason: "implement agent returned null (skipped or died)",
  };
}

phase("Verify");
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

const diffCmd = `cd ${REPO} && git --no-pager diff ${BASE} -- . ':(exclude)openspec'`;
const verifyHead = [
  `Adversarially verify an UNCOMMITTED authz/correctness fix on the working tree at ${REPO} for OpenSpec change ${CHANGE.name}.`,
  `Read the intent: openspec/changes/${CHANGE.name}/proposal.md and design.md.`,
  `Read the actual change: run \`${diffCmd}\` (the work is uncommitted in the working tree, layered on ${BASE}).`,
  `Use codegraph_explore to trace call paths around the changed symbols. Be skeptical; default to finding a hole, not approving.`,
  ``,
].join("\n");

const lensCompleteness = [
  verifyHead,
  `LENS — ENUMERATED COMPLETENESS + CROSS-SCOPE REACHABILITY.`,
  `The spec enumerates exactly what must be guarded. Confirm the diff handles EVERY one of these, and name any that is missing or only partially handled:`,
  ...CHANGE.mustCover.map((m, i) => `  [${i + 1}] ${m}`),
  ``,
  `Then the reachability question: ${CHANGE.reachability}`,
  `For each gap: file:line, the concrete scenario (specific inputs -> wrong/leaked outcome), severity.`,
].join("\n");

const lensRegression = [
  verifyHead,
  `LENS — REGRESSION + STANDARDS.`,
  `Regression question: ${CHANGE.regression}`,
  `Also check the diff against repo standards: any new \`let\`/mutation where const/pure would do, any fallback/silent default (\`?? "..."\`, \`.default()\`), any non-English UI string in apps/web tsx, any ticket/phase comment prefix, any hand-rolled tRPC chain instead of a canonical builder, any function > 50 lines or file > 250 lines introduced, any period-dual-state atomicity regression (a Report write that updates only one of the two period representations).`,
  `Confirm the new tests actually have teeth — would they fail if the guard were reverted? Flag any test that asserts on fabricated error meta rather than a ground-truth DB error.`,
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

return {
  implemented: true,
  change: CHANGE.name,
  impl,
  verify: {
    completeness: verdicts[0],
    regression: verdicts[1],
  },
};
