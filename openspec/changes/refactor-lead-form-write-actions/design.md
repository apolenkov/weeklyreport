## Context

`apps/web/src/features/report-sections/ui/lead-form.tsx` is 2036 lines after
`refactor-lead-form-draft-orchestration`. The draft/version/autosave lifecycle
now lives in `useLeadFormDraftOrchestration`, but the component still owns the
write-side command layer:

Before flow:

`LeadForm` renders sections -> inline handlers call submit/revoke/reopen/fillFrom
mutations -> callbacks invalidate lead-form/history/dashboard queries, update
dialog state, call the draft hook's version/conflict APIs, and show toasts.

After flow:

`LeadForm` renders sections -> calls command handlers returned by
`useLeadFormWriteActions` -> the hook owns the four mutations plus submit,
revoke, and reopen dialog/error state -> record merge handlers and visible UI
composition stay in `LeadForm`.

Load-bearing invariants:

- Period dual-state: not touched; no API, service, repository, or database
  write shape changes.
- Role-coverage gate: not touched; no tRPC procedure or middleware changes.
- Deferred-feature pattern: not touched.
- Optimistic-lock behavior: preserved by continuing to consume the draft hook's
  `versionRef.current`, `setVersionSafe`, and conflict handler.

## Goals / Non-Goals

**Goals:**

- Move submit, revoke, reopen-request, and fill-from mutation orchestration into
  one feature-local hook.
- Keep version/conflict handling reviewable in one write-action boundary.
- Preserve current invalidation families, dialog transitions, toast strings, and
  mutation payloads.
- Reduce `lead-form.tsx` by another meaningful slice without touching record
  merge semantics.

**Non-Goals:**

- No backend, shared schema, Prisma, or tRPC procedure changes.
- No extraction of item/risk/decision/product/activity merge handlers.
- No route/query/visibility extraction.
- No `FormStateManager`, `ReportDataCoordinator`, or new cross-feature module.
- No UI layout, label, or toast-string changes.

## Decisions

### D1: Extract a feature-local hook, not pure functions

The boundary owns React state (`showSubmitConfirm`, `showReopenDialog`,
`reopenError`, `showRevokeDialog`) and TanStack mutations. Pure functions would
leave the real orchestration in `LeadForm`. The hook belongs next to
`lead-form.tsx` because it is UI command orchestration for this route.

Alternative rejected: move these writes to `model/`. That would either import
React/tRPC concerns into model or split the boundary into wrappers too small to
matter.

### D2: Keep draft payload construction and record merges outside the hook

Submit needs `draftPayload`, `unsetOwnStageCount`, and `versionRef.current`, but
the hook should receive those values as inputs instead of owning section merge
logic. This prevents the slice from becoming the deferred broad
`FormStateManager`.

Alternative rejected: move all form state and record handlers together. That
would mix command orchestration with payload semantics and expand review blast
radius.

### D3: Preserve the exact mutation callbacks first

The extraction should copy current success/error behavior before simplifying:
same invalidations, same conflict branching, same dialog close/error state, same
toast strings. Any cleanup that changes behavior belongs in a later spec.

Alternative rejected: normalize all mutation callbacks into a generic command
runner. The four writes have different side effects and a generic runner would
hide the important differences.

## Risks / Trade-offs

- Version stale-closure regression -> Keep submit and fill-from reading
  `versionRef.current` at call time, and keep existing tests that prove version
  bumps reach later writes.
- Conflict behavior regression -> Keep the draft hook's conflict handler as an
  injected dependency and test submit/fill-from conflict paths.
- Dialog state split confusion -> Return a small explicit object for dialog
  state/actions instead of many loose setters.
- Modest line reduction -> Acceptable; this is a safety boundary around writes,
  not a cosmetic line-count pass.

## Migration Plan

1. Confirm existing `LeadForm` tests cover submit success/error/conflict,
   fill-from conflict/version, revoke, and reopen request state.
2. Add any missing characterization test before moving code.
3. Extract `useLeadFormWriteActions` in the same feature folder and rewire
   `LeadForm` to consume it.
4. Update `architecture-refactor-backlog` with the actual post-slice LOC
   evidence before archive.
5. Run focused tests, scoped ESLint, `pnpm typecheck`, `pnpm lint`,
   `pnpm test`, and `openspec validate refactor-lead-form-write-actions
--strict`.

Rollback is a normal git revert; no persisted data or API surface changes.

## Open Questions

- None for this slice. The next likely slice after this should grill the record
  merge handler boundary separately.
