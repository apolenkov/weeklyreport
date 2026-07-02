## 0. Dependencies & prerequisites

- [x] 0.1 BLOCKED-until-`fix-carryover-persistence` merges before the copy-forward UX ships (the current carry-over write path is known-buggy). — LANDED: `carry-over.service` persists every matched target section (`targetSections` plural through `saveCarryOver`).
- [x] 0.2 PREREQUISITE — stable record identity. `saveSection` recreates rows with fresh DB-minted ids, so no record survives a save. Introduce a durable per-record key (lineage root) preserved through the recreate and copied by carry-over BEFORE the lifecycle lock (5.x), the move-in-place rule (4.1), or C1 comment anchors can work. See `design.md`. This is a shared foundation, larger than this change. — LANDED in `introduce-durable-record-identity` (commit 73ebf70a): `stableId` on Item/Risk/Decision, preserved by `saveSection` and copied by carry-over.

## 1. Schema / settings

- [x] 1.1 Add an org `AppSettings` flag for the unified by-state view (no record-shape change). `migrate reset`; regenerate the client. — `AppSettings.unifiedActivityView Boolean @default(false)` in schema + init migration SQL; wire schema, admin read/write mapping, and the Settings → Periods toggle. (DB reset itself is run by the schema-wave orchestrator.)

## 2. Quick-add

- [x] 2.1 Add the lead-form quick-add control: type picker (current-item / next-item / decision / risk / blocker) opening the EXISTING per-type dialog; "blocker" → current `Item` `workflowStatus=blocked`. — `QuickAddButton` + a form-level `ItemEditDialog` host (`defaultStatus="blocked"` preset); risk/decision route through the existing section add-signals.
- [x] 2.2 Keep all write invariants (≥1 owned stage via the C6 guard, stage+product on decision, submit gate); pre-select the single owned stage, else require a tap. — the existing dialogs enforce them; the single-owned-stage auto-apply saves without a tap, multiple stages still require a choice (pinned by test).

## 3. Unified view (projection)

- [x] 3.1 Implement a total, deterministic bucket function (done / in-progress / blocked / planned-next / deferred) over `type`/`workflowStatus`/`completed`/`carriedOver` with explicit precedence; NO `failed`; `carriedOver` ≠ deferred. — `apps/web/src/lib/activity-buckets.ts`.
- [x] 3.2 Render the opt-in unified section behind the `AppSettings` flag; classic two-section default when off. Preserve physical `Item.type` storage. — `UnifiedActivitySection` behind `leadForm.viewSettings`; the projection never writes `type`.

## 4. Move actions + carry-over UX

- [x] 4.1 "mark complete" / "move to next week" mutate in place (stable record identity per 0.2, NOT a delete-recreate that mints a new id); no clone. — in-place draft patch keyed by row id, `stableId` rides the spread; saveSection preserves the lineage.
- [x] 4.2 Surface `carryOver.execute` as a one-click "Copy forward unfinished" on period open (no auto-trigger; no write-path change). — `CarryOverBanner` on the head weekly-report page for OPEN periods.

## 4b. Позиция lifecycle (resolve-not-delete)

- [x] 4b.1 Lock deletion of a published record (by lineage root per 0.2): a record that has been published can only be resolved (done) or carried; a never-published draft is deletable. Add the visible "in the published record" marker. — server-side `PUBLISHED_RECORD_LOCKED` guard on both write paths (client `stableId` never trusted) + `PublishedRecordMarker` and Delete withheld in the UI.
- [x] 4b.2 Decide carry scope for risks: extend `carryOver.execute` to risks (clone + lineage + tests) OR consciously narrow the rule to items + decisions (risks are re-raised, not carried). Record the decision. — DECIDED: risks do NOT carry (re-raised, not carried); rule narrowed to items + decisions; recorded in `design.md`; carry-over write path untouched.
- [x] 4b.3 Surface uncarried open work at the newly opened period (a query + head-view signal); add the response/contract channel — publish itself returns `{success, reportId}` today and moves nothing automatically. — `carryOver.uncarried` (headProcedure query) + the banner; publish response unchanged.

## 5. Tests

- [x] 5.1 Quick-add blocker → blocked item; quick-add enforces a stage. — `quick-add-button.test.tsx`.
- [x] 5.2 Bucket function: every (type×status×completed×carriedOver) combo lands in exactly one bucket; carried item not "deferred". — `activity-buckets.test.ts` (all 36 combos).
- [x] 5.3 Default off → classic format; flag on → unified; physical `type` unchanged. — `lead-form.test.tsx` (flag off/on) + `unified-activity-section.test.tsx` (delete routes to the physical week list).
- [x] 5.4 Move-to-next-week keeps the stable record identity (0.2) and a C1 comment anchor. — `unified-activity-lifecycle.integration.test.ts` (written; runs after the orchestrator's schema reset).
- [x] 5.5 Published record cannot be silently removed (reopened period); a record added after reopen is deletable until re-published; a carried clone of a published record stays locked by lineage. — unit (`report-sections.published-lock.test.ts`, `published-record-guard.test.ts`, `published-lineage.test.ts`) + the integration file above.
- [x] 5.6 Uncarried open work from the prior period is surfaced at the newly opened period; a done record is not flagged; nothing moves automatically. — `carry-over-uncarried.test.ts` + the integration file above.

## 6. Verification

- [x] 6.1 `pnpm --filter @customreport/api db:generate`, `pnpm typecheck`, `pnpm lint` until green. — db:generate + api/web typecheck green; changed files pass `eslint --max-warnings 0`.
- [x] 6.2 `pnpm test` until green. — every touched unit suite green (api: report-sections, carry-over, admin, role-coverage + contract suites; web: lead form ×4 harnesses, unified section, quick-add, buckets, weekly-report page, settings tab). Integration tests are written but deferred to the orchestrator's post-reset gate (test DB still carries the old schema).
- [x] 6.3 `openspec validate "unified-activity-entry" --strict` until it exits 0.
