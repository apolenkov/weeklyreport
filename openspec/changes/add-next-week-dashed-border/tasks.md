# Tasks

- [ ] T1: Identify item-row component — locate the rendering logic in
      `apps/web/src/components/lead/item-row.tsx` (or similar)
- [ ] T2: Add week property — confirm the component receives a prop or can
      determine whether the item is in the current week or next week
- [ ] T3: Apply dashed border style — add a Tailwind or CSS class that applies
      `border-dashed` (or `border-style: dashed`) only for next-week items
- [ ] T4: Test both week types — render lead section with current and next week
      items side-by-side, verify border styles are distinct
- [ ] T5: Verify no visual regressions — check that dashed border does not
      overlap with any badges or action buttons
- [ ] T-V: Verification — `pnpm typecheck`, `pnpm lint` pass; manual spot-check
      in dev lead form
