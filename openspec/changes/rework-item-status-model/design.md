# Design: rework-item-status-model

Grilled autonomously on 2026-07-06 (owner delegated: "прогрелись автономно"); Codex consulted as council adviser. Decisions below are locked unless the owner reopens them.

## Context

Today an item's state is smeared across three fields: `workflowStatus` (`done | in_progress | blocked`), `type` (`current | next`), and a tri-state `completed: Boolean?` — web derives a presentation `planned` from `type=next ∧ completed=null` (ADR 0011 projection). Alarms already derive from covering risks (`report-escalations.ts` sources `blocked` from risk severity, NOT from item status); the stored `blocked` value is legacy, coerced away on every surface. The item dialog shows type-inappropriate chips and a Mark-as-blocked button the owner rejected live.

## Goals / Non-Goals

**Goals:** one honest stored status per item; per-type vocabularies; dialog that only offers legal states; paused/postponed as first-class; all read surfaces explicit.

**Non-Goals:** risk/decision statuses; prod migration; changing the risk-derived alarm convention (it stays exactly as specced).

## Decisions (grill protocol)

1. **Terms.** _Progress_ = the stored `workflowStatus` (what the lead says about the work). _Alarm_ = the derived severity from covering risks (never stored on the item). These two never mix; CONTEXT.md updated.
2. **One enum, per-type subsets.** Single `ItemWorkflowStatus = planned | in_progress | paused | postponed | done`; shared Zod refines: current ∈ {in_progress, paused, done}, next ∈ {planned, postponed}. One enum keeps Prisma/analytics simple; the DB does not enforce the per-type subset — code review + Zod do (same posture as the period dual-state invariant).
3. **`blocked` leaves the enum.** Escalations already source from risks; the dialog already refuses to re-persist it; keeping the value only preserves a lie. Seeds that stored `blocked` become `in_progress` + their existing blocker risk (the risk was always the real signal).
4. **`Item.completed` column dropped.** Tri-state boolean beside an enum is the root of the "planned is completed=null" hack. `done` in the enum is the only done-ness. `item-status.ts` collapses to a direct read; the kanban dual `ReportItem` types sync in the same commit.
5. **`planned` becomes stored.** The web already round-trips a presentation `planned`; storing it removes the projection special case. Carry-over materializes a carried next item as `in_progress` (it is being worked on now); `postponed` items are NOT auto-carried — postponing is an explicit "not next period" call, re-planning is manual.
6. **paused vs postponed.** `paused` (current only): on hold, owner intends to resume — counts as in-flight for readiness, not-done everywhere. `postponed` (next only): consciously pushed beyond the period — not-committed, not-done. Neither feeds blocked/at-risk escalation paths.
7. **Dialog.** Chips per type: current → In Progress | Paused | Completed; next → Planned | Postponed. Mark-as-blocked button removed; the path to a blocked item is creating a blocker in Risks & Blockers (unchanged spec). The covered-status lock survives untouched — it is the enforcement surface of the derivation, and it renders correct chips now.
8. **Slides.** paused → dashed frame + ‖ pause glyph; postponed → dashed frame + » glyph, muted text; sr-only labels "Paused"/"Postponed". Everything else keeps the shipped frame language.
9. **Loud failure is the migration plan.** Exhaustive switches on the enum fail typecheck until every arm is written — desired; no default-case escape hatches (overlay-coercion lesson: every render site maps explicitly).

## Risks / Trade-offs

- Dropping `completed` touches the kanban mappers and accordion status logic (known dual-type sync hazard) — covered by dedicated mapper tests before the UI wiring.
- Per-type subset not DB-enforced: an api writer bypassing Zod could store an illegal pair; accepted (single write path, role-gated, review-enforced like other invariants).
- Analytics counts shift when leads start using paused/postponed honestly — expected product outcome, not a regression.
