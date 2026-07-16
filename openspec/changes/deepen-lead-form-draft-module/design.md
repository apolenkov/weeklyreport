## Context

`lead-form.tsx` orchestrates `useLeadFormData`, `useLeadFormDraftOrchestration`, `useLeadFormDraftMerges`, `useLeadFormWriteActions`, autosave, and a view-model, threading them into `LeadFormLoaded` as 17 props. Hooks can't call each other directly (hook-ordering/stale-closure constraints), so `lead-form.tsx:74-108,171-198` refreshes `writeActionSubmitContextRef` and `draftMergeContextRef` every render to smuggle live data into callback scope across files. `use-lead-form-draft-orchestration.ts:56-233` (reconciliation, save-echo classification, optimistic-lock versioning) is the one genuinely deep part and becomes the core of the merged module.

A pre-implementation adversarial design review (2026-07-16) reshaped the scope: `useLeadFormWriteActions` is mostly DIALOG lifecycle (submit-confirm/revoke/reopen/fill-from), not draft state — it survives as its own module; only its draft-facing slice folds in. Four merge handlers are UI add-signal counters, not draft patches — they move to a dedicated hook, not into the draft module.

## Goals / Non-Goals

**Goals:** one module owning the draft lifecycle behind a small handle; zero CROSS-FILE mutable-ref protocols; narrow prop interfaces downstream; the ref-ordering class of bug becomes unit-testable.

**Non-Goals:** visual or behavioral changes; reducing file count for its own sake; touching `buildStageGrid`/read-model mapping; absorbing dialog lifecycle state (submit-confirm/revoke/reopen/fill-from dialogs stay in `use-lead-form-write-actions.ts`); characterizing real QueryClient cache invalidation (asserted at the fake-seam call level only).

## Interface (the deliverable)

```ts
// apps/web/src/features/report-sections/ui/use-lead-form-draft.ts
function useLeadFormDraft(args: {
  section: ReportSectionReadModel; // loaded server state (reseed source)
  reportId: string;
  loaded: LeadFormLoadedContext; // per-render view-model inputs (products,
  // activities, stages, ownRisks, week items) —
  // plain render args, re-passed every render
  seam: LeadFormDraftSeam; // injected: saveSection/submit mutations +
  // invalidation callbacks — tests pass a fake
}): {
  draft: ReportSectionReadModel;
  dirty: boolean;
  autosave: AutosaveSnapshot; // existing type, unchanged
  version: number; // optimistic-lock version (module owns it;
  // fill-from in write-actions receives it as an arg)
  save: () => Promise<void>;
  submit: (ctx: SubmitContext) => Promise<SubmitOutcome>;
  submitReadiness: SubmitReadiness; // derived from draft — moves here from
  // write-actions' getSubmitReadiness()
  apply: (patch: DraftPatch) => void; // single entry for ALL draft merges
  // genuinely branching handlers + their pending-request VALUES (consumers render
  // dialogs/prefills from the values, not just the triggers):
  quickAdd: (req: QuickAddRequest) => void;
  pendingQuickAdd: QuickAddItem | null;
  clearQuickAdd: () => void;
  routeToBlocker: (req: RiskPrefillRequest) => void;
  pendingRiskPrefill: RiskPrefillRequest | null;
  clearRiskPrefill: () => void;
};
```

`DraftPatch` is the discriminated union the current merge helpers already imply (`lead-form-draft-merge-helpers.ts` stays as the pure patch constructors — it is already a good shallow-helper file feeding a deep module).

## Decisions

1. **`use-lead-form-draft-orchestration.ts` is the seed**, not a rewrite target: fold merge routing, submit context, and optimistic-lock version ownership INTO it (renamed `use-lead-form-draft.ts`), rather than creating a new parallel implementation.
2. **Both CROSS-FILE refs die; ONE module-internal ref is sanctioned.** The live view-model data a callback needs (`loaded`) enters as plain render args; inside `use-lead-form-draft.ts` a single internal ref may bridge render scope → callback scope. The invariant is locality, not ref-abstinence: no ref protocol crosses a file boundary, so the refresh ordering is testable in one unit.
3. **`useLeadFormWriteActions` SURVIVES as the dialog-lifecycle module** (submit-confirm, revoke, reopen, fill-from dialogs and their mutations, incl. `getSubmitReadiness` consumers switching to the handle's `submitReadiness`). Its draft-facing slice moves: the save/submit mutations and invalidation callbacks become the injected `LeadFormDraftSeam`; the submit flow calls the draft module's `submit`; carry-over `handleFillFrom` receives `version` from the handle instead of sharing `versionRef`.
4. **UI add-signal counters (`currentWeekAddSignal` et al., `use-lead-form-draft-merges.ts:50-53`) are NOT draft state**: they move to a tiny `use-lead-form-add-signals.ts` hook. The remaining genuinely branching logic (`quickAdd`, `routeToBlocker`, activity-raise-requires-risk) folds into the draft module WITH its pending-request values (`pendingQuickAdd`, `pendingRiskPrefill`) — consumers render from the values (`lead-form-dialogs.tsx:147-152`, `lead-form-edit-sections.tsx:110`). Pass-through one-line wrappers are inlined at call sites via `apply(patch)`.
5. **`apply(patch)` preserves functional-updater semantics.** `handleProductsChange`/`handleRisksChange` feed `LeadFormSyncBridge.Provider` with updater functions (`lead-form-sync-bridge.tsx:265-268`); the module's merge entry must accept the same updater-based patches so sync-bridge behavior is byte-identical. Sync-bridge itself is out of scope beyond imports.
6. **Downstream props:** `LeadFormItemSections`/`LeadFormDialogs`/`LeadFormEditSections` each declare their OWN small props interface (the fields they read), populated at the `LeadFormLoaded` seam. No `ReturnType<typeof useX>` in any props type.
7. **Characterization before restructuring:** pin autosave debounce/flush behavior, save-echo classification outcomes (via the repo's web tRPC test harness — reseed is driven by the READ query, so the read seam is mocked with the harness, not hand-faked), optimistic-lock conflict dialog, quick-add + routeToBlocker flows, submit gating (unset-stage warning path), and the dialog open/close state machines at the `lead-form.tsx` render level. Invalidation is asserted as calls on the fake seam; real QueryClient behavior is explicitly out of scope. These tests must survive the refactor UNTOUCHED.
8. **Slice discipline:** this change is the draft-state slice recorded in `architecture-refactor-backlog`; toolbar chrome, slides mode, and sync-bridge internals stay out.

## Risks / Trade-offs

- Hottest user path in the product — the characterization suite is the safety net and its assertions may not be weakened (a known failure mode of implementation lanes; the review gate diffs tests first).
- Hook-ordering constraints are real: merging must preserve a single stable hook order; no conditional hooks.
- `use-lead-form-data.test.tsx`, `lead-form-sync-bridge.test.tsx` and sibling tests reference current shapes; they are updated mechanically but their BEHAVIORAL assertions carry over 1:1.
- The handle is ~16 fields, not 8 — honest for a controlled-form module (cf. `use-risk-edit-dialog.ts`); depth is measured by what callers no longer have to know (no refs, no hook-blob props), not by field count.
- Rollback: single revertable commit; no schema/contract surface.
