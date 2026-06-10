# Design — Refactor Lead Dialog Lifecycle

## Context

After Wave-0 `fix-section-add-signal-reset` lands, all four lead
sections carry semantically identical dialog lifecycles (the D1
readOnly-ref add-signal effect, openSeq keying, pendingDelete), which
makes a behavior-preserving extraction safe. The donors are
`current-week-section.tsx` and `next-week-section.tsx` (shipped in
ba3adf1d); the D12 mount/unmount shell canon is
`item-edit-dialog.tsx:101-113`. Line refs throughout were verified at
HEAD 85541470 and WILL shift once Wave-0 and `require-risk-stage`
land — re-locate by the quoted comments/identifiers, not by line
number.

## Goals / Non-Goals

**Goals:** one tested hook owning the section-side dialog lifecycle;
one structural reset pattern for the two edit dialogs; zero behavior
change observable by the existing test suite.

**Non-goals:** the Wave-0 bug fix itself; `lead-form.tsx`
decomposition; any change to the LeadFormSyncBridge contract; UI
redesign.

## Decisions

### D1 — `useEditableListDialog` hook interface

Home: `apps/web/src/hooks/use-editable-list-dialog.ts`, tests beside
(precedent: `use-lead-form-autosave.ts`). Generic over the entity type
only; sketch:

```ts
type EditableListDialogState<TEntity> =
  | { open: false }
  | { open: true; mode: "create"; seedProductId?: string }
  | { open: true; mode: "edit"; entity: TEntity };

function useEditableListDialog<TEntity>(options: {
  readonly readOnly: boolean;
  /** External "+ Add" counter; 0 = idle. */
  readonly addSignal: number;
  /** Stays in the effect deps — canonical in all four copies. */
  readonly seedProductId?: string;
  /** current/next-week require a seed product to open from the signal. */
  readonly requireSeed?: boolean;
}): {
  dialogState: EditableListDialogState<TEntity>;
  /** openSeq-derived key (D13) — port of deriveDialogProps. */
  dialogKey: string;
  openCreate: (seedProductId?: string) => void; // no-op when readOnly
  openEdit: (entity: TEntity) => void; // no-op when readOnly
  close: () => void;
  pendingDelete: TEntity | null;
  requestDelete: (entity: TEntity) => void; // no-op when readOnly
  clearPendingDelete: () => void;
};
```

The addSignal effect keeps the shipped D1 semantics **byte-for-byte**:

```ts
const readOnlyRef = useRef(readOnly);
readOnlyRef.current = readOnly; // ref-write during render — keep verbatim

useEffect(() => {
  if (addSignal === 0) return;
  if (readOnlyRef.current) return; // + seed guard when requireSeed
  // openSeq++ then open create mode
}, [addSignal, seedProductId]);
```

Do NOT "improve" the ref-write to an effect-sync — that changes timing
and can silently re-open the D1 bug class. Verify
`react-compiler/react-compiler` and `react-hooks` rules stay quiet.
Stop-rule: if the generic needs a second type parameter or conditional
types, inline the quirk caller-side instead (simplicity-first).

### D2 — D12 shell replicated per dialog, no generic `DialogShell` export

A generic JSX wrapper evaluates `children` eagerly, defeating the
mount/unmount state reset, unless it takes a render-prop — more
ceremony than the canonical 3-line shell `item-edit-dialog.tsx`
already documents. So each dialog gets its own shell: the outer
component returns `null` when `!open` and mounts a `*DialogContent`
component whose `useState` initializers seed from props at mount. This
deletes `"use no memo"`, the reset effect, and both eslint-disables in
each dialog, and makes the A13/A15 invariant (`stagesForProduct` never
read in deps) structural.

### D3 — What stays caller-side

- `wasEmpty`/`onRiskFilled` — risks-section `handleDialogSave` wrapper.
- Decision `productName` fallback (`"Group"`) — decisions-section save.
- Seed product resolution (`firstProductId`/`defaultProductId`).
- LeadFormSyncBridge plumbing byte-identical: `risksAddSignal` at
  bridge lines 80, 277, 400-401 — prop names and pass-through untouched.

### D4 — Stale-signal-vs-seed-change residual channel: explicit decision

With seed ids in the effect deps (canonical), a products-list change
while a stale non-zero signal exists re-opens the dialog — a residual
spec-violation channel. Recommended: close it inside the hook with a
`lastHandledSignal` ref (open only when `addSignal > lastHandled`),
but only as an explicit, tested decision recorded in task 1.1 — never
silently. All four add-signal regression tests pass either way.

### D5 — Unified openSeq keying (D13)

Risks/decisions currently key their dialogs on a
`` `${dialogState.open}-${id}` `` shape (risks-section.tsx:291,
decisions-section.tsx:270). Both switch to the hook's openSeq-derived
`dialogKey` (current-week `deriveDialogProps` shape) so repeated opens
of the same entity always remount fresh.

### D6 — Drop the redundant `groupSyncKey` prop

The only producer (`handleToggleAll`, lead-form.tsx:1436-1439) always
flips `groupExpanded`, so the sync effect fires on `[groupExpanded]`
alone; the counter only matters for re-imposing the same value twice,
which no code path can do. Mount behavior is unchanged — the effect
already overwrites `defaultOpen` on first render.

## Invariants (load-bearing)

- period dual-state, role-coverage gate, destructive-db guard,
  deferred-feature pattern: untouched (no API, schema, or write-path
  changes).
- `lead-report-controls-integrity`: preserved and made structural —
  this spec is the acceptance contract (no delta needed; behavior is
  unchanged).

## Acceptance contract

- All `lead-report-controls-integrity` scenarios pass unmodified.
- Zero-edit green through every commit:
  `current-week-section-add-signal.test.tsx`,
  `risks-section-add-signal.test.tsx` and
  `decisions-section-add-signal.test.tsx` (created by Wave-0),
  `risk-edit-dialog.test.tsx` ("A13/A15 form-race regression" describe
  - "Select at least one stage."), `decision-edit-dialog.test.tsx`
    (A13 + VA-0a), `risks-section.test.tsx`,
    `risks-section.snapshot.test.tsx`,
    `decisions-section.snapshot.test.tsx`,
    `lead-form-sync-bridge.test.tsx`, `item-edit-dialog.test.tsx`.
- New: `use-editable-list-dialog.test.tsx`; "reopen after cancel
  renders fresh state" cases added to both dialog tests.

## Risks / Trade-offs

- [Revert-bait lesson] a prior mechanical refactor here passed all
  gates yet broke behavior → sequential single-writer edits, one
  section/dialog per commit, full gates + human diff review per commit.
- [React Compiler] deleting `"use no memo"` re-enables memoization;
  the A13/A15 autosave-invalidate form-race is only partially
  reproducible in unit tests → re-verify in the live browser.
- [Parallel sessions] this area shipped 4 commits today → re-run
  `git status` + `openspec list` before starting; collision is likely,
  not theoretical.
- [require-risk-stage] may rewrite risks-section display strings
  between our commits → rebase and re-run its pinned tests before the
  risks-section task.
