# Handoff — autonomous OpenSpec backlog, Wave B done → Wave C (2026-06-30)

Repo `/Users/wrk/work/customreport` (remote `apolenkov/yourpulse`). User **Саша** —
reply in Russian, peer, no fluff. MVP phase: commit+push to branch
`impl/backlog-2026-06-30` is pre-authorized (NOT `main`, which is FROZEN).
**Ultracode is ON** — drive substantive work through the Workflow harness; token
cost is not a constraint.

**Mandate (Саша):** drive the ENTIRE remaining OpenSpec backlog to the end
AUTONOMOUSLY, everything through the Workflow harness so the orchestrator session
stays thin. The previous session ran Wave B remainder and hit ~600k context, so
**#20 onward continues in THIS fresh session from here.**

## Landed (branch impl/backlog-2026-06-30)

- **#16 make-publish-atomic** `c5627d4e` — idempotent compare-and-set publish
  (updateMany WHERE periodStatus!=published) + DB-resolved review target via
  getCurrentEditableId. Archive-during-publish race DEFERRED to harden-head-lifecycle.
- **#17 enforce-deactivation-pdf-bullboard** `89da710d` — shared isUserAccessBarred
  (Redis fail-open → Prisma isActive fail-closed, null row barred), folded into #7's
  resolveHumanSession + buildPdfExportSession + bull-board guard (async, DI via \_app.get).
- **#18 scope-leadform-getbyperiod** `4cb591e9` — cross-author getByPeriod scoped to
  shared non-archived products (own-section precheck first; mirrors getCrossAuthorContent
  incl. DROPPING null-productId decisions); removed dead hasSharedProduct.
- **#19 transactional-snapshot-restore** `4455edb1` — admin snapshot restore wrapped in
  one interactive prisma.$transaction (helpers widened to Prisma.TransactionClient,
  applicator post-commit); destructive whole-snapshot reconcile replaced with targeted
  entity-level upsert/remove (new admin-entity-write.queries.ts); additive-only restore.
  8 real-DB tests (rollback, concurrent-insert, additive-only, period isolation).
- Integration-baseline fixes earlier this session: `4a83f6de` + `73d9e220` (#11 debt, green).
- Harness commits: `9aab153a`, `d6f0f60a`, `8b80fee8` (+ a PARALLEL_GLOBS tweak with this doc).
- **PARALLEL SESSION** is committing to this SAME branch (docs/feedback/, CONTEXT.md,
  openspec/changes/fix-slide-priority-ordering/, e.g. `3ffdc70e`) — NOT ours. Stay
  disjoint: commit only your change's explicit files.

## THE HARNESS — `.claude/workflows/waveb-autorun.js` (committed, durable)

Drive each change: edit the single-element `CHANGES` array (name, stakes,
spec:{dir:true}|{inline:"…"}, seam, caveat, mustCover[], reachability, regression,
integrationTargets, commitSubject[, skipImplement]), then `Workflow({scriptPath:
".../waveb-autorun.js"})`. Per-change cycle: preflight (git-resume skip if already
committed) → implement(high) → git-scope agent (changedFiles from `git status`, NOT
the implement agent — it stubs its file list) → 2 adversarial verifiers → FULL gate +
integration → Codex (agentType codex:codex-rescue) → commit-by-stakes.

- **stakes:"low"** → workflow auto-commits.
- **stakes:"high"** (authz/concurrency/data/env) → returns `await-orchestrator-commit`;
  YOU read `git diff HEAD` and commit. Every real bug this session was caught at this
  human-review step — keep it for high-stakes.
- **skipImplement:true** → re-verify an already-on-tree change (after a fix or a
  crash/transient-API park) without redoing it.
- Parallel work auto-excluded from changedFiles via PARALLEL_GLOBS (docs/, CONTEXT.md,
  AGENTS.md, openspec/) + .claude/. If a change legitimately touches one of those, adjust.

**Proven high-stakes recovery loop:** implement → review catches a REAL in-scope bug →
focused fix Agent (general-purpose, run_in_background, precise, touch only the change's
files) → re-verify via skipImplement (or full gate + a focused codex:codex-rescue Agent)
→ orchestrator commits. EVERY Wave B high-stakes change needed exactly one such round.

### Hard-won lessons (also memory `autonomous-backlog-workflow-harness`)

- Derive changedFiles from git, not the implement agent (it stubs "a","b","c").
- Verify/Codex diff scoped to `git diff HEAD` + the change's files (NOT BASE = whole branch).
- SCOPE-DISCIPLINE = loop-termination: a finding OUTSIDE the change's design.md
  Goals/Non-Goals (a different concurrency pair, an untouched sibling, a pre-existing
  issue) is a FOLLOW-UP, not a blocker — else high-stakes changes spiral 3-4 rounds.
- A finding can REVERSE on the next pass (#18 keep-vs-drop null-productId decisions). The
  SIBLING code + the proposal text are the tiebreaker — check them BEFORE acting on one
  reviewer's framing. (#18: getCrossAuthorContent drops null-productId, proposal says
  "mirror" it → DROP.)
- `<new-diagnostics>` during a workflow run = stale .prisma client (agents wipe it via
  pnpm ops) → phantom version/import/arg errors. IGNORE; the workflow gate (db:generate
  → tsc) is authoritative. Locally regenerate before YOUR typecheck:
  `pnpm --filter @customreport/api db:generate`.

## NEXT (synthesis order; full list in docs/handoff/OVERNIGHT-2026-06-30.md)

1. **harden-head-lifecycle-mutation-authz** — NEW change, AUTHOR it (openspec-new-change).
   **BREAK AUTONOMY: security-policy fork.** Consolidates head/admin mutations with no
   active-target/scope guard. Items (details in OVERNIGHT-2026-06-30.md §Session 3 +
   below): archiveReport/unarchiveReport (trpc.router ~1791/1807), review.publish (~707),
   MAJOR#2 (publishPeriod reopened skips active-target), the #14 archive-walk-back, AND
   the **#16 manual-publish archive race** (both publish paths' updateMany predicate keys
   on periodStatus only, not archived; archiving sets archived=true + periodState=archived
   but leaves periodStatus open → an archive in the read→write window publishes an archived
   row). Design WITH the sibling guard-autopublish-archived (#5) pattern; for the manual
   path also distinguish the count===0 causes (concurrent-publish-won → idempotent success;
   archived-in-window → a domain error, not silent success). Conservative time-frontier
   guard + negative test (fails on revert) + verifier hunts a legit-flow brick; on a brick
   or real policy fork → park + ONE AskUserQuestion to Саша. Do NOT auto-commit a guess.
2. **Wave C (#20-31)** — mostly LOW-stakes (BATCH several into one CHANGES run, auto-commit,
   review the ledger once): fix-analytics-date-matching, fix-reminders-escalation-dedupe,
   harden-web-vitals-endpoint, protect-metrics-endpoint, guard-metrics-scrape-db-failure,
   fix-period-datetime-tz, fix-risk-stage-integrity-impl, key-charts-by-id,
   fix-dashboard-nan-pending. HIGH-stakes individual: the STRICT-ENV TRIO —
   **#29 enforce-smtp-config, #30 fix-heap-health-threshold, #31 observe-prisma-pool**:
   their design.md propose `.default()`/in-code fallbacks that VIOLATE the no-fallback
   standard — the harness STANDARDS block already says "standard overrides design;
   requireEnv + compose ${VAR:?}". #29 must EXPORT its ConfigModule so #30 reuses it.
   Respect serialization seams (OVERNIGHT-2026-06-30.md / NIGHT-PLAYBOOK).
3. **Wave D (#32-36)** — #32 ci-deploy-supplychain-hardening (closes API host-port; deploy-time,
   flag). #33 observability-and-perf-hardening (DROP its task 3.3 — obsoleted by #19). #34
   code-health-and-test-cleanup (SCHEMA: init-migration hand-edit, serialize with #11 —
   ORCHESTRATOR runs migrate reset on \_test, workflow does NOT). #35 input-and-error-hardening
   (PARTIAL: items 4 + 9 already shipped — skip). #36 tighten-code-quality-ratchet — LAST.

## Open follow-ups (fold into changes at the right time)

- **harden-head-lifecycle-mutation-authz** — #1 above (the consolidated authz/race change).
- #17 minor: isUserAccessBarred bars on `isActive === false`; fail-closed on null should
  User.isActive ever become nullable.
- #18 minor: empty-shared-set fallback reads the caller's own section twice (dedupe).
- #19 minors: removeProject uses update (P2025 on absent id) vs siblings' deleteMany —
  switch to updateMany for parity; $transaction has no explicit timeout (5s default) —
  size one if a bulk-import caller is ever wired (saveSnapshot has no production caller).

## Env / runtime facts

- Test DB `customreport_test` up (`docker exec customreport-postgres-1 psql -U customreport`);
  integration runner `pnpm --filter @customreport/api test:integration` (loads .env.test;
  do NOT wrap vitest in rtk).
- FULL gate (high-stakes pre-commit), each step separately (600s bash ceiling):
  `pnpm --filter @customreport/api db:generate` → `pnpm typecheck` → `pnpm lint` →
  `pnpm test` (unit, excludes \*.integration) → `pnpm --filter @customreport/api test:integration`.
- `openspec validate <name> --strict` before each high-stakes commit.
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Wave B/C SCHEMA-FREE (no migrate-reset). Only #34 needs a \_test reset (orchestrator).
- Codex via Agent agentType `codex:codex-rescue`. Skills: waveb-autorun, gates,
  openspec-new-change/openspec-propose, codex:codex-rescue, openspec-archive-change (merge time).
