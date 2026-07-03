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

## activity-first-class EPIC — DONE + ARCHIVED + PUSHED (2026-07-03, through `d3b119d4`)

All 4 deferred findings resolved and the change ARCHIVED
(`openspec/changes/archive/2026-07-03-activity-first-class-reporting-unit/`);
specs synced (activity-reporting-unit created + 3 modified). Commits:
`67308f2` (#1 decision-authoring parity + #6 slide-pill ARIA + #7 feedback
label; shared `resolveRecordParent`/`RecordStageStep` extracted; decision dialog
added to max-lines exempt — parity with item/risk), `be747de` (#5 Gate 1
empty-state fold), `5a50850` (3 HIGH fixes from the completion review), `d3b119d`
(archive). A 5-lens adversarial Workflow over the completion diff caught 3 HIGH
regressions — ALL fixed + re-verified (full web suite 1483 green):

- `handleDecisionsChange` dropped `activityId` (no parity w/ item/risk handlers)
  → activity decision saved parent-less → XOR-reject whole save. Fixed.
- `sectionHasActivityContent` gated on `status != null` but seeding defaults
  green → collapsed to `activities.length>0`, killing the empty-state. Fixed to
  gate on a real touch signal (alarm/note/owned-record) + negative test.
- `mapLeadReviewFeedback` (#7) deref `section.activities` unguarded → a partial
  test fixture crashed 2 tests (red tree). Fixed the fixture + label test.
  DEFERRED (documented, NOT archive-blocking): Gate 2 — the draft-signal
  (`draftCount`) fold for the doubly-rare activity-only-DRAFT-under-submitted-only
  view. A separate tiny follow-up (touching `draftCount`/`mapWeeklyReportLeadGroups`
  is where the 23-test break lived).

## REMAINING backlog (sweeps, in order) — 5 changes left on the board

DONE since this doc was written: observability-and-perf-hardening (archived
`bd76472b`); activity-first-class epic (archived `d3b119d4`, see above).

1. **record-status-derived-from-risk** — IN PROGRESS. Q2 LOCKED: Option A
   derive-only, PURE OVERLAY, enum-VALUE removal DEFERRED (near-moot under
   disposable-DB MVP). §2 is the next concrete step. NOTE: §2 onward is a COUPLED
   atomic change (item-card + dialog/quick-add reversal + backend write invariant
   - migration + backfill + escalation) — it must land together; do NOT half-land
     (design rejects the "muddy middle": stored blocked + floored display).
     Scope (from `openspec/changes/record-status-derived-from-risk/{proposal,design,tasks}.md`):
   * §1 **DONE** (`a8aaf9e`): shared helper `deriveItemAlarmFromRisks` landed in
     `apps/web/src/lib/item-alarm.ts` (the true sibling of
     `deriveEffectiveStageStatus` in `lib/stage-status.ts`; the spec's
     "lead-form.ts" ref was off) + 12 unit tests. Pure, unused-until-§2.
     Coverage rule (design Decision 1):
     covered iff SAME reportSectionId + SAME product (`Item.projectId==Risk.projectId`)
     - stage overlap (`Item.stageNames ∩ Risk.stageNames ≠ ∅` OR risk stageNames
       empty = wildcard); stage-less item = covered by any same-product risk. Result
       = highest covering severity (`blocked>at-risk`). ELIGIBILITY: only
       `workflowStatus==in_progress` items are floored (a done/planned item under a
       covering risk must NOT read at-risk — seed `mock-data.ts` cw2/cw4 are the trap).
   * §2 `item-card.tsx`: pill from the helper not `item.status`; add `at-risk`
     STATUS_BADGE (amber tokens); covered-lock affordance; foreign-risk attribution.
   * §3 `item-edit-dialog.tsx`: remove free `blocked` chip from CURRENT_WEEK_CHOICES;
     uncovered alarm gesture opens the risk(blocker) dialog prefilled; `quick-add`
     "blocker" → risk(blocked) not blocked-item. (Shares item-edit-dialog with the
     just-refactored dialogs — mind `resolveRecordParent`/`RecordStageStep`.)
   * §4 write invariant (saveSection rejects stored blocked w/o covering risk).
     DEFER the enum-value removal from Prisma+Zod (Q2 lock).
   * §5 migration/backfill: heal every legacy stored-blocked item → synth covering
     Risk(blocked) + set item in_progress; update seeds; `migrate reset --force`.
   * head-report item badge re-source BOTH consumers (`weekly-report-groupers.ts:123`,
     `lead-cross-author.ts:228`); escalation `blocked` REPLACE the item-sourced push
     at `published-report-snapshot.ts:272-281`, apply null-projectId activity skip
     unconditionally (couples with Q1). Reconcile `status-risk-unification` delta
     (ADD sibling requirement, no header change).
2. **lead-report-surface-polish §5-6** (Q5 carry-over auto-copy at ensureLeadSection;
   Q6 acknowledge split placement). Q7 = KEEP shipped float (no work). Then archive.
3. **agent-review-human-confirmed-gate** — review-mode split, move section-review
   strip to dashboard, agent-review affordance, human-confirmed gate (spec + FE;
   does NOT un-defer agent invocation).
4. **ci-deploy-supplychain-hardening** — CI enforce, frozen lockfile, API port 3001
   align, CSP enforce. CSP is high-stakes → live-verify the app doesn't break.
5. **tighten-code-quality-ratchet** — LAST (so all new code ≤250). eslint 300→250 +
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
