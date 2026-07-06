# Tasks — route activity records into the main record sections

## 1. Re-route the read model (mappers + lanes land together)

- [x] 1.1 `mapLeadItems` / `mapLeadRisks` / `mapLeadDecisions` include
      activity-parented rows; parent label resolves to the activity name
      (tests: an activity item/risk/decision appears in the mapped arrays with
      `activityId` set and the activity name as its display parent)
- [x] 1.2 `buildItemColumns` (`next-week-columns.ts`) + the current-week
      grouping gain activity lanes: products first, then one lane per
      activity that owns rows, keyed by `activityId`, labeled with the
      activity name (tests: an activity item lands in its lane, never dropped,
      never under a product)
- [x] 1.3 Unified view feed: `unifiedEntries` receives activity items; bucket
      derivation unchanged (test: activity item appears in its state bucket)

## 2. Editing parity

- [x] 2.1 Edit/delete an activity record from its section round-trips through
      the existing merge handlers with `activityId` preserved (test at the
      lead-form level: edit an activity item → draft payload keeps the XOR
      activity parent)
- [x] 2.2 `ownPeriodRanks` includes activity items (test: rank held by an
      activity item is reported taken)

## 3. Status-only activity card

- [x] 3.1 Strip `RecordList` from `activity-status-section.tsx`; card keeps
      name, linked products, floored pills (update the card's tests; ONLY
      after 1.x–2.x are green)

## 4. Verify

- [x] 4.1 Full gates green (typecheck, lint, unit)
- [ ] 4.2 Live check on :3000 (small seed): activity records visible/editable
      in sections, card status-only, no double render, foreign view read-only
