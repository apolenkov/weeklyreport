# Backlog closeout — 2026-07-03 (autonomous, phone-only owner)

Goal: close ALL OpenSpec debts + tails, archive, on main. Ultracode + Workflows +
council/Codex review. Branch `impl/backlog-2026-06-30` (== main, FF); PUSHED
through `5e89484b`.

## DONE + pushed

- `ca0625c` refactor(auth) options-object createSessionCookie (adopted a dead
  session's clean uncommitted refactor).
- `b9aa328`/`5a33adb` tighten-comment-policy implemented + **ARCHIVED**.
- `88af723` docs(audit) — 2026-07-02 603-finding audit + fix-roadmap (reference;
  owner taste-verdict pending → NOT a green light to fix every row).
- `090c4c8` Q1/Q2/Q7 **LOCKED** by a full 3/3 owner-delegated council
  (docs/feedback/council-decisions-2026-07-02.md "RESOLVED 2026-07-03").
- **`f0a1528` activity-first-class EPIC** (55 files) + `cdf2b4a` (alarmFloor) +
  `bb9219d` (risk-dialog strip) + `5e89484` (followup doc). Fully green (typecheck
  - lint + 3221 unit + integration), LIVE-VERIFIED in-browser (head report renders
    activities as product-like cards w/ records + linked products + risk-derived
    status; dashboard Activities count). Backend + UI each adversarially reviewed by
    a Workflow (found + fixed: fillFromSection XOR-crash; activity-pill false-refuse;
    risk-dialog stage mislabel).

## activity-first-class — 4 DEFERRED review findings (NOT yet done)

See `openspec/changes/activity-first-class-reporting-unit/FOLLOWUP-REVIEW-2026-07-03.md`.
The change is IMPLEMENTED but NOT archived — archive is gated on these:

- #1 (HIGH) decision-edit-dialog: wire ParentPicker so a lead can author an
  activity-parented decision (mirror item/risk dialogs). Completes Decision 0.4.
- #5 (HIGH, rare) activity-only-period empty-state: `hasAnyContent` counts only
  product content → an all-activity report reads "No submissions yet" + can't
  publish. Fix respecting the submitted-filter + §7 draft-signal tests (a naive OR
  broke 23 weekly-report tests — reverted).
- #6/#7 (LOW) slide-pill ARIA list nesting; feedback-panel "Unknown" label.

## REMAINING backlog (sweeps, in order)

1. **observability-and-perf-hardening** — code already landed in `0e62e92d` (15/16
   tasks + tests); board 0/18 STALE. Before archive: reconcile tasks.md 3.2 (keyset
   cursor, not cursor+skip) + 3.3 (superseded by `4455edb1`, N+1 already gone, no
   deleteMany) → run gate → archive. NO code needed. CHEAPEST close.
2. **record-status-derived-from-risk** (Q2 LOCKED: Option A derive-only, pure
   overlay, enum-value removal DEFERRED). Item pill derives from covering risks;
   remove free blocked chip; re-source head badge (both consumers) + escalation
   REPLACE (skip null-projectId) ; heal legacy stored-blocked; reconcile spec.
   NOTE: shares files with #1 above (item-edit-dialog) — sequence together.
3. **lead-report-surface-polish §5-6** (Q5 carry-over auto-copy at ensureLeadSection;
   Q6 acknowledge split placement). Q7 = KEEP shipped float (no work). Then archive.
4. **agent-review-human-confirmed-gate** — review-mode split, move section-review
   strip to dashboard, agent-review affordance, human-confirmed gate (spec + FE;
   does NOT un-defer agent invocation).
5. **ci-deploy-supplychain-hardening** — CI enforce, frozen lockfile, API port 3001
   align, CSP enforce. CSP is high-stakes → live-verify the app doesn't break.
6. **tighten-code-quality-ratchet** — LAST (so all new code ≤250). eslint 300→250 +
   no-magic-literal; fix resulting violations. Fold in fix-roadmap ratchet rows.

## Env + gotchas (this session)

- The dev app is booted from source (`pnpm dev`, web:3000 api:3002) against the
  seeded `customreport_dev`. `customreport_test` was `migrate reset` to the new
  schema too. To reshape a DB use **`prisma migrate reset --force`** (from repo
  root, `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=1`) — NOT `db:reset:hard`
  (uses `migrate deploy`, skips the edited init) and NOT `db push`.
- **Prisma client keeps getting wiped** by pnpm ops (vitest, etc.) — regenerate
  (`pnpm --filter @customreport/api db:generate`) immediately before any tsc; the
  turbo `pnpm typecheck` self-heals. LSP diagnostics about `projectId: string`
  (non-null) or missing `projectActivityProduct` = stale client, not a real error.
- **pre-push blocks on PRE-EXISTING prettier drift** in ~14 unrelated files
  (openspec archive tasks, docs HTML, .claude skills). Not ours — push with
  `SKIP_PREPUSH=1` after running the full suite manually (`pnpm test`).
- **API "Response stalled mid-stream"** killed a fix subagent + degraded a council
  — delegation is flaky; do critical multi-layer fixes inline, keep agent prompts
  bounded, and adversarially verify via Workflow (that caught the real bugs).
- Codex lens in Workflows is SLOW (bottlenecks the verify barrier) but earns its
  keep (found the fillFromSection crash).
