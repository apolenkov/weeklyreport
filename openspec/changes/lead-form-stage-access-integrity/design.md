# Design — lead-form-stage-access-integrity

MVP. Closes a live server integrity hole and makes the client dialog scoping honest.
Grilled + adversarially verified (2026-06-30).

## The bug (verified in code)

`saveDraft` (service) runs only `assertCanEditSection` (author == actor) + a
published/submitted gate — zero content validation. `submitSection` adds only
`validateSubmitInput` (traffic-light + ≥1 current item). The Zod write schemas enforce
`requiredStageIdsField` (≥1 valid-UUID stage _present_) but never _ownership_.
`saveSection` then persists `stageNames: r.stageIds ?? []` verbatim. The product↔stage
link is a denormalized name array — no FK, no DB constraint. So a stale/crafted client
writes any stage. The dialogs are UX; only a server guard closes it.

## Server guard

A pure `validateStageOwnership(section, input)` shared by both write paths:

- Diff the payload rows against the server-loaded section by row id; validate only
  **new/changed** rows (grandfather unchanged legacy/cross rows — preserves
  `fix-lead-surface-name-resolution`, where a row may reference a product the author
  owns no stage on). The wholesale delete-recreate in `saveSection` has no per-row
  "changed" signal, so the diff is explicit (cost is honest).
- For each validated row, compare canonical stage names per `projectId` against the
  server-authoritative `ownedStages` (StageAssignment-derived); reuse `stageNamesMatch`
  for the Dev/Development alias.
- Reference is the **section author's** owned stages regardless of editor —
  `assertCanEditSection` waves head/admin on-behalf edits through, so without this they
  could inject an unowned stage.
- Violation → `STAGE_NOT_OWNED` (`BAD_REQUEST`). Hard-reject, not clamp: clamping is a
  silent default that masks a real client bug (no-silent-defaults rule).
- `productId` is subsumed: no owned stage on product P ⇒ `ownedStages(P)` empty ⇒ any
  stage on P fails. No separate product-ownership axis.

## Client scoping (convenience, not the guarantee)

Item / risk / decision dialogs: product change re-scopes stage options to the author's
owned stages on that product; single owned stage → pre-select + lock (currently applied
silently at save via `effectiveStageIds` — implement as visibly locked); two+ → clear
on product change, must pick (already shipped); zero → disable Save + inline notice
(specced for the risk dialog, NOT implemented — extend to item + decision).

## Default mine-only

Already the hard default (`use-record-visibility.ts:74`, per `{userId, reportId}`).
The only gaps are a spec home (`report-toolbar-parity`) and keeping the existing
`RecordVisibilityToggle` as the single show-all control — do NOT add a second button.

## Invariants

`period-dual-state` intact — the guard validates child rows, never the Report period.
`role-coverage-gate` intact — validation runs inside the existing lead write procedure;
no new procedure/chain/Role.

## Coordination (verified 2026-06-30)

Touches `risk-stage-integrity`, adjacent to the in-flight `fix-risk-stage-integrity-impl`
(the parallel session owns it). Status of the overlap, checked against both change dirs:

- **No requirement-header collision (confirmed).** C6 adds `Lead-Authored Records Carry
Only Stages the Author Owns` + `The Record Dialogs Scope Stage Options to the Author's
Owned Stages`. The neighbor adds `The risk dialog never dead-ends on a zero-owned-stage
product` + `The required-mode stage banner does not promise "all stages"` + `Stage id
array elements are non-empty, visible, and null-byte-free`. All five headers are
  distinct, so both archive into `specs/risk-stage-integrity` without overwriting.
- **Semantic overlap — resolved by narrowing C6, not by a note alone.** The neighbor's
  `never dead-ends` requirement specs the zero-owned-stage Save-disable + `Ctrl/Cmd+Enter`
  no-op for the **risk** dialog. C6's `Record Dialogs Scope…` requirement now **defers the
  risk dialog to the neighbor** and extends the same dead-end pattern only to the **item
  and decision** dialogs (the net-new). So neither change re-specs the risk dialog's
  dead-end. The re-scope-on-product-change and single-owned-stage pre-select/lock in C6
  apply to all three dialogs and do not overlap the neighbor (it never specs those).
- **C6's net-new vs the neighbor:** (1) the shared **server** guard
  `validateStageOwnership` on both write paths — the neighbor is client-dialog only; (2)
  extending the zero-owned-stage dead-end to item + decision dialogs.

### Implementation ordering (Саша implements C6 AFTER the neighbor ships)

1. Neighbor lands `fix-risk-stage-integrity-impl` (risk-dialog dead-end + stage-id
   validation + banner) and ideally archives it first, so `specs/risk-stage-integrity`
   carries `never dead-ends` before C6 builds on it.
2. C6 then implements the server guard + the item/decision dialog dead-end, reusing the
   neighbor's risk-dialog dead-end component/pattern rather than re-deriving it.
3. Do not edit the same `report-sections` service hunks the parallel session may hold
   concurrently; stage only C6's own paths.

The stage-id-element validation (neighbor) and the ownership guard (C6) are complementary
layers on the same write path — element well-formedness vs. element ownership — not
duplicates; both should end up calling into the section save validation in sequence.

## Known limitation (recorded, out of scope)

`fillFrom` and `carry-over` write repository-direct (they do not route through
`saveDraft` / `submitSection`), so they do not run `validateStageOwnership`. They only
replay the AUTHOR's own previously-persisted rows — source access is enforced and the
client cannot choose stages — so no unowned stage can be injected through them. The one
edge: if a stage assignment is revoked BETWEEN periods, these bulk-copy paths can carry a
now-unowned row forward, the same grandfather tolerance this change already grants legacy
rows. Closing it would mean running the guard inside those two paths; deferred as
defense-in-depth, not an exploitable injection.

## Grandfather binds stableId to product + stage set (security note)

`stableId` is client-authoritative, so a row is grandfathered only when a server row shares
its stableId AND its `projectId`/`productId` AND its exact canonical stage set. Editing a
grandfathered row's non-stage content (text, tag, status) while keeping the same tolerated
stage is allowed by design and introduces no new stage — it cannot escalate, because the
`@@unique([reportSectionId, stableId])` constraint forbids a second row on the same lineage
key, and any change to the stage set or product re-validates against the author's owned
stages.
