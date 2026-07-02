## Why

> Captured from a 2026-06-30 in-app annotation (cluster C6), grilled + adversarially
> verified. See `docs/feedback/decisions-locked-2026-06-30.md`.

The grill found a **live server integrity defect**: a lead can persist a record into
an SDLC stage they do not own. `saveDraft` runs NO content validation
(`assertCanEditSection` + a published/submitted gate only); `submitSection` adds only
`validateSubmitInput` (traffic-light + ≥1 current item). The Zod write schemas
enforce only that ≥1 valid-UUID stage is _present_, never that the author _owns_ it,
and `saveSection` persists `stageNames` verbatim (a denormalized name array, no FK,
no DB constraint). The add/edit dialogs scope stage options to the lead's owned
stages as a UX convenience, but a stale or crafted client bypasses them entirely.

The stakeholder asked for a logical correspondence between product and stage access:
picking a product restricts the selectable stages to the ones the lead owns on that
product; a lead must never write a record into a stage they don't own (e.g. DevOps
when they only own Testing); a single owned stage is pre-selected and locked; the
default view hides other leads' records.

## What Changes

- **Server write guard (closes the bug).** A shared pure validator
  `validateStageOwnership(section, input)` runs on BOTH `saveDraft` and
  `submitSection`. For each new/changed record row it confirms every stage name is
  one the section's author owns on that row's product (canonical-name compare against
  the server-loaded `ownedStages`, via `stageNamesMatch` for the Dev/Development
  alias). On an unowned stage it **hard-rejects** (`BAD_REQUEST` `STAGE_NOT_OWNED`).
- **Grandfather unchanged rows.** Enforcement keys on a per-row-id diff against the
  server section; unchanged legacy/cross rows are not re-validated, preserving
  `fix-lead-surface-name-resolution` (which deliberately lets a row reference a
  product the author owns no stage on). The guard scopes to the **section author's**
  owned stages even when a head/admin edits on-behalf.
- **Client dialog scoping (made honest, not bypassable).** Picking a product
  re-scopes the stage options to the author's owned stages on that product; a single
  owned stage is visibly pre-selected and locked (non-deselectable); with zero owned
  stages on the selected product, Save is disabled with an inline "no stages assigned
  on <product> — contact admin" (extends the risk-dialog rule, currently unimplemented,
  to the item and decision dialogs). The `productId` axis is subsumed: no owned stage
  on a product ⇒ its `ownedStages` is empty ⇒ any stage on it already fails the guard.
- **Default "mine only" gets a spec home.** The Mine/Everyone `RecordVisibilityToggle`
  already hard-defaults to Mine per `{userId, reportId}` (`use-record-visibility.ts:74`);
  this change pins that default in the spec and keeps the existing toggle as the
  single show-all control (no second "show all" button).

## Capabilities

### Modified Capabilities

- `risk-stage-integrity`: adds the **stage-ownership** write guard (server) and the
  product→owned-stages dialog scoping (client) for item/risk/decision — it previously
  required a record carry _a_ stage, never an _owned_ one. New requirement headers,
  no collision with the in-flight `fix-risk-stage-integrity-impl`.
- `report-toolbar-parity`: pins the lead report's default record visibility to
  **Mine only** and keeps the existing Mine/Everyone toggle as the canonical show-all.

## Impact

- API: a new shared `validateStageOwnership` called by `saveDraft` + `submitSection`
  (`apps/api/.../report-sections`); a new `STAGE_NOT_OWNED` domain error. Inside the
  existing lead write procedure — no new chain, no new `Role` (role-coverage-gate
  intact). Child-row validation only — `period-dual-state` intact.
- Web: product→owned-stages re-scoping + single-stage pre-select/lock + zero-stage
  Save-disable across the item / risk / decision dialogs; spec the Mine-only default.
- Security/integrity: closes a live authz hole (a lead writing an unowned stage),
  hard-reject so a real client bug is not masked (no silent clamp).
- **Coordinate:** touches `risk-stage-integrity`, adjacent to in-flight
  `fix-risk-stage-integrity-impl` — use distinct requirement headers; do not edit the
  same service hunks a parallel session may hold.
