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

## Coordination

Touches `risk-stage-integrity`, adjacent to the in-flight `fix-risk-stage-integrity-impl`.
Use the DISTINCT requirement headers above (no header collision on archive); do not edit
the same `report-sections` service hunks a parallel session may hold concurrently.
