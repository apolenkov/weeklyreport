## Why

The lead-form draft flow is a shallow-module cluster: `lead-form.tsx` calls six hooks in sequence and smuggles live render-scope data between them through two mutable refs it repopulates every render (`writeActionSubmitContextRef`, `draftMergeContextRef`) because the hooks were split along the 250-line budget, not along the domain. `LeadFormLoaded` takes 17 props, three of them whole `ReturnType<typeof useX>` blobs; `useLeadFormDraftMerges` exposes 25 properties of which ~15 are one-line pass-through wrappers. A bug in the ref-refresh ordering is unit-untestable today — it can only surface as a flaky e2e failure on the product's hottest path (weekly lead entry, the product north star). The `architecture-refactor-backlog` spec records lead-form as a decomposition target advanced in recorded slices; this is the draft-state slice.

## What Changes

- Introduce one deep draft module `useLeadFormDraft` owning draft state + reconciliation + save/save-echo + optimistic-lock versioning + submit readiness + submit + merge routing behind one handle (see design.md Interface), growing out of `use-lead-form-draft-orchestration.ts` (which already holds the real complexity) and absorbing the cross-hook wiring that currently lives in `lead-form.tsx`.
- Eliminate both cross-file context-smuggling refs — loaded view-model context enters the module as render args; at most one module-internal ref bridges render→callback scope inside one file.
- Keep `useLeadFormWriteActions` as the dialog-lifecycle module (submit-confirm/revoke/reopen/fill-from); its draft-facing slice (save/submit mutations + invalidations) becomes the injected `LeadFormDraftSeam`.
- Thin `useLeadFormDraftMerges` to its genuinely branching logic (`handleQuickAdd`, `routeToBlocker`, `handleActivityRaiseRequiresRisk`) with their pending-request values on the handle; the four UI add-signal counters move to a dedicated `use-lead-form-add-signals.ts`; pass-through wrappers are inlined at their call sites against the module's `apply(patch)`.
- Narrow `LeadFormLoaded` and its children (`LeadFormItemSections`, `LeadFormDialogs`, `LeadFormEditSections`) to purpose-built prop slices instead of `ReturnType<typeof useX>` blobs.
- Behavior-identical: autosave cadence, save-echo classification, optimistic-lock conflict handling, quick-add, submit gating and dialog flows all pinned by characterization tests before restructuring.

## Capabilities

### New Capabilities

- `lead-form-draft-module`: the draft flow is one deep module with a small interface; no cross-file ref smuggling; components receive narrow prop slices.

### Modified Capabilities

<!-- none -->

## Impact

- Web: `apps/web/src/features/report-sections/ui/` — `lead-form.tsx`, `lead-form-loaded.tsx`, `use-lead-form-draft-orchestration.ts`, `use-lead-form-draft-merges.ts`, `use-lead-form-write-actions.ts`, `use-lead-form-data.ts`, `lead-form-item-sections.tsx`, `lead-form-dialogs.tsx`, `lead-form-edit-sections.tsx`, plus their tests; `apps/web/src/hooks/use-lead-form-autosave.ts` wiring.
- API: none. Shared: none. No tRPC contract or persistence change.

## Non-goals

- Changing any user-visible behavior of the lead form.
- Touching the sync-bridge render path (`lead-form-sync-bridge.tsx`) beyond import updates — its severity-floor logic is `dedupe-severity-floor-ranking`'s territory.
- Relitigating file-count or the 250-line budget: the deepened module may span several implementation files; the interface, not the file layout, is the deliverable.
