# Tasks

## 1. Characterization pins (must land green BEFORE any restructuring)

- [x] 1.1 Pin autosave behavior at the `lead-form.tsx` level: debounce cadence, flush-on-save-now, no save when clean — write mutations behind a fake draft seam, the read query behind the repo's web tRPC test harness
- [x] 1.2 Pin save-echo classification and optimistic-lock conflict handling (concurrent-version dialog path); reseed is driven by the read query, so drive it through the harness
- [x] 1.3 Pin quick-add, routeToBlocker, and activity-raise-requires-risk flows end-to-end through the rendered form, including the pending-value-driven dialog/prefill renders
- [x] 1.4 Pin submit gating incl. `submitReadiness` button-disabled state, the unset-stage warning path, and the submit/revoke/reopen/fill-from dialog state machines; assert invalidation as calls on the fake seam (real QueryClient behavior out of scope)

## 2. Deep module

- [x] 2.1 Rename/extend `use-lead-form-draft-orchestration.ts` into `use-lead-form-draft.ts` exposing the design's handle (incl. `version`, `submitReadiness`, `pendingQuickAdd`/`pendingRiskPrefill` + clear fns); fold in merge routing (`apply(patch)`, preserving functional-updater patches for the sync-bridge feeds) and submit context
- [x] 2.2 Extract the draft-facing slice of `use-lead-form-write-actions.ts` (save/submit mutations + invalidation callbacks) as the injected `LeadFormDraftSeam`; the write-actions module SURVIVES owning submit-confirm/revoke/reopen/fill-from dialog lifecycle, calling the handle's `submit` and receiving `version` as an argument (no shared `versionRef`)
- [x] 2.3 Delete `writeActionSubmitContextRef` and `draftMergeContextRef` from `lead-form.tsx`; loaded view-model context enters the module as render args; at most ONE module-internal ref inside `use-lead-form-draft.ts` bridges render→callback scope
- [x] 2.4 Move the four UI add-signal counters into a new `use-lead-form-add-signals.ts`; thin `use-lead-form-draft-merges.ts` out of existence or down to re-exports of the branching logic now inside the module; inline pass-through wrappers at call sites via `apply(patch)`; keep `lead-form-draft-merge-helpers.ts` as pure patch constructors

## 3. Narrow interfaces

- [x] 3.1 Replace `LeadFormLoaded`'s `ReturnType<typeof useX>` props with purpose-built slices; propagate to `LeadFormItemSections`, `LeadFormDialogs`, `LeadFormEditSections`; consumers of `getSubmitReadiness()` switch to the handle's `submitReadiness`
- [x] 3.2 Update unit tests to construct the narrow props/fakes; behavioral assertions carry over unweakened

## 4. Gates

- [x] 4.1 `pnpm typecheck`
- [x] 4.2 `pnpm lint`
- [x] 4.3 `pnpm test`
- [x] 4.4 Verify section-1 characterization tests are byte-unchanged since task 1.4 (`git diff` scoped to those files must be empty)
- [x] 4.5 Live verify from source: dev-login as a lead, edit items/risks, quick-add, save-now, submit with unset stages, reload and confirm persistence
