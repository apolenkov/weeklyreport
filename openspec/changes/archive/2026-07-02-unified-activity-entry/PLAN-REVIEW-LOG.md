# Plan Review Log: позиция lifecycle (resolve-not-delete) — refinement of unified-activity-entry

Act 1 (grill-with-docs) + Act 2 (Codex adversarial review). MAX_ROUNDS=5.

## Act 1 — grill (Claude ↔ Саша, advisor as cross-model)

Target: the new product rule "a позиция, once created, is resolved — not silently
deleted." Forks resolved with Саша:

- **Q1 — when may a позиция be removed?** Locked: only while it has NEVER been in a
  published (зафиксированный) report; once published it can only be resolved or carried.
  Plus a visible marker explaining why it is locked. (Trigger = publish, not submit —
  submit is soft/reversible, publish is the official freeze.)
- **Q2 — what closes a позиция?** Locked: only `done` closes; in-progress / blocked /
  planned-next / deferred keep it open and it carries forward.
- **Q3 — carry-over interaction?** Resolved autonomously (Саша delegated): carry-over stays
  head-manual (the C2 decision, not reversed); uncarried open work is surfaced so it is not
  lost silently.

Glossary updated inline (CONTEXT.md "Позиция / Record" term). ADR 0015 created. The
mechanism was NOT settled in Act 1 — deferred to the deliverable, which is where Codex
caught it.

## Act 2 Round 1 — Codex (VERDICT: REVISE)

Six findings, all confirmed against code:

1. The spec's "diff by row id against the frozen snapshot" is infeasible — `saveSection`
   recreates rows with DB-minted ids (`report-sections.prisma-repository.ts:542/574`), so
   row ids do not survive a save. Needs a stable record identity.
2. Carry-over clones with new ids (`carry-over.service.ts:73/110`); the spec never says
   whether a carried clone stays locked. Needs lineage / root-id locking.
3. Carry-over carries only next-week items + unresolved decisions — **risks do not carry**;
   the requirement assumed they do.
4. The publish warning is a MUST but there is no API/UI task and the publish response
   (`period.service.ts:158` `{success, reportId}`) has no channel for it.
5. The "does NOT alter snapshot/carry-over" claim is incoherent with the required behavior.
6. Scenarios miss the hard cases (reopened lock, post-reopen deletable, carried clone).

### Claude's response (revised)

Acted on all six. Rewrote requirement 1 to the **invariant only** (removed the infeasible
mechanism and the no-alteration claim). Added `design.md` owning the technical reality: the
**stable-record-identity prerequisite** (also blocks C1 comment anchors + C2 move-in-place),
**lineage-root locking**, the **risk-carry-over gap** (decide: extend or narrow), and the
**missing publish/period response channel**. Narrowed requirement 2 (surface uncarried open
work at the NEWLY OPENED period, not at prior-period publish). Updated ADR 0015 (lineage +
prerequisite). Added scenarios (reopened lock / post-reopen deletable / carried clone) and
tasks (0.2 prerequisite, 4b lifecycle, 5.5/5.6 tests). `openspec validate --strict` clean.

## Act 2 Round 2 — Codex (VERDICT: REVISE)

Feasibility resolved; three cross-layer CONSISTENCY contradictions remained:

1. ADR 0015 still said "publish WARNS" while spec/design/tasks moved the open-work signal
   to the newly opened period.
2. Risk carry-over: design/tasks said risks don't carry (open decision), but ADR + CONTEXT
   still implied every open позиция carries.
3. The per-item move requirement still promised "same `Item.id`" + comment anchor by that
   id, contradicting design (ids don't survive saves) and the stable-identity task.

### Claude's response (revised)

1. ADR 0015 Decision rewritten: open work surfaced at the newly opened period, not a
   publish warning.
2. Aligned ADR + CONTEXT with design/tasks: carry-over today covers items + decisions;
   risk-carry is an explicit open decision everywhere.
3. Renamed the requirement to "Per-Item Move Actions Preserve the Record's Stable Identity"
   (lineage key, not literal `Item.id`); scenario asserts stable identity + comment anchor.
   `openspec validate --strict` clean.

## Act 2 Round 3 — Codex (VERDICT: APPROVED)

"No remaining material coherence blockers found. The stable-identity prerequisite is
explicit, the publish-warning contradiction is resolved, risk carry-over is consistently
treated as an open implementation decision, and the move requirement keys on stable
identity rather than literal row id." `openspec validate --strict` passes.

## Resolution — CONVERGED (3 rounds)

The lifecycle refinement is sound to implement, with one explicit prerequisite called out
across spec/design/ADR/tasks: **a stable record identity must be introduced first** (it
also unblocks C1 comment anchors and C2 move-in-place). Skill ends here — the change is
ready for the normal apply/archive flow; no code was written.
