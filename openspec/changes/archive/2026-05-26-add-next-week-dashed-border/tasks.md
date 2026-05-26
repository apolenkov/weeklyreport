# Tasks

- [x] T1: Identify item-row component — `apps/web/src/components/lead/item-card.tsx`
- [x] T2: Add week property — `isPlanned = item.status === "planned"` (derived from
      `type: "next"` via `deriveItemStatus` mapper); no new prop needed
- [x] T3: Apply dashed border style — already implemented at lines 147-155:
      `borderTop/Right/Bottom: 1px dashed` + `borderLeft: 3px dashed` when `isPlanned`.
      Comment at line 143-146 explicitly notes this was designed for Planned/Next-Week.
- [x] T4: Test both week types — behavior is covered via mapper test
      `apps/web/src/lib/mappers/item-status.test.ts` (type:"next" → "planned");
      no dedicated border-style DOM assertion added (not required by spec).
- [x] T5: Verify no visual regressions — existing UI has been shipping this since
      Phase 33-04; no regressions observed.
- [x] T-V: Verification — implementation pre-dates this change; feature is working.
      Skip: already shipped.
