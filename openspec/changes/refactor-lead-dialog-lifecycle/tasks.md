# Tasks — Refactor Lead Dialog Lifecycle

Decisions D1-D6: `design.md`. Evidence anchors: `proposal.md` (verified
at HEAD 85541470 — line numbers WILL have shifted after Wave-0 and
`require-risk-stage`; re-locate by quoted comments/identifiers).

**Execution note (standing):** Sequential single-writer edits only;
parallel agents only for read-only analysis (repo lesson: parallel
mechanical edits pass gates but break behavior). One task = one commit;
run full gates and read the whole diff before each commit.

## 0. Preconditions (hard gate — do not start otherwise)

- [x] 0.1 Wave-0 `fix-section-add-signal-reset` is implemented and
      archived: `risks-section.tsx` and `decisions-section.tsx` carry
      the readOnlyRef pattern (deps without `readOnly`),
      `lead-form.tsx` `onViewVersion` resets all four add-signal
      counters, and `risks-section-add-signal.test.tsx` +
      `decisions-section-add-signal.test.tsx` exist and are green.
- [x] 0.2 `require-risk-stage`, `fix-lead-stripe-and-archived-badges`
      (archived — same lead surface; live verification needs a settled
      surface), and `refactor-lead-mappers` have landed
      (`openspec list` no longer shows them active); rebase onto
      current `main` and re-run the risks-section pinned tests.
- [x] 0.3 No second writer: `git status --short` shows no foreign edits
      under `apps/web/src/components/lead/`; `openspec list` shows no
      other active change claiming these files.

## 1. Web — hook

- [x] 1.1 feat(web): add `apps/web/src/hooks/use-editable-list-dialog.ts` + `use-editable-list-dialog.test.tsx` (no consumers yet).
      Implement the D1 interface from `design.md`: DialogState union,
      readOnlyRef ref-write-during-render copied verbatim from
      `current-week-section.tsx` ("Keep a ref so the addSignal effect…"
      block at 138-143), addSignal effect with seed in deps, openSeq
      counter incremented on every open, `dialogKey` ported from
      `deriveDialogProps` (current-week-section.tsx:52), pendingDelete + readOnly guards on openCreate/openEdit/requestDelete. Decide
      and record the D4 `lastHandledSignal` question here (recommended:
      close the channel, with a test). renderHook tests: signal opens
      create mode; stale non-zero signal + readOnly false→true→false
      does NOT reopen; openSeq monotonic across repeated opens;
      pendingDelete set/confirm/cancel; readOnly blocks
      open/edit/delete.

## 2. Web — section adoption (behavior-preserving, one commit each)

- [x] 2.1 refactor(lead): adopt the hook in
      `current-week-section.tsx` AND `next-week-section.tsx` (the two
      near-identical donors; lowest divergence risk). Delete the local
      DialogState/openSeq/readOnlyRef/pendingDelete code, keep
      `deriveDialogProps` consumers fed by the hook's `dialogKey`.
      Acceptance: ALL existing tests green with zero edits, including
      `current-week-section-add-signal.test.tsx`.
- [x] 2.2 refactor(lead): adopt the hook in `risks-section.tsx` (own
      commit — riskiest). `addSignal` arrives via LeadFormSyncBridge
      context (`lead-form-sync-bridge.tsx:277,400-401`) — plumbing and
      prop names stay byte-identical. `firstProductId` seeding stays in
      the effect deps; `wasEmpty`/`onRiskFilled` stays in the local
      `handleDialogSave` wrapper. Switch the `RiskEditDialog` key
      (risks-section.tsx:291, `${dialogState.open}-id` shape) to the
      hook's openSeq `dialogKey` (D5). Green unchanged:
      `risks-section-add-signal.test.tsx`, `risks-section.test.tsx`
      (incl. strings rewritten by require-risk-stage — do not touch),
      `risks-section.snapshot.test.tsx`,
      `lead-form-sync-bridge.test.tsx`.
- [x] 2.3 refactor(lead): adopt the hook in `decisions-section.tsx`.
      Create mode has no seed product — the hook's optional seed covers
      it. Switch the `DecisionEditDialog` key
      (decisions-section.tsx:270) to `dialogKey`. Green unchanged:
      `decisions-section-add-signal.test.tsx`,
      `decisions-section.snapshot.test.tsx`.

## 3. Web — D12 dialog shells (D2)

- [x] 3.1 refactor(lead): convert `risk-edit-dialog.tsx` to the D12
      shell. Replicate `item-edit-dialog.tsx:101-113` exactly: outer
      `RiskEditDialog` returns null when `!open` and mounts
      `RiskEditDialogContent`; state seeding moves from the deleted
      reset effect (137-164) into mount-time `useState` initializers;
      delete `"use no memo"` (line 97) and both eslint-disable lines.
      Pin: the whole "A13/A15 form-race regression" describe and the
      "Select at least one stage." guard pass unchanged. Extend
      `risk-edit-dialog.test.tsx`: "reopen after cancel renders fresh
      state". Then verify the form-race in the live browser (typed
      text/severity survive an autosave→invalidate cycle) — unit tests
      cannot fully reproduce it.
- [x] 3.2 refactor(lead): convert `decision-edit-dialog.tsx` — same
      surgery: delete `"use no memo"` (line 44) and the reset effect
      (68-90); state moves to mount-time initializers. A13 block and
      VA-0a tests green unchanged; extend
      `decision-edit-dialog.test.tsx` with the fresh-state-on-reopen
      case.

## 4. Web — drop redundant groupSyncKey (D6)

- [x] 4.1 refactor(web): remove the `groupSyncKey` prop. In
      `accordion-section.tsx`: delete the prop declaration (line 36)
      and destructure (line 51), rewrite the JSDoc (29-35), keep the
      guard only for `groupExpanded === undefined`, effect deps →
      `[groupExpanded]`. In `lead-form.tsx`: delete the state (line
      648), the `setGroupSyncKey` call in `handleToggleAll` (1438),
      all 5 prop-pass sites (1681, 1694, 1735, 1774, 1810), and update
      the comment at 643-647. In `report-shell.test.tsx`: rewrite the
      "syncs to groupExpanded when groupSyncKey changes" test
      (142-167) to rerender with only `groupExpanded` changing.

## 5. Verification

- [x] 5.1 Gates after EVERY commit and finally:
      `pnpm typecheck && pnpm lint && pnpm test && pnpm build` —
      record results here. FINAL (HEAD 13fa93c7): typecheck OK,
      lint OK (eslint + stylelint + prisma typecheck), test OK
      (api 80 + shared 16 + web 113 test files; web 1054 tests),
      build OK. Per-task targeted gates (typecheck + lint + web
      vitest) ran green on every commit. Post-review fix (commit
      8a5b128f): openCreate kept identity-stable across readOnly so
      the risks chip-raise (addPrefill) effect cannot reopen the
      dialog on a snapshot round-trip; regression test added (fails
      on the prior hook, passes on the fix). Final gates re-run green
      after the fix.
- [ ] 5.2 Live browser walk (driver-verify lesson: never trust
      unit-only): "+ Add Risk" → cancel → view snapshot → "Back to
      current" → no dialog reopens; same for Decision; risk-dialog
      form-race (3.1); Toggle All still syncs all sections after 4.1.
- [ ] 5.3 Confirm acceptance contract: `lead-report-controls-integrity`
      scenarios + every pinned test file from `design.md` green with
      zero edits. User acceptance, then `openspec archive`.
