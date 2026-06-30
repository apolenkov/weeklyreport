## 0. Dependencies & prerequisites

- [ ] 0.1 BLOCKED-until-`fix-carryover-persistence` merges before the copy-forward UX ships (the current carry-over write path is known-buggy).
- [ ] 0.2 PREREQUISITE — stable record identity. `saveSection` recreates rows with fresh DB-minted ids, so no record survives a save. Introduce a durable per-record key (lineage root) preserved through the recreate and copied by carry-over BEFORE the lifecycle lock (5.x), the move-in-place rule (4.1), or C1 comment anchors can work. See `design.md`. This is a shared foundation, larger than this change.

## 1. Schema / settings

- [ ] 1.1 Add an org `AppSettings` flag for the unified by-state view (no record-shape change). `migrate reset`; regenerate the client.

## 2. Quick-add

- [ ] 2.1 Add the lead-form quick-add control: type picker (current-item / next-item / decision / risk / blocker) opening the EXISTING per-type dialog; "blocker" → current `Item` `workflowStatus=blocked`.
- [ ] 2.2 Keep all write invariants (≥1 owned stage via the C6 guard, stage+product on decision, submit gate); pre-select the single owned stage, else require a tap.

## 3. Unified view (projection)

- [ ] 3.1 Implement a total, deterministic bucket function (done / in-progress / blocked / planned-next / deferred) over `type`/`workflowStatus`/`completed`/`carriedOver` with explicit precedence; NO `failed`; `carriedOver` ≠ deferred.
- [ ] 3.2 Render the opt-in unified section behind the `AppSettings` flag; classic two-section default when off. Preserve physical `Item.type` storage.

## 4. Move actions + carry-over UX

- [ ] 4.1 "mark complete" / "move to next week" mutate in place (stable record identity per 0.2, NOT a delete-recreate that mints a new id); no clone.
- [ ] 4.2 Surface `carryOver.execute` as a one-click "Copy forward unfinished" on period open (no auto-trigger; no write-path change).

## 4b. Позиция lifecycle (resolve-not-delete)

- [ ] 4b.1 Lock deletion of a published record (by lineage root per 0.2): a record that has been published can only be resolved (done) or carried; a never-published draft is deletable. Add the visible "in the published record" marker.
- [ ] 4b.2 Decide carry scope for risks: extend `carryOver.execute` to risks (clone + lineage + tests) OR consciously narrow the rule to items + decisions (risks are re-raised, not carried). Record the decision.
- [ ] 4b.3 Surface uncarried open work at the newly opened period (a query + head-view signal); add the response/contract channel — publish itself returns `{success, reportId}` today and moves nothing automatically.

## 5. Tests

- [ ] 5.1 Quick-add blocker → blocked item; quick-add enforces a stage.
- [ ] 5.2 Bucket function: every (type×status×completed×carriedOver) combo lands in exactly one bucket; carried item not "deferred".
- [ ] 5.3 Default off → classic format; flag on → unified; physical `type` unchanged.
- [ ] 5.4 Move-to-next-week keeps the stable record identity (0.2) and a C1 comment anchor.
- [ ] 5.5 Published record cannot be silently removed (reopened period); a record added after reopen is deletable until re-published; a carried clone of a published record stays locked by lineage.
- [ ] 5.6 Uncarried open work from the prior period is surfaced at the newly opened period; a done record is not flagged; nothing moves automatically.

## 6. Verification

- [ ] 6.1 `pnpm --filter @customreport/api db:generate`, `pnpm typecheck`, `pnpm lint` until green.
- [ ] 6.2 `pnpm test` until green.
- [ ] 6.3 `openspec validate "unified-activity-entry" --strict` until it exits 0.
