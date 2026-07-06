# Route activity records into the main record sections

## Why

Activity-parented records (items/risks/decisions with `activityId`) are today
rendered ONLY as read-only `<li>` lists inside the Project Activities card —
not editable, not deletable, invisible to the Current/Next/Risks/Decisions
sections the lead actually works in. The owner rejected this presentation on a
live walkthrough (2026-07-06): records belong in the sections where they are
edited, like product records; the activity card should be a status-only analog
of Product Status. This reverses the documented "activity-first-class
Decision 1" (records render under the activity card) with the owner's explicit
approval.

## What Changes

- **BREAKING (presentation)**: activity-parented items, risks, and decisions
  render and are edited in the main record sections, grouped under an activity
  lane (keyed by `activityId`, labeled with the activity name), exactly like
  product records group under products.
- The Project Activities card loses its read-only record lists and becomes a
  status-only surface: activity name, linked products, floored traffic-light
  pills. (Stripped only AFTER the re-route lands — stripping first would make
  activity records invisible and unmanageable.)
- The priority-rank picker's taken-ranks set (`ownPeriodRanks`) includes
  activity-parented items.
- The unified by-state view receives activity entries (its Q1 alarm isolation
  is already pre-staged in `ItemCard` and `UnifiedActivitySection`).
- Storage is untouched: records stay in the flat section arrays with the XOR
  `productId`/`activityId` parent; only the read-model mappers and section
  rendering change.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `activity-reporting-unit`: the "Activities render on the lead form, slides,
  and head report like products" requirement changes for the LEAD FORM — the
  activity card no longer carries the records/risks/blockers presentation;
  records surface and are edited in the main record sections under an activity
  lane. Slides and head report presentation are unchanged.

## Impact

- `apps/web/src/lib/mappers/lead-form.ts` — `mapLeadItems`, `mapLeadRisks`,
  `mapLeadDecisions` stop filtering out activity-parented rows;
  `mapLeadActivityCards` keeps status data but its record lists become unused.
- `apps/web/src/components/lead/next-week-columns.ts` + the current-week
  sibling — column builders group strictly by registered product today; an
  activity item (`productId: ""`) matches no product and would silently vanish.
  Both need an activity-keyed lane.
- `apps/web/src/components/lead/lead-form.tsx` — `ownPeriodRanks`, unified
  entries feed.
- `apps/web/src/components/lead/activity-status-section.tsx` — RecordList
  removal (last step).
- Alarm derivation: NO change — the `activityId == null` gate in
  `deriveCardStatus` and the pre-staged Q1 isolation already handle activity
  items flowing through shared components.
- API/DB: none.
