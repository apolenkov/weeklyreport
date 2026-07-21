export const meta = {
  name: "all-green-wave2-s-slices",
  description:
    "Wave 2: remaining S-slices to the exemplary standard (5 disjoint lanes)",
  phases: [
    { title: "Plan", detail: "regrade live violations, write fix specs" },
    { title: "Implement", detail: "sonnet/opus/grok lanes, disjoint dirs" },
    { title: "Verify", detail: "2 adversarial Opus lenses (+Codex on auth)" },
  ],
};

const REPO = "/Users/wrk/work/customreport";
const CAMP =
  "/Users/wrk/work/customreport-archive/2026-07-18-all-green-campaign";

const GUARDRAILS = `GUARD-RAILS (violating any of these fails the wave):
- Behavior-preserving refactor ONLY: no feature/schema/API changes. Exception: a proven bug (confirmed by a failing test you add) may be fixed — document it.
- Public API of each module/slice stays UNCHANGED: do not move/rename/delete any symbol imported from outside your slice paths (check with rg before touching an export). Splits stay internal to the slice.
- No new unused exports: knip gates the push — every symbol you export must have an importer; keep extracted types/helpers module-local otherwise.
- Reject-list (ratified, do NOT do): &&->ternary rewrites, TODO purges, .js import extension changes, logging in deliberately-empty catches, mass magic-string extraction, blanket explicit return types.
- Standard target (docs/exemplary-code-standard.md): file < 250 lines, functions <= 50 lines, cognitive complexity < 10 via pure derive* helpers, zero let/reassign/in-place mutation in product code, no silent product-config fallbacks.
- Functional immutable style: const, pure functions, map/filter/reduce + spread.
- UI strings in apps/web/src/**/*.tsx stay ENGLISH. Comments: only non-obvious WHY, no change-log/ticket/phase refs.
- Do NOT split a function just to satisfy a counter — split along real responsibilities; if a split makes the code worse, leave it and report why.
- Do NOT touch eslint.config.ts unless an exemption entry covering your slice became fully obsolete; JUSTIFIED PERMANENT blocks always stay.
- Load-bearing invariants keep exact semantics: period dual-state writes, the 8 canonical role middleware-chain builders (reference identity), fail-closed session isActive checks.
- Do NOT run turbo/pnpm root commands (typecheck/lint/test) — the orchestrator runs gates. Targeted single-file tests only: cd apps/web (or apps/api) && pnpm exec vitest run <path>. Never wrap vitest in rtk. If TS errors mention a known Prisma model, run pnpm --filter @customreport/api db:generate once.
- Test edits: never weaken an assertion to fit a refactor; if you move a file, rg the old path repo-wide including vi.mock strings and update every reference.
- Do not use any advisor tool.
- Seed minors in ${CAMP}/inventory-seed.json date from 2026-07-17 — re-verify each against current code before acting; skip stale and rejected-class ones.
- Slice inventory (oversize/longFn/mutation lists): your slice's entry in ${CAMP}/phase0-inventory.json.`;

const SLICES = [
  {
    id: "w2-web-shared-lib",
    model: "sonnet",
    app: "apps/web",
    paths: ["apps/web/src/shared", "apps/web/src/lib"],
    brief:
      "Two small web slices in one lane (67 files): shared/ has 2 oversize + 2 long functions + 1 mutation hotspot + 2 exemptions to examine, lib/ has 2 long functions + 1 mutation hotspot. ~61 seed minors across both — mostly test-coverage pins; re-verify each.",
  },
  {
    id: "w2-api-lib",
    model: "sonnet",
    app: "apps/api",
    paths: ["apps/api/src/lib", "apps/api/src/test-utils"],
    brief:
      "20 files: 5 oversize, 1 long function, 2 mutation hotspots, 2 exemptions to examine, ~14 seed minors.",
  },
  {
    id: "w2-api-auth-admin",
    model: "opus",
    app: "apps/api",
    paths: ["apps/api/src/modules/auth", "apps/api/src/modules/admin"],
    brief:
      "LOAD-BEARING slice (auth: sessions, dev-login, role guards; admin: user/group management). 34 files: 8 oversize, 5 long functions, 1 mutation hotspot, ~42 seed minors. Auth semantics must not shift a millimeter: fail-closed isActive session checks, dev-login refusal under NODE_ENV=production, canonical role middleware-chain builders untouched in behavior. Prefer smaller, surgical splits here; when a split risks auth semantics, leave it and report.",
  },
  {
    id: "w2-api-report-pub-search",
    model: "sonnet",
    app: "apps/api",
    paths: [
      "apps/api/src/modules/weekly-report",
      "apps/api/src/modules/publication",
      "apps/api/src/modules/search",
    ],
    brief:
      "19 files: 2 long functions, 2 mutation hotspots, 4 exemptions to examine, ~27 seed minors. Search must keep the snapshot-read parity rule: the viewer published read serves a frozen snapshot; live-row search must not leak hidden content — do not alter query semantics.",
  },
  {
    id: "w2-api-analytics-activity-obs",
    agentType: "grok-implementer",
    model: "sonnet",
    app: "apps/api",
    paths: [
      "apps/api/src/modules/analytics",
      "apps/api/src/modules/activity",
      "apps/api/src/modules/project-activity",
      "apps/api/src/modules/observability",
      "apps/api/src/modules/telemetry",
      "apps/api/src/modules/organization",
      "apps/api/src/modules/pdf-export",
    ],
    brief: "36 files, mostly clean: 1 oversize, ~26 seed minors. Routine lane.",
  },
];

const PLAN_SCHEMA = {
  type: "object",
  required: ["slice", "items", "skipped", "notes"],
  properties: {
    slice: { type: "string" },
    items: {
      type: "array",
      maxItems: 50,
      items: {
        type: "object",
        required: ["file", "action"],
        properties: {
          file: { type: "string" },
          action: { type: "string", maxLength: 500 },
        },
      },
    },
    skipped: {
      type: "array",
      maxItems: 50,
      items: {
        type: "object",
        required: ["what", "why"],
        properties: {
          what: { type: "string" },
          why: { type: "string", maxLength: 200 },
        },
      },
    },
    notes: { type: "string", maxLength: 800 },
  },
};

const IMPL_SCHEMA = {
  type: "object",
  required: ["slice", "filesTouched", "testsRun", "deviations", "notes"],
  properties: {
    slice: { type: "string" },
    filesTouched: { type: "array", maxItems: 80, items: { type: "string" } },
    testsRun: {
      type: "array",
      maxItems: 30,
      items: {
        type: "object",
        required: ["cmd", "exit"],
        properties: { cmd: { type: "string" }, exit: { type: "number" } },
      },
    },
    deviations: {
      type: "array",
      maxItems: 20,
      items: { type: "string", maxLength: 300 },
    },
    notes: { type: "string", maxLength: 900 },
  },
};

const VERDICT_SCHEMA = {
  type: "object",
  required: ["lens", "verdict", "findings"],
  properties: {
    lens: { type: "string" },
    verdict: { type: "string", enum: ["pass", "fail"] },
    findings: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        required: ["file", "severity", "issue"],
        properties: {
          file: { type: "string" },
          severity: { type: "string", enum: ["blocker", "major", "minor"] },
          issue: { type: "string", maxLength: 400 },
        },
      },
    },
  },
};

const results = await pipeline(
  SLICES,
  (s) =>
    agent(
      `READ-ONLY planning task. Repo: ${REPO}. Slice ${s.id}: ${s.paths.join(", ")}.\n${s.brief}\n\n${GUARDRAILS}\n\nProduce a concrete fix plan: per file, exactly what to do (splits with new unit names and responsibilities, mutation removals, test pins to add). List what you examined and SKIPPED with why (stale finding, rejected class, PERM exemption, split-would-degrade, public-API risk). Do NOT edit anything.`,
      {
        label: `plan:${s.id}`,
        phase: "Plan",
        model: s.model === "opus" ? "opus" : "sonnet",
        schema: PLAN_SCHEMA,
      },
    ),
  (plan, s) => {
    const prompt = `IMPLEMENTATION task. Repo: ${REPO}. Slice ${s.id}: you may edit ONLY files under ${s.paths.join(", ")} (plus new files inside the slice, and vi.mock/import path updates in files referencing anything you move — but you must NOT move externally-imported symbols at all).\n${s.brief}\n\n${GUARDRAILS}\n\nExecute this reviewed plan (deviate only with a logged reason in "deviations"):\n${JSON.stringify(plan, null, 1)}\n\nAfter editing, run the slice's own test files targeted (cd ${s.app} && pnpm exec vitest run <path>) and record real exit codes. Do not run repo-wide gates.`;
    return s.agentType
      ? agent(prompt, {
          label: `impl:${s.id}`,
          phase: "Implement",
          agentType: s.agentType,
          model: s.model,
          schema: IMPL_SCHEMA,
        })
      : agent(prompt, {
          label: `impl:${s.id}`,
          phase: "Implement",
          model: s.model,
          schema: IMPL_SCHEMA,
        });
  },
  (impl, s) => {
    const diffCmd = `/usr/bin/git -C ${REPO} diff -- ${s.paths.join(" ")}`;
    const verifiers = [
      () =>
        agent(
          `ADVERSARIAL REVIEW, lens = behavior-preservation & test-integrity. Repo: ${REPO}. Review the uncommitted diff for slice ${s.id}: run ${diffCmd} (plus /usr/bin/git -C ${REPO} status --porcelain to catch new files; read new files in full). Implementer's claim: ${JSON.stringify(impl)}.\nHunt for: behavior changes smuggled into refactors; weakened/deleted assertions (read the TEST diff first); moved files whose old paths are still referenced (rg old basenames repo-wide incl. vi.mock strings); dropped side effects; changed query/authz semantics; new exported symbols with no importer (knip will fail the push). Verdict fail on any blocker/major. READ-ONLY. No advisor tool.`,
          {
            label: `verify-behavior:${s.id}`,
            phase: "Verify",
            model: "opus",
            schema: VERDICT_SCHEMA,
          },
        ),
      () =>
        agent(
          `ADVERSARIAL REVIEW, lens = standard-gaming & code quality. Repo: ${REPO}. Review the uncommitted diff for slice ${s.id}: run ${diffCmd} and read every NEW file in full. Implementer's claim: ${JSON.stringify(impl)}.\nHunt for: splits made only to satisfy counters (fragments without own responsibility, prop-drilling explosions, "part 2" helper files); naming that hides; new mutation/let; narrating comments; non-English UI strings; reject-list violations. The campaign FAILS if code gets worse while counters improve — that is your primary target. Verdict fail on any blocker/major. READ-ONLY. No advisor tool.`,
          {
            label: `verify-quality:${s.id}`,
            phase: "Verify",
            model: "opus",
            schema: VERDICT_SCHEMA,
          },
        ),
    ];
    if (s.id === "w2-api-auth-admin") {
      verifiers.push(() =>
        agent(
          `Run a skeptical code review of the uncommitted git diff in ${REPO} restricted to paths: ${s.paths.join(" ")} (use: ${diffCmd}). Context: behavior-preserving refactor of the auth and admin NestJS modules toward a strict code standard; auth semantics (fail-closed session isActive checks, dev-login production refusal, canonical role middleware-chain builders) must be byte-for-byte equivalent in behavior. Report concrete findings with file:line and severity (blocker/major/minor); do not approve — find problems. Finish with verdict pass or fail (fail on any blocker/major).`,
          {
            label: `verify-codex:${s.id}`,
            phase: "Verify",
            agentType: "codex:codex-rescue",
            model: "sonnet",
            schema: VERDICT_SCHEMA,
          },
        ),
      );
    }
    return parallel(verifiers).then((v) => ({
      impl,
      verdicts: v.filter(Boolean),
    }));
  },
);

const ok = results.filter(Boolean);
log(`wave2 done: ${ok.length}/${SLICES.length} lanes through`);
return {
  slices: ok,
  failed: SLICES.filter((s, i) => !results[i]).map((s) => s.id),
};
