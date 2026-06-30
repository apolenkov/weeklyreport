# RESUME after restart — autonomous backlog marathon (2026-07-01)

Repo `/Users/wrk/work/customreport`, branch **`impl/backlog-2026-06-30`** (NOT main —
main is FROZEN). User **Саша** — reply in Russian, terse/scannable (point first, no
jargon), peer. MVP phase: commit+push to THIS branch pre-authorized. **Ultracode ON** —
drive substantive work through the Workflow harnesses.

**Mandate:** autonomously implement the ENTIRE remaining OpenSpec backlog through the
Workflow harnesses, keeping the orchestrator session thin. This session paused at a
clean checkpoint to let Саша restart Claude Code onto a new client/model. Resume here.

## State at pause

- **#1 `fix-manual-publish-archive-race` — COMMITTED `259f488d`.** (the deferred
  harden-head-lifecycle collapsed to this: `archived:false` in both manual publish
  predicates + zero-row raced/archived discriminator + #14 reopened-bypass close. NO new
  archive authz — Саша declined it; head is trusted, walk-back is an accepted risk. See
  memory `head-lifecycle-authz-expansion-declined`.)
  - Follow-up (minor, M2 from the plan review): the publication non-tx zero-row re-read
    treats any non-published state as `archived` → fail-closed FORBIDDEN (safe), but the
    message is imprecise on an archive+unarchive triple-race. Refine if revisited.
- Nothing else uncommitted except this handoff + the harness tooling (being committed now).
- No background workflow running at pause.

## Queue (drive in THIS order)

1. **Batch C — ARMED in `.claude/workflows/waveb-batch.js`** (8 seam-disjoint low-stakes
   changes: fix-analytics-date-matching, fix-reminders-escalation-dedupe,
   harden-web-vitals-endpoint, guard-metrics-scrape-db-failure, fix-period-datetime-tz,
   fix-risk-stage-integrity-impl, key-charts-by-id, fix-dashboard-nan-pending). Launch:
   `Workflow({scriptPath:".claude/workflows/waveb-batch.js"})`. It runs 8 parallel
   edit-only agents → ONE combined gate → per-change verify+Codex → commits each green
   change. (protect-metrics-endpoint is EXCLUDED here — folded into Wave D #32.)
2. **strict-env trio — config `docs/handoff/marathon-configs/strict-env-trio-config.md`**.
   HIGH-stakes, ONE-AT-A-TIME, order **#29 enforce-smtp-config → #30 fix-heap-health-threshold
   → #31 observe-prisma-pool** (share env.schema.ts + the ENV_CONFIG token #29 creates).
   Load each into `waveb-autorun.js` CHANGES, run, commit, next.
3. **Wave D — config `docs/handoff/marathon-configs/wave-d-config.md`**. HIGH-stakes,
   one-at-a-time, order **#32 → #33 → #35 → #34 → #36**. #32 folds in protect-metrics
   (two commits A→B). #33↔#34 collide on weekly-report.prisma-repository.ts (serialize).
   **#34 is the SCHEMA change**: after its schema.prisma + migration.sql edits land, the
   ORCHESTRATOR (not the workflow) runs `prisma migrate reset` on customreport_test AND
   \_dev (PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION), reseeds, db:generate. Land #35
   (seeds) before #34's reset. #36 is PLAN-ONLY (codeless — just validate+commit the spec).
4. **Feature specs C1-C7** (net-new, after the core). Memory
   `feature-specs-c1-c7-implementation-order`: C1/C3/C4/C5/C6 ready; C2 needs a durable
   record-id prerequisite FIRST (saveSection delete-recreates — memory
   `records-have-no-stable-id-saveSection-recreates`); C7 BLOCKED on two Саша decisions;
   C6 after batch-C's fix-risk-stage-integrity-impl.

## How to drive the harnesses

- **waveb-batch.js** (low-stakes batch): edit the `GROUP` array, launch by scriptPath.
  Parallel edit-only implement (no toolchain) → single gate → fan-out verify/Codex →
  commits each fully-green change by its exact declared paths. Plan-reviewed SOUND; two
  fixes already applied (preflight matches commit-subject not just name; redFiles
  attribution is path-boundary not substring).
- **waveb-autorun.js** (high-stakes, one change): edit the single-element `CHANGES`,
  launch. Returns `commitReady` for high-stakes → ORCHESTRATOR reads `git diff HEAD` +
  commits. Re-launch on an already-implemented tree needs `skipImplement:true`.
- **Toolchain serialization (hard rule):** NEVER run two full gates concurrently
  (concurrent `prisma generate` corrupts the shared .prisma client; pnpm/turbo share
  global state). Launch the next workflow only after the prior one's gate is done +
  committed. Parallelism is WITHIN a workflow (the batch's edit-only agents), never two
  gate-running workflows at once.

## Env / runtime facts

- Test DB `customreport_test` up (`docker exec customreport-postgres-1 psql -U customreport`).
- FULL gate, each step separate (600s bash ceiling): `pnpm --filter @customreport/api
db:generate` → `pnpm typecheck` → `pnpm lint` → `pnpm test` (unit) →
  `pnpm --filter @customreport/api test:integration` (loads .env.test; do NOT wrap vitest in rtk).
- `openspec validate <name> --strict` before each high-stakes commit.
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Codex review via Agent `agentType: "codex:codex-rescue"`. Both harnesses now set
  `model: "sonnet"` on the codex-review agent so it runs on the CURRENT Sonnet (Sonnet 5
  on the updated client) instead of the agentType's default Sonnet 4.6. **Verify on the
  first run:** check the workflow journal's `model` field for the `codex:*` agent — if it
  still shows `claude-sonnet-4-6`, the codex-rescue agentType pins its model in the plugin
  definition and the opts.model override did not take (needs a plugin-level change, not a
  harness one).
- Prefix recognized tools with `rtk` (token filter); NOT vitest (mis-parses TSX).

## Parallel session (coordinate via git, not a channel)

A second Claude session AUTHORS the feature specs (writes openspec/ + docs/ only); THIS
session IMPLEMENTS (apps/ code) — disjoint file domains. Memory
`parallel-author-session-coordination` (its id `e522514d-9319-46f1-9446-a7a580ed9aee`).
Implement a feature spec only once its dir is committed and settled. A restart of the
client may or may not affect the neighbor session — git is the durable substrate either way.

## Key memories to recall

`head-lifecycle-authz-expansion-declined`, `feature-specs-c1-c7-implementation-order`,
`records-have-no-stable-id-saveSection-recreates`, `parallel-author-session-coordination`,
`autonomous-backlog-workflow-harness`, `prisma-pg-adapter-p2002-shape`,
`integration-mock-port-drift-gate`, `customreport-strict-lint-gotchas`.
