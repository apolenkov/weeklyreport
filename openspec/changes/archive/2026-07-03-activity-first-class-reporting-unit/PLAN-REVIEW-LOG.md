# Plan Review Log — activity-first-class-reporting-unit

## Round 1 — Codex (VERDICT: REVISE)

Codex reviewed the plan read-only and returned VERDICT: REVISE with 8 findings.
All 8 were accepted as legitimate.

1. **Sequencing.** `design.md` said escalation/KPI parity, activity-only
   reachability, carry-over-on-archive, and decision-parent must be decided before
   implementation, but `tasks.md` deferred them to 9.2 AFTER impl tasks 1–8, while
   the specs already hard-coded decisions. Hoist the four resolutions to the front.
2. **Spoofing guard.** Records add `activityId`, but only `activityStatuses` are
   validated against the section's seeded activities. Add a write guard so
   `items/risks/decisions[].activityId` is validated against `section.activities`
   before `saveSection`, mirroring the projectId/stage ownership guard.
3. **"No SDLC stage" must be REQUIRED, not merely tolerated.** Require `stageIds`
   absent/empty whenever `activityId` is set; the refine only accepted empty
   stages, it did not forbid a non-empty stage set on an activity-parented row.
4. **Admin activity CRUD still exposes the scalar `projectId`.** Dropping
   `ProjectActivity.projectId` requires the admin create/update/list contract to
   switch to `linkedProductIds` / `linkedProducts`.
5. **Activity-only submit under-specified.** Relaxing `projectStatuses.min(1)` did
   not require every attached activity to carry a non-null status, and
   `activityStatusInputSchema.status` is nullable/optional.
6. **Read-model contract self-contradiction.** The spec said activity records are
   grouped UNDER the activity (like product records under a product); the design
   said records stay in top-level arrays discriminated by `activityId`. Choose one.
   (Codex's steer: prefer the grouped shape "matches products[].\*".)
7. **`saveSection` drops decisions without `productId`.** Activity-owned decisions
   (`productId` null, `activityId` set) need to persist; the `decisionsToSave`
   filter must be adjusted.
8. **Escalation conflict with `status-risk-unification`.** That spec keeps per-item
   `blocked` and per-risk escalations per-record, while this change's design says
   activity risks/blockers do NOT enter the dashboard escalation table. Resolve so
   the specs are non-contradictory; verify the exact existing header before any
   MODIFIED delta.

## Claude's response (arbiter — all 8 applied)

1. **Sequencing — applied.** Added task group `0. Decisions to lock (BLOCKS tasks
1–8)` at the front of `tasks.md` with all four resolutions LOCKED. Converted
   `design.md`'s "Top open question" and "Open questions for a human" into a
   front-loaded "Locked decisions" section + a "Resolved questions" recap. Replaced
   the deferring task 9.2 with a note that the decisions are locked up front.

2. **Spoofing guard — applied.** Added an ADDED requirement "The write path
   validates a record's activityId against the section's activities" +
   spoofed-activityId rejection scenario (`activity-reporting-unit`). Added
   `design.md` Decision 7 (`validateRecordActivityIds` mirroring
   `validateActivityStatuses`, returning `ACTIVITY_NOT_ATTACHED`) and task 3.7.

3. **Stage-forbidden on activity parent — applied.** Tightened the
   `risk-stage-integrity` MODIFIED requirement: the write schemas MUST REJECT a
   non-empty `stageIds` when `activityId` is set (not merely accept empty). Added a
   rejection scenario, updated `design.md` Decision 4 (superRefine enforces both
   directions), and task 2.2.

4. **Admin CRUD contract — applied.** Added an ADDED requirement "Admin activity
   create/update/list uses linked product ids, not a scalar projectId" + two
   scenarios (`activity-reporting-unit`). Added `design.md` Decision 2 admin-switch
   paragraph, tasks 2.5 (schema), 3.9 (service reconcile), 4.4 (admin UI
   multi-select).

5. **Activity-status required at submit — applied.** Tightened the "A section
   attached only to activities can be submitted" requirement: submit validation
   MUST loop the attached activities and require each to carry a non-null status
   (mirroring the per-product loop), tightening `activityStatusInputSchema.status`
   to non-null at submit. Added a null-status-blocks-submit scenario, `design.md`
   Decision 4 bullet, and task 2.3.

6. **Read-model shape — resolved toward FLAT (corrected Codex's steer).** Codex's
   rationale ("grouped matches products[].\*") does NOT hold at the shared
   read-model layer: `reportSectionReadModelSchema` is FLAT — `projects[]` plus
   top-level `items/risks/decisions[]` discriminated by `projectId`; product
   records are NOT nested under `products[]`. The presentation mapper
   (`mapLeadProducts`) does the grouping for rendering. The tie-breaker is the
   write path, which findings 2 and 7 already lock to the flat arrays
   (`draftSaveSchema`, `validateStageOwnership`, `decisionsToSave`); a grouped read
   model would force a grouped write path and contradict findings 2 + 7. Kept
   `design.md` Decision 4 (top-level arrays discriminated by `activityId`) and
   rewrote the `activity-reporting-unit` spec so activity records live flat and are
   grouped-under-activity by the presentation mapper — the SAME mapper behaviour
   that groups a product's records under a product. This honours the finding's
   intent (spec+design agree, first-class parity with products) while correcting
   its mechanism. Task 3.1 updated to say "flat, not a read-model reshape".

7. **`decisionsToSave` filter — applied.** Added `design.md` Decision 6 and task
   3.8: the filter must persist a decision carrying a `productId` OR an
   `activityId` (write `productId` null / `activityId` set for the activity case)
   instead of dropping every `productId`-less decision. Test note added to task
   8.2.

8. **Escalation conflict — resolved via Option A (MODIFIED delta).** Option B would
   have reversed `proposal.md`'s explicit "Out of scope (Phase 1): activity
   risks/blockers do NOT feed the escalation table", so A is the only option
   consistent with the rest of the change. Verified the existing header VERBATIM in
   `openspec/specs/status-risk-unification/spec.md`:
   `### Requirement: The project-level flagged-red escalation is emitted once per
red product`. Authored a new `status-risk-unification` MODIFIED delta narrowing
   the per-item `blocked` / per-risk `unresolved_risk` escalations to
   PRODUCT-parented rows; activity-parented (null `projectId`) records emit no
   escalation in Phase 1. Reproduced the full requirement body + all scenarios and
   added an activity-emits-no-escalation scenario. Added `status-risk-unification`
   to `proposal.md`'s Modified Capabilities and Specs impact line.

## Validation

`openspec validate "activity-first-class-reporting-unit" --strict` →
`Change 'activity-first-class-reporting-unit' is valid` (exit 0). All four
MODIFIED headers (`risk-stage-integrity` ×2, `record-dialog-layout` ×1,
`status-risk-unification` ×1) confirmed verbatim against `openspec/specs/`.
