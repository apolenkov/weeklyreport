# Refactor Lead Dialog Lifecycle

## Why

Four lead report sections each hand-copy the same dialog lifecycle: a
`DialogState` union, an effect that opens the dialog from the toolbar
"+ Add" counter, pending-delete confirmation, and save/cancel closing.
Copies drift — two of them (risks, decisions) missed the D1
readOnly-ref fix and today violate the durable spec
`lead-report-controls-integrity` ("a view-state transition MUST NOT
open any dialog"). That live bug ships first as Wave-0
`fix-section-add-signal-reset`; this change removes the duplication
that let it happen. On top, both edit dialogs still reset form state
via a `"use no memo"` directive plus a double-eslint-disabled effect —
the canonical D12 mount/unmount shell (`item-edit-dialog.tsx:101-113`)
makes both structurally unnecessary.

Evidence verified at HEAD 85541470: donors
`current-week-section.tsx` (readOnlyRef 142-143, openSeq 125,
`deriveDialogProps` 52) and `next-week-section.tsx:76-124`; pre-fix
copies `risks-section.tsx:136-144`, `decisions-section.tsx:160-164`;
directives `risk-edit-dialog.tsx:97` (reset 137-164) and
`decision-edit-dialog.tsx:44` (reset 68-90). Same surface, one bonus
subtraction: `AccordionSection.groupSyncKey` (accordion-section.tsx:36,
effect 59-62) is redundant — its only producer, `handleToggleAll`
(`lead-form.tsx:1436-1439`), always flips `groupExpanded`, so the
effect fires without the counter.

## What Changes

1. New `useEditableListDialog` hook (`apps/web/src/hooks/`) owning
   `DialogState`, the addSignal effect with D1 readOnly-ref semantics,
   openSeq keying (D13), and pendingDelete — with renderHook tests.
2. All four sections adopt the hook, behavior-preserving; existing
   tests pass with zero edits.
3. `RiskEditDialog` and `DecisionEditDialog` convert to the D12
   mount/unmount shell, deleting `"use no memo"` and the suppressed
   reset effects.
4. Drop the redundant `groupSyncKey` prop (accordion-section.tsx,
   lead-form.tsx, report-shell.test.tsx).

**Non-goals:** the live add-signal reset fix (Wave-0
`fix-section-add-signal-reset` ships it first — cross-reference);
`lead-form.tsx` decomposition (gated by `architecture-refactor-backlog`);
risks-section display strings (owned by `require-risk-stage`); a
generic exported `DialogShell` component (design.md D2); silently
closing the seed-deps stale-signal channel (explicit decision,
design.md D4).

## Sequencing

Wave 2 — LAST of the lead cluster: starts only after
`require-risk-stage` lands (file contention on `risks-section.tsx`)
and after `refactor-lead-mappers` lands. Hard gate: single-writer on
the lead surface.

## Capabilities

### New Capabilities

<!-- none: behavior-preserving refactor -->

### Modified Capabilities

<!-- none: openspec/specs/lead-report-controls-integrity/spec.md is the
unchanged acceptance contract — its scenarios plus the existing section
and dialog tests must pass unmodified -->

## Impact

- `apps/web/src/hooks/use-editable-list-dialog.ts` (+ test) — new.
- `apps/web/src/components/lead/`: current-week-section.tsx,
  next-week-section.tsx, risks-section.tsx, decisions-section.tsx,
  risk-edit-dialog.tsx (+ test), decision-edit-dialog.tsx (+ test).
- `apps/web/src/components/report-shell/accordion-section.tsx`,
  `lead-form.tsx`, `report-shell.test.tsx` (groupSyncKey removal).
- Read-only references: `item-edit-dialog.tsx` (D12 canon),
  `lead-form-sync-bridge.tsx` (risksAddSignal plumbing stays
  byte-identical).
