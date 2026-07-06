# Design — route activity records into the main record sections

## Context

`activity-first-class` Decision 1 put activity-parented records under the
activity card: the three read-model mappers (`mapLeadItems`, `mapLeadRisks`,
`mapLeadDecisions` in `apps/web/src/lib/mappers/lead-form.ts`) filter
activity-parented rows OUT of the section arrays, and
`mapLeadActivityCards` regroups them into read-only `RecordList`s inside
`activity-status-section.tsx` — plain `<li>` text, no edit, no delete. The
owner reversed this on a live walkthrough (2026-07-06): records are edited in
the main sections; the activity card is a status-only analog of Product
Status. Council grill (Claude + Codex, 2026-07-06) verified the coupling
surface; the "Phase-1 lock" comments in `ItemCard.deriveCardStatus` and
`UnifiedActivitySection` show the alarm isolation was pre-staged for exactly
this reversal.

## Goals / Non-Goals

**Goals**

- Activity records render + edit + delete in Current/Next/Risks/Decisions and
  the unified view, under an activity lane.
- Activity card = status-only (name, linked products, floored pills).
- Priority-rank picker sees ranks held by activity items.

**Non-Goals**

- No storage or API change (flat arrays + XOR parent stay).
- No change to slides or head-report activity presentation.
- No change to alarm derivation (Q1 isolation already handles it).
- No add-affordance on the activity card (attachment stays admin-provisioned).

## Decisions

1. **Unfilter at the mapper, label at the lane.** The mappers include
   activity-parented rows; the row's display parent label resolves to the
   activity name (the `labelFor(projectId, activityId)` helper already does
   this for the priorities view). Alternative — a second parallel array of
   activity records threaded through the form — rejected: doubles every
   handler and drifts from the product path.
2. **Activity lanes ride the same column builders.** `buildItemColumns`
   (`next-week-columns.ts`) and the current-week grouping extend from
   product-keyed groups to parent-keyed groups: products first (existing
   order), then one lane per activity that owns rows, keyed by `activityId`.
   Sequencing constraint: the lane MUST land in the same commit as the
   unfilter — an unfiltered activity item matches no product and silently
   vanishes today.
3. **Strip the card last.** `RecordList` leaves
   `activity-status-section.tsx` only after mappers + lanes + ranks + unified
   feed are green; stripping first recreates the data black hole the council
   flagged.
4. **Ranks join the taken set.** `ownPeriodRanks` concatenates activity items
   with the product items; no picker UI change.
5. **Save path untouched.** `handleCurrentWeekItemsChange` / risk / decision
   merge handlers already carry `activityId` through
   `sectionToDraftPayload` (XOR parent). Verified: the write schema's
   activityId guard stays the enforcement point.

## Risks / Trade-offs

- [Regression: activity rows double-render (card AND sections) mid-sequence]
  → single change, card stripped in the same PR-sized commit train; verify
  step checks both surfaces.
- [Foreign (Everyone-mode) activity rows entering the merge] → foreign rows
  are already excluded from draft merges (D4b `.foreign` strip); test the
  merged view renders foreign activity rows read-only like product ones.
- [Rank collisions in existing seeds: activity items currently unranked] →
  no data migration needed; picker only reads.

## Migration Plan

Pure presentation change; deploys with the web bundle. Rollback = revert.

## Open Questions

(none — product forks settled by the owner on 2026-07-06: unified view in
scope; slides/head untouched.)
