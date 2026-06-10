# Tasks — Fix Stale Add-Signal Dialog Reopen

NOT STARTED — captured 2026-06-10 (Wave 0: live durable-spec violation;
implement immediately).

> Execution note: Sequential single-writer edits only; parallel agents
> only for read-only analysis (repo lesson: parallel mechanical edits
> pass gates but break behavior).

All work is in `apps/web` (no shared/ui/api surface). Sections 1+2 land
as ONE commit — the regression tests fail until the fix exists, so they
cannot be committed alone. Before starting, re-run
`git status --short` and `openspec list`: a parallel session shipped
four commits on this exact surface today; confirm no second writer on
these files.

## 1. Web — regression tests (write first, watch them fail at HEAD)

- [ ] 1.1 NEW
      `apps/web/src/components/lead/risks-section-add-signal.test.tsx`:
      copy the 4-step scenario from
      `current-week-section-add-signal.test.tsx` (the D1 template),
      adapted to `RisksSection` (it takes `addSignal` directly as a
      prop, `risks-section.tsx:36`; pass one product and the other
      required props as in `risks-section.test.tsx`). Steps: render
      `addSignal={1} readOnly={false}` → dialog opens; cancel → closes;
      rerender `readOnly={true}` → no dialog; rerender
      `readOnly={false}` → assert NO dialog reopens. Run
      `pnpm --filter @customreport/web test risks-section-add-signal`
      and confirm step 4 FAILS at HEAD — this proves the live bug.
- [ ] 1.2 NEW
      `apps/web/src/components/lead/decisions-section-add-signal.test.tsx`:
      identical 4-step scenario for `DecisionsSection` (`addSignal`
      prop, `decisions-section.tsx:36`; create mode needs no product).
      Confirm it fails at HEAD the same way.

## 2. Web — the fix (one commit together with 1.1-1.2)

- [ ] 2.1 `apps/web/src/components/lead/risks-section.tsx`: above the
      effect at line 136, add the readOnlyRef pattern copied verbatim
      from `current-week-section.tsx:137-143`
      (`const readOnlyRef = useRef(readOnly); readOnlyRef.current =
readOnly;` plus the D1 comment); in the effect body replace
      `if (readOnly) return;` with `if (readOnlyRef.current) return;`;
      change deps `[addSignal, readOnly, firstProductId]` →
      `[addSignal, firstProductId]`. Add `useRef` to the React import.
      Keep `firstProductId` seeding untouched. Do NOT touch the display
      block — `require-risk-stage` task 2.1 owns it.
- [ ] 2.2 `apps/web/src/components/lead/decisions-section.tsx`: same
      surgery on the effect at lines 160-164; deps
      `[addSignal, readOnly]` → `[addSignal]`.
- [ ] 2.3 `apps/web/src/components/lead/lead-form.tsx`, `onViewVersion`
      handler (lines 1593-1598): inside the existing `if (v !== null)`
      block add `setRisksAddSignal(0);` and `setDecisionsAddSignal(0);`
      beside the two existing resets. No other lead-form edits
      (decomposition is gated by `architecture-refactor-backlog`).
- [ ] 2.4 Optional (dossier test contract): extend
      `apps/web/src/components/lead/lead-form.test.tsx` using its
      existing version-snapshot mock (~line 494 area): click
      "+ Add Risk", cancel, view a version, return — assert no dialog;
      pins the 4-counter `onViewVersion` reset at integration level.
- [ ] 2.5 Re-run 1.1/1.2 — both green. Run the pinned template
      `current-week-section-add-signal.test.tsx` — green with ZERO
      edits. Commit:
      `fix(lead): reset stale add-signal in risks and decisions sections`.

## 3. Verification

- [ ] 3.1 Gates:
      `pnpm typecheck && pnpm lint && pnpm test && pnpm build` —
      record results here.
- [ ] 3.2 Pinned suites green unchanged: `current-week-section-add-signal.test.tsx`,
      `risks-section.test.tsx` (incl. its "All stages" strings owned by
      `require-risk-stage` — do not touch),
      `risks-section.snapshot.test.tsx`,
      `decisions-section.snapshot.test.tsx`,
      `lead-form-sync-bridge.test.tsx` (risksAddSignal pass-through),
      `lead-form.test.tsx`.
- [ ] 3.3 Live-browser walk (driver-verify lesson: never trust
      unit-only): on the lead report page, "+ Add Risk" → cancel →
      view a snapshot version → "Back to current" → NO dialog opens;
      repeat for "+ Add Decision". User acceptance, then archive.
