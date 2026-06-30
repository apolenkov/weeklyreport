## 0. Dependency

- [ ] 0.1 BLOCKED-until-`fix-carryover-persistence` merges before the copy-forward UX ships (the current carry-over write path is known-buggy).

## 1. Schema / settings

- [ ] 1.1 Add an org `AppSettings` flag for the unified by-state view (no record-shape change). `migrate reset`; regenerate the client.

## 2. Quick-add

- [ ] 2.1 Add the lead-form quick-add control: type picker (current-item / next-item / decision / risk / blocker) opening the EXISTING per-type dialog; "blocker" → current `Item` `workflowStatus=blocked`.
- [ ] 2.2 Keep all write invariants (≥1 owned stage via the C6 guard, stage+product on decision, submit gate); pre-select the single owned stage, else require a tap.

## 3. Unified view (projection)

- [ ] 3.1 Implement a total, deterministic bucket function (done / in-progress / blocked / planned-next / deferred) over `type`/`workflowStatus`/`completed`/`carriedOver` with explicit precedence; NO `failed`; `carriedOver` ≠ deferred.
- [ ] 3.2 Render the opt-in unified section behind the `AppSettings` flag; classic two-section default when off. Preserve physical `Item.type` storage.

## 4. Move actions + carry-over UX

- [ ] 4.1 "mark complete" / "move to next week" mutate in place (same `Item.id`); no clone.
- [ ] 4.2 Surface `carryOver.execute` as a one-click "Copy forward unfinished" on period open (no auto-trigger; no write-path change).

## 5. Tests

- [ ] 5.1 Quick-add blocker → blocked item; quick-add enforces a stage.
- [ ] 5.2 Bucket function: every (type×status×completed×carriedOver) combo lands in exactly one bucket; carried item not "deferred".
- [ ] 5.3 Default off → classic format; flag on → unified; physical `type` unchanged.
- [ ] 5.4 Move-to-next-week keeps `Item.id` and a C1 comment anchor.

## 6. Verification

- [ ] 6.1 `pnpm --filter @customreport/api db:generate`, `pnpm typecheck`, `pnpm lint` until green.
- [ ] 6.2 `pnpm test` until green.
- [ ] 6.3 `openspec validate "unified-activity-entry" --strict` until it exits 0.
