export const meta = {
  name: "backlog-triage",
  description:
    "Read-only triage of the 36 OpenSpec backlog changes → conflict-aware implementation plan",
  phases: [
    { title: "Triage", detail: "one read-only agent per change" },
    {
      title: "Synthesize",
      detail: "ordered plan + conflict groups + calibration candidate",
    },
  ],
};

// Embedded work-list (args do not thread via scriptPath here). Wave from
// docs/IMPLEMENTATION-ROADMAP.md (A=P0 blockers → D=P2/P3 hygiene; ratchet last).
const CHANGES = [
  { name: "set-express-trust-proxy", wave: "A" },
  { name: "route-pdfs-and-authz", wave: "A" },
  { name: "fix-prod-web-build-args", wave: "A" },
  { name: "guard-autopublish-archived", wave: "A" },
  { name: "fix-carryover-persistence", wave: "A" },
  { name: "add-section-optimistic-lock", wave: "A" },
  { name: "scope-analytics-to-group", wave: "A" },
  { name: "scope-leadform-revoke-authz", wave: "A" },
  { name: "fix-open-redirect-next-param", wave: "A" },
  { name: "escape-org-data-script", wave: "A" },
  { name: "scope-period-lifecycle-authz", wave: "B" },
  { name: "scope-reminder-authz", wave: "B" },
  { name: "enforce-deactivation-pdf-bullboard", wave: "B" },
  { name: "make-publish-atomic", wave: "B" },
  { name: "transactional-snapshot-restore", wave: "B" },
  { name: "period-uniqueness-db-constraint", wave: "B" },
  { name: "scope-leadform-getbyperiod", wave: "B" },
  { name: "map-domain-errors", wave: "B" },
  { name: "fix-analytics-date-matching", wave: "C" },
  { name: "fix-reminders-escalation-dedupe", wave: "C" },
  { name: "harden-web-vitals-endpoint", wave: "C" },
  { name: "protect-metrics-endpoint", wave: "C" },
  { name: "guard-metrics-scrape-db-failure", wave: "C" },
  { name: "fix-period-datetime-tz", wave: "C" },
  { name: "fix-risk-stage-integrity-impl", wave: "C" },
  { name: "key-charts-by-id", wave: "C" },
  { name: "fix-dashboard-nan-pending", wave: "C" },
  { name: "fix-heap-health-threshold", wave: "C" },
  { name: "enforce-smtp-config", wave: "C" },
  { name: "serialize-autosave", wave: "C" },
  { name: "observe-prisma-pool", wave: "C" },
  { name: "ci-deploy-supplychain-hardening", wave: "D" },
  { name: "observability-and-perf-hardening", wave: "D" },
  { name: "code-health-and-test-cleanup", wave: "D" },
  { name: "input-and-error-hardening", wave: "D" },
  { name: "tighten-code-quality-ratchet", wave: "ratchet" },
];

const TRIAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "name",
    "wave",
    "validity",
    "validityReason",
    "filesTouched",
    "touchesSchema",
    "touchesSharedGodFiles",
    "touchesAuthMiddleware",
    "highStakes",
    "riskNotes",
    "sizeTasks",
    "sizeEstimate",
    "dependsOn",
    "summary",
  ],
  properties: {
    name: { type: "string" },
    wave: { type: "string" },
    validity: {
      type: "string",
      enum: ["valid", "already-done", "partially-done", "obsolete", "unclear"],
    },
    validityReason: { type: "string" },
    filesTouched: { type: "array", items: { type: "string" } },
    touchesSchema: { type: "boolean" },
    touchesSharedGodFiles: { type: "boolean" },
    touchesAuthMiddleware: { type: "boolean" },
    highStakes: { type: "boolean" },
    riskNotes: { type: "string" },
    sizeTasks: { type: "integer" },
    sizeEstimate: { type: "string", enum: ["small", "medium", "large"] },
    dependsOn: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
  },
};

const SYNTH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "implementationOrder",
    "parallelGroups",
    "schemaTouchers",
    "sharedGodFileTouchers",
    "authMiddlewareTouchers",
    "calibrationCandidate",
    "obsoleteOrDone",
    "highStakesNeedingPlanReview",
    "notes",
  ],
  properties: {
    // change names in recommended implementation order (respect deps + waves)
    implementationOrder: { type: "array", items: { type: "string" } },
    // groups of changes whose file sets are disjoint → safe to implement in parallel
    parallelGroups: {
      type: "array",
      items: { type: "array", items: { type: "string" } },
    },
    schemaTouchers: { type: "array", items: { type: "string" } },
    sharedGodFileTouchers: { type: "array", items: { type: "string" } },
    authMiddlewareTouchers: { type: "array", items: { type: "string" } },
    calibrationCandidate: { type: "string" },
    obsoleteOrDone: { type: "array", items: { type: "string" } },
    highStakesNeedingPlanReview: { type: "array", items: { type: "string" } },
    notes: { type: "string" },
  },
};

const triagePrompt = (
  c,
) => `You are triaging ONE OpenSpec change in the CustomReport monorepo
(pnpm+turbo: apps/api = NestJS 11 / tRPC 11 / Prisma 7; apps/web = Next 16 / React 19;
packages/shared = Zod + tRPC contracts; prisma/ = schema + a single init migration).

RECENT base-branch refactors you MUST check this change against — they may have already
done or obsoleted part of it:
- cd4346bb refactor(config): apps/api env is now STRICT — no defaults, no in-code
  fallbacks; required vars read via requireEnv; boot fails loud on a missing var.
- a9f43e35 refactor(auth): dev-login split into a dev-only module; localhost fallback dropped.

Change to triage: "${c.name}"  (roadmap wave ${c.wave}).

Steps:
1. Read what exists under openspec/changes/${c.name}/ : proposal.md, design.md, tasks.md,
   and specs/**/spec.md.
2. From tasks.md + design.md, list the concrete repo files this change CREATES or MODIFIES
   (real paths). Verify several against the ACTUAL code with grep/read — do not just trust
   the spec text.
3. validity: is the fix ALREADY in current code (already-done / partially-done), moot given
   the recent refactors above (obsolete), still needed (valid), or undeterminable (unclear)?
   Give a one-line validityReason grounded in code you looked at.
4. Flags (verify against code, not just the spec):
   - touchesSchema: edits prisma/schema.prisma or a migration?
   - touchesSharedGodFiles: edits apps/api/src/infrastructure/trpc/trpc.router.ts or trpc.middleware.ts?
   - touchesAuthMiddleware: adds/changes a tRPC procedure's middleware chain (the 9 canonical chain builders)?
   - highStakes: auth / schema / concurrency / migration / money.
5. sizeTasks = number of checkbox items in tasks.md. sizeEstimate small/medium/large.
6. dependsOn = other change names that must land before this (shared file, or builds on their fix). [] if none.
7. summary = 1-2 lines: what it fixes + the core implementation move.

Read-only — do not edit anything. Return ONLY the structured object.`;

const synthPrompt = (
  rows,
) => `You are the planning synthesizer for an overnight, quality-first
implementation run of the CustomReport OpenSpec backlog. main is FROZEN (demo tomorrow); every
change will be implemented on its own branch, gated + verified, and STAGED for a human morning
merge. Edits are serialized and every diff is read; only changes with provably DISJOINT file sets
may be implemented in parallel; anything touching prisma schema, the shared tRPC god-files
(trpc.router.ts / trpc.middleware.ts), or auth middleware chains MUST be serialized.

Here is the per-change triage data (JSON array):
${JSON.stringify(rows)}

Produce a conflict-aware plan:
- implementationOrder: all still-relevant changes (drop obsolete/already-done) in the order to
  implement them. Respect wave priority (A→B→C→D→ratchet), dependsOn, and put a small
  self-contained low-risk P0 (no schema, no auth-middleware) FIRST as the calibration change.
- parallelGroups: arrays of change names whose filesTouched are mutually disjoint AND none touch
  schema/shared-god-files/auth-middleware — i.e. safe to run concurrently. Keep groups small and
  conservative; when unsure, leave a change out (it gets serialized).
- schemaTouchers / sharedGodFileTouchers / authMiddlewareTouchers: names flagged for those, for serialization.
- calibrationCandidate: the single best first change (small, P0, no schema, no auth-middleware).
- obsoleteOrDone: names to skip, each is fine to omit from order.
- highStakesNeedingPlanReview: high-stakes ones worth a /codex-review on the plan before coding.
- notes: cross-cutting risks, dependency clusters, anything the orchestrator must know.

Return ONLY the structured object.`;

phase("Triage");
const triaged = await parallel(
  CHANGES.map(
    (c) => () =>
      agent(triagePrompt(c), {
        label: c.name,
        phase: "Triage",
        schema: TRIAGE_SCHEMA,
      }),
  ),
);
const valid = triaged.filter(Boolean);
log(`triaged ${valid.length}/${CHANGES.length} changes`);

phase("Synthesize");
const synthesis = await agent(synthPrompt(valid), {
  label: "synthesize-plan",
  phase: "Synthesize",
  schema: SYNTH_SCHEMA,
});

return { triaged: valid, synthesis };
