# Design

## Context

Council-vetted plan points 2 and 5 from the 2026-07-06 walkthrough (grill with
Codex, 2026-07-06 session). Point 1 (`+ Add` on activity lanes, seed-activity
path through `resolveRecordParent`) and point 4 (stage-chip menu hint copy)
landed as direct commits `6f2b50f` / `499f213` and are prerequisites here.

## Goals / Non-Goals

- Goal: visually separate the two reporting levels on the week boards — product
  columns in the grid, activity lanes in a lighter block below (the slide
  precedent: `SlideActivityPills` is its own row under the product grid).
- Goal: close the last raise-without-risk surface — the activity status pill —
  with the same route-through-risk-creation gesture the stage chips use.
- Non-Goal: density work for many products/activities (plan point 3, deferred).
- Non-Goal: the unified by-state view (`unified-activity-section.tsx`) — it has
  no per-parent columns, nothing to split.

## Decisions

### D1 — Activity lanes render in a separate block, not an in-grid divider

`buildItemColumns` stays the tested lane builder, but the week sections stop
concatenating lanes into the product grid. A new `splitItemBoard` export
returns `{ productColumns, activityLanes }`; both sections render product
columns in the existing grid and lanes in a shared `ActivityLanesBlock`
(dashed-top separator, "Activities" kicker, lighter lane containers, up to the
same 3-column cap). The lane header reuses `BoardColumnHeader`, so the `+ Add`
with activity preselection (point 1) moves with the lanes.

**Spec-delta skip (recorded per cross-capability discriminator):** the
presentation move does NOT modify the "Activities render on the lead form…"
requirement — records still render in their matching main section under an
activity lane, which is all the requirement (and the unarchived
`route-activity-records-into-record-sections` delta on that same header)
demands. Two changes carrying MODIFIED deltas for one header cannot archive
cleanly; the block split is presentation, so it stays out of the spec.

### D2 — Pill raise gating mirrors the stage-chip interception exactly

`ActivityStatusPills.pick()` gains one branch: a click on yellow/red whose
severity exceeds the covered level (yellow needs any covering risk ⇔
`alarmFloor != null`; red needs a covering blocker ⇔ `alarmFloor === "red"`)
calls a new `onRaiseRequiresRisk(activityId, severity)` instead of
`onStatusChange`. Lower-below-floor keeps the existing refusal + message.
Lowering a legacy self-raised status with no floor stays allowed (stored data
predating this change).

### D3 — The prefill channel grows an activity side

`RiskPrefillRequest` gains optional `activityId` (XOR with a meaningful
`productId`; `productId: ""` on activity prefills). `RisksSection` forwards it
through `openCreate({ productId, activityId })` (point 1's seed object) into a
new `RiskEditDialog.defaultActivityId`, which feeds `resolveRecordParent`'s
seed — the activity wins over the seed product by the shared seed rule.
`lead-form` maps yellow→`at-risk`, red→`blocked` and bumps the same one-shot
signal `routeToBlocker` uses.

### D4 — Live alarm floor, derived client-side

The server's `alarmFloor` rides the read model and goes stale the moment the
lead adds/removes a draft risk (no refetch mid-edit). A new
`lib/activity-alarm.ts` derives the floor from the live own draft risks —
non-empty text, `activityId` match, blocked→red else yellow, worst wins —
mirroring the server's `deriveActivityStatus` (risks only; items never floor,
per rework-item-status-model). `lead-form` overlays this onto
`data.activityCards` for the interactive section, the activity twin of
`applyRiskSeverityFloor`. Read-only surfaces keep the server-derived value.

## Risks / Trade-offs

- The one behavior change (D2) rewrites the test that pinned the old "manual
  raise persists" allowance; downstream readers are safe — all four consumers
  read `derivedStatus ?? status`.
- Client/server floor derivations could drift; both are risks-only and the
  client version gets a unit test pinning the mapping.
