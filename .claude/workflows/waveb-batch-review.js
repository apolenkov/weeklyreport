export const meta = {
  name: "waveb-batch-review",
  description:
    "Review a BATCH of already-implemented, uncommitted seam-disjoint campaign slices on the shared tree: one adversarial Opus lens per slice (fan-out) + one codex adversarial review over the whole batch + ONE full gate. No commits — returns per-slice verdicts for the orchestrator.",
  phases: [{ title: "Verify" }, { title: "Codex" }, { title: "Gate" }],
};

const REPO = "/Users/ap/work/weeklyreport";
const CAMPAIGN = "good-to-exemplary-triage";

// Orchestrator policy (see openspec/changes/good-to-exemplary-triage/LANE-ROUTING.md):
// - P4 red-slice rule: a blocker or lens-death NEVER re-runs this batch. Green
//   sibling slices commit immediately (targeted per-seam git add); the red slice
//   is remediated, then re-reviewed via waveb-review-only scoped to its file
//   list + a standalone re-run of only the failed gate step(s).
// - P2 gate tiers: GATE_TIER below is set by the generator ("fast" default;
//   "full" forced for L seams / non-test apps/api / prisma / packages/shared;
//   full also runs every 2-3 batches and before any push cluster).
// - P10: refuted dispositions need a second-vendor counter-check before the
//   ledger is stamped.
// - The per-run block below is written by .claude/scripts/generate-slices.mjs
//   from the ledger's lane column — do not hand-edit slice lists.

// ---- per-run config: the batch of slices under review ----
const SLICES = [
  {
    name: "web-landing-org-period",
    files: [
      "apps/web/src/features/organization/ui/settings-identity-sub-tab.tsx",
      "apps/web/src/features/organization/ui/settings-integrations-sub-tab.tsx",
      "apps/web/src/features/period/ui/current-week-section-add-signal.test.tsx",
      "apps/web/src/features/period/ui/decision-edit-dialog.tsx",
      "apps/web/src/features/period/ui/decisions-section.snapshot.test.tsx",
      "apps/web/src/features/period/ui/decisions-section.tsx",
      "apps/web/src/features/period/ui/head-publish-lock-action.tsx",
      "apps/web/src/features/period/ui/period-navigator.test.tsx",
      "apps/web/src/features/period/ui/periods-tab-icons.tsx",
      "apps/web/src/features/period/ui/sdlc-pipeline.test.tsx",
      "apps/web/src/features/period/ui/use-decision-edit-dialog.ts",
    ],
    brief:
      "24 minors, 10/11 done + 1.1 annotated open (shared constant needs packages/shared). Verify: identity sub-tab local constant used consistently; integrations sub-tab no longer fires a discarded status request (no behavior change for the Coming Soon seam — the deferred-AI literals re-grade must be justified); meta-row snapshots became behavioral assertions (DELETION CHECK on snapshots); sdlc-pipeline now REJECTS a missing locked button (teeth); periods-tab-icons re-exports the canonical shared PlusIcon (no duplicate SVG).",
  },
  {
    name: "web-report-pages",
    files: [
      "apps/web/src/features/report-pages/ui/activity-status-strip.test.tsx",
      "apps/web/src/features/report-pages/ui/head-report-shell.tsx",
      "apps/web/src/features/report-pages/ui/lead-form-dialogs.tsx",
      "apps/web/src/features/report-pages/ui/lead-form-sync-bridge.tsx",
      "apps/web/src/features/report-pages/ui/next-week-section.tsx",
      "apps/web/src/features/report-pages/ui/unified-activity-section.tsx",
      "apps/web/src/features/report-pages/ui/use-lead-form-add-signals.test.tsx",
      "apps/web/src/features/report-pages/ui/use-lead-form-redirects.ts",
      "apps/web/src/features/report-pages/ui/weekly-report-skeleton.test.tsx",
    ],
    brief:
      "21 minors, 9/9 ticked, none stale. Verify: activity-status-strip covers derived status/ownership/linked products/ru ordering (ru-collation pin quality — recall the earlier host-locale trap: does the assertion bite on a ru-RU host?); add-signals exercises all four independent signals; weekly-report-skeleton replaced snapshot with exact equality (DELETION CHECK); archaeology purge kept load-bearing rationale. One obsolete OUT-OF-SLICE .snap entry reported — name its path for orchestrator cleanup.",
  },
  {
    name: "api-infrastructure",
    files: [
      "apps/api/src/infrastructure/bullmq/raw-bullmq-processor.ts",
      "apps/api/src/infrastructure/email/email-dispatch.integration.test.ts",
      "apps/api/src/infrastructure/health/prisma.health.ts",
      "apps/api/src/infrastructure/trpc/__tests__/role-claim.contract.test.ts",
      "apps/api/src/infrastructure/trpc/__tests__/role-coverage.test.ts",
      "apps/api/src/infrastructure/trpc/reopen-requests.router.test.ts",
      "apps/api/src/infrastructure/trpc/routers/organization.router.ts",
      "apps/api/src/infrastructure/trpc/trpc.context.ts",
      "apps/api/src/infrastructure/trpc/trpc.session-hydration.ts",
    ],
    brief:
      "19 minors, 8/9 ticked + 3.7 annotated open (organization.router required-typing needs trpc.router.ts). Verify: raw-bullmq-processor now handles+logs Worker error events (real handler, not decorative); prisma.health forwards failure messages (no swallowed detail); organization.router SILENT IDENTITY FALLBACK REMOVED — this is behavior-adjacent: trace callers to confirm no consumer depended on the fallback; role-coverage docs match all 8 canonical chains; email-dispatch escalation sent-marking verified.",
  },
  {
    name: "web-shared",
    files: [
      "apps/web/src/shared/ui/confirm-delete-dialog.tsx",
      "apps/web/src/shared/ui/confirmation-dialog.tsx",
      "apps/web/src/shared/ui/forbidden-page.test.tsx",
      "apps/web/src/shared/ui/icons.test.tsx",
      "apps/web/src/shared/ui/report-shell/agent-review-coming-soon.test.tsx",
      "apps/web/src/shared/ui/report-shell/archive-toggle.test.tsx",
      "apps/web/src/shared/ui/report-shell/report-shell.test.tsx",
      "apps/web/src/shared/ui/report-shell/scope-toggle.test.tsx",
      "apps/web/src/shared/ui/sdlc-tooltip.tsx",
    ],
    brief:
      "19 minors, 6 done + 3 declared blockers (4.2/4.5/4.7 need out-of-slice files — verify annotated, untouched). Verify: confirm/confirmation dialogs tokenized (no visual regression risk: tokens must resolve to equivalent colors); forbidden-page vacuous+snapshot checks replaced with landmark/behavior assertions (DELETION CHECK); scope-toggle dialog guard replaced with KEYBOARD behavior (teeth); sdlc-tooltip provider usage corrected (verify actual provider semantics). Four obsolete out-of-slice snapshot entries reported — list their paths.",
  },
];
const GATE_TIER = "full";
// ----------------------------------------------------------

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

const lensPrompt = (slice) =>
  [
    `Adversarially verify ONE campaign slice of UNCOMMITTED edits at ${REPO} (campaign ${CAMPAIGN}; read openspec/changes/${CAMPAIGN}/proposal.md for intent, and the slice's checkboxes in tasks.md).`,
    `THIS SLICE'S FILES (ignore every other dirty file — other slices and harness scripts are not yours):`,
    ...slice.files.map((f) => `  ${f}`),
    `Read the diff: cd ${REPO} && git --no-pager diff HEAD -- ${slice.files.map((f) => `'${f}'`).join(" ")}. A DELETED file's full old content: git show HEAD:<path>.`,
    ``,
    `WHAT THE IMPLEMENTER CLAIMS: ${slice.brief}`,
    ``,
    `Check, skeptically (default to finding a hole):`,
    `1. COMPLETENESS: every ledger finding enumerated in the brief above (ids g-### from openspec/changes/${CAMPAIGN}/class-distribution.json) is either genuinely fixed or honestly refutable-as-stale (verify stale claims against live code + git log).`,
    `2. REGRESSION + TEST TEETH: no assertion weakened or deleted without full replacement; rewritten tests still fail if the behavior they pin regresses; no behavior change beyond the claimed scope.`,
    `3. ANTI-GAMING: no re-labeled archaeology (issue IDs, dates, 'per spec X' substitutes); no metric-ducking splits; comment rewrites keep the load-bearing WHY.`,
    `4. STANDARDS on touched lines: const/no-mutation, English-only UI strings, comment hygiene.`,
    `Severity discipline: pre-existing/cross-cutting concerns OUTSIDE the touched lines are "minor" follow-ups, never blockers. Only this slice's own edits being wrong/regressive/gamed can be blocker or major.`,
    `For each finding: file:line, concrete scenario, severity.`,
  ].join("\n");

phase("Verify");
const lensResults = await parallel(
  SLICES.map(
    (s) => () =>
      agent(lensPrompt(s), {
        label: `lens:${s.name}`,
        phase: "Verify",
        model: "opus",
        effort: "high",
        schema: VERIFY_SCHEMA,
      }).then((v) => ({ slice: s.name, verify: v })),
  ),
);

phase("Codex");
const allFiles = SLICES.flatMap((s) => s.files);
const codex = await agent(
  [
    `Run an adversarial review of the UNCOMMITTED batch of campaign-slice edits at ${REPO} (campaign ${CAMPAIGN}).`,
    `Scope: git --no-pager diff HEAD -- ${allFiles.map((f) => `'${f}'`).join(" ")} (ledger: openspec/changes/${CAMPAIGN}/class-distribution.json).`,
    `Act as a principal architect: demand rewrite mandates where the fix is superficial; hunt weakened tests, re-labeled archaeology, and behavior drift in prisma seeds. Ignore dirty files outside the scope list.`,
    `Return verdict clean|issues and findings [{summary,file,scenario,severity(blocker|major|minor)}]. Findings outside the scoped files are minor follow-ups by definition.`,
  ].join("\n"),
  {
    label: `codex:batch-l`,
    phase: "Codex",
    agentType: "codex:codex-rescue",
    model: "sonnet",
    effort: "medium",
    schema: VERIFY_SCHEMA,
  },
);

phase("Gate");
const touchedWorkspaces = [
  ...new Set(
    allFiles.flatMap((f) =>
      f.startsWith("apps/api/")
        ? ["@customreport/api"]
        : f.startsWith("apps/web/")
          ? ["@customreport/web"]
          : f.startsWith("packages/")
            ? ["@customreport/api", "@customreport/web"]
            : [],
    ),
  ),
];
const gateSteps =
  GATE_TIER === "full"
    ? [
        `1. cd ${REPO} && pnpm --filter @customreport/api db:generate`,
        `2. cd ${REPO} && pnpm typecheck`,
        `3. cd ${REPO} && pnpm lint   # full chain; verify real output via rtk proxy if in doubt`,
        `4. cd ${REPO} && pnpm test   # full unit suite`,
        `5. cd ${REPO}/apps/api && DATABASE_URL=postgresql://customreport:localdev@localhost:5432/customreport_test pnpm test:integration   # full api real-DB suite, single-worker; do NOT wrap vitest in rtk`,
      ]
    : [
        `1. cd ${REPO} && pnpm --filter @customreport/api db:generate`,
        `2. cd ${REPO} && pnpm typecheck`,
        `3. cd ${REPO} && pnpm exec eslint --max-warnings 0 ${allFiles.map((f) => `'${f}'`).join(" ")}   # scoped lint; report as "lint"`,
        ...touchedWorkspaces.map(
          (ws, i) =>
            `${4 + i}. cd ${REPO} && pnpm --filter ${ws} test   # unit suite of touched workspace; fold into "unitTests"`,
        ),
        `${4 + touchedWorkspaces.length}. integration suite NOT run in fast tier — report integrationTests as "skip".`,
      ];
const gate = await agent(
  [
    `Run the ${GATE_TIER.toUpperCase()}-tier local quality gate for the uncommitted batch at ${REPO}. Each step a SEPARATE command (600s foreground cap). Do NOT edit code. Do NOT touch git. Report only.`,
    ...gateSteps,
    `For each step report pass|fail|skip; redFiles = failing files; summary = digest with precise error excerpts on any failure.`,
  ].join("\n"),
  {
    label: `gate:${GATE_TIER}`,
    phase: "Gate",
    model: "sonnet",
    effort: "medium",
    schema: GATE_SCHEMA,
  },
);

const gateGreen =
  gate &&
  gate.typecheck === "pass" &&
  gate.lint === "pass" &&
  gate.unitTests === "pass" &&
  (GATE_TIER === "full"
    ? gate.integrationTests === "pass"
    : gate.integrationTests !== "fail");

const isBlocking = (f) => f.severity === "blocker" || f.severity === "major";
const slices = lensResults.filter(Boolean).map((r) => ({
  slice: r.slice,
  verdict: r.verify ? r.verify.verdict : "lens-dead",
  blockers: r.verify ? (r.verify.findings || []).filter(isBlocking) : [],
  minors: r.verify
    ? (r.verify.findings || []).filter((f) => !isBlocking(f))
    : [],
}));

return {
  gateGreen,
  gate,
  slices,
  codex: codex
    ? { verdict: codex.verdict, findings: codex.findings || [] }
    : { verdict: "unavailable", findings: [] },
  commitReady:
    gateGreen &&
    codex &&
    slices.length === SLICES.length &&
    slices.every((s) => s.verdict !== "lens-dead" && s.blockers.length === 0) &&
    (codex.findings || []).filter(isBlocking).length === 0,
};
