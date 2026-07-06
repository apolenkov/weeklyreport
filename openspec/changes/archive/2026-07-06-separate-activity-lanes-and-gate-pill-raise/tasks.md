# Tasks

## 1. Board split — activity lanes below the product grid (D1)

- [x] 1.1 `next-week-columns.ts`: export `splitItemBoard(products, items)`
      returning `{ productColumns, activityLanes }`; `buildItemColumns` becomes
      the concat of both (tests keep passing unchanged).
- [x] 1.2 New `activity-lanes-block.tsx`: shared lighter block (dashed-top
      separator, "Activities" kicker, ≤3-column lane grid), lane header via
      `BoardColumnHeader`, item rendering injected by the host section.
- [x] 1.3 `current-week-section.tsx` + `next-week-section.tsx`: render product
      columns only in the grid; mount `ActivityLanesBlock` below it.
- [x] 1.4 Unit tests: `splitItemBoard` split semantics; the block renders lanes
      with `+ Add` and self-suppresses with no activity rows.

## 2. Pill raise gating (D2, D3, D4)

- [x] 2.1 New `lib/activity-alarm.ts` + test: `deriveActivityAlarmFloor(
activityId, risks)` — own non-empty risks, blocked→red else yellow.
- [x] 2.2 `activity-status-section.tsx`: `onRaiseRequiresRisk` prop; intercept
      unbacked raises (yellow ⇔ no floor, red ⇔ floor !== red); keep the
      lower-below-floor refusal.
- [x] 2.3 `lead-form-sync-bridge.tsx`: `RiskPrefillRequest.activityId?`;
      `risks-section.tsx`: forward into `openCreate` seed; `risk-edit-dialog.tsx`:
      `defaultActivityId` prop into `resolveRecordParent`.
- [x] 2.4 `lead-form.tsx`: overlay the live alarm floor onto `data.activityCards`
      for the interactive section; wire `onRaiseRequiresRisk` → severity-mapped
      risk prefill (yellow→at-risk, red→blocked) on the `routeToBlocker` channel.
- [x] 2.5 Tests: rewrite `activity-status-section.test.tsx` raise cases (unbacked
      raise → `onRaiseRequiresRisk`, no `onStatusChange`); keep legacy lower-with-
      no-floor allowed; covered raise at the floor severity stays a plain pick.

## 3. Verify

- [x] 3.1 Full gates green (db:generate → typecheck → lint → unit).
- [x] 3.2 Live-verify on :3000: lanes render below the grid in both weeks;
      unbacked pill raise opens the risk dialog with the activity preselected;
      saving floors the pill immediately; cancel leaves it unchanged.
