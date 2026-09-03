## Context

See `proposal.md` for motivation. The existing draft implementation already owns reconciliation and autosave mechanics, but its external seam is split across `useLeadFormDraft`, `useLeadFormEditing`, `useLeadFormWriteActions`, `useLeadFormQuickAdd`, and the `LeadForm` shell. Internal refs, setters, mutation objects, and optimistic-lock values cross those seams. The current `LeadFormDraftSeam` covers only submit while the other write adapters are created by separate hooks.

The durable contracts are `lead-form-draft-module`, `lead-form-draft-orchestration`, and `lead-form-loaded-view-model`. This change must preserve their product semantics and all three load-bearing repository invariants.

## Goals / Non-Goals

**Goals:**

- Give callers one declared `LeadFormEditorHandle` rather than several inferred hook results.
- Put all server writes behind one `LeadFormWritePort`.
- Keep implementation-only state and sequencing inside the module.
- Test the complete draft lifecycle through the same interface used by `LeadForm`.

**Non-Goals:**

- Moving presentation rendering, route resolution, or server reads into the editor module.
- Changing debounce timing, messages, cache invalidation, authorization, or server contracts.
- Introducing a generic application-wide command framework.

## Decisions

### One external seam, internal composition

Add a feature-local `useLeadFormEditor` module whose declared interface exposes stable state snapshots and named commands required by the durable spec. Existing draft, autosave, quick-add, confirmation, and generation hooks may remain as internal seams, but callers will not import or coordinate them.

Alternative considered: merge all implementation into one file. Rejected because depth is leverage at the interface, not file size; private internal seams retain locality and readable tests.

### One owned-network write port

Define `LeadFormWritePort` beside the editor interface with promise-based methods for save draft, submit, fill-from, revoke, and reopen plus their pending state. The production tRPC adapter owns transport calls and current cache invalidation. An in-memory adapter drives deterministic interface tests.

Alternative considered: keep one seam per mutation. Rejected because it exposes transport topology to the editor and forces callers/tests to assemble the workflow. The production and in-memory adapters make this a real seam.

### Declared snapshots, no implementation handles

The editor handle will expose domain values such as `draft`, `dirty`, `version`, autosave status, readiness, dialog state, and narrow commands. It will not expose refs, React setters, TanStack mutation objects, or raw child-hook return types. Rendering modules continue to receive narrow declared slices.

Alternative considered: return `{...draft, ...quickAdd, ...writeActions}`. Rejected because it preserves the current shallow interface under a new name.

### Preserve the request path

Before:

```text
LeadForm -> several hooks -> separate tRPC mutations -> existing procedures
```

After:

```text
LeadForm -> LeadFormEditorHandle -> deep implementation
                                  -> LeadFormWritePort
                                     -> tRPC adapter -> existing procedures
```

No Prisma write, shared schema, procedure, or request payload changes. Period dual-state, role-coverage, and destructive-database guards are preserved unchanged; this change neither mutates nor relaxes them.

### Replace layered tests after interface coverage

First add a deterministic lifecycle test through `LeadFormEditorHandle` with the in-memory adapter. Retain existing characterization tests during migration. Remove only tests whose behavior is fully duplicated at the external seam; keep tests for independent pure domain modules.

## Risks / Trade-offs

- [A single handle becomes a bag of unrelated values] → group values into declared snapshots while keeping commands named and narrow.
- [Cache invalidation behavior drifts while moving adapters] → characterize current invalidation per successful write and keep it in the production adapter.
- [Autosave queue timing regresses] → preserve the existing queue engine and adapt only its transport dependency before any cleanup.
- [Large one-shot refactor obscures regressions] → migrate save/submit first, then fill/revoke/reopen, then caller simplification, running targeted tests after each step.
- [Old tests assert implementation details] → keep them until external-seam coverage proves equivalent behavior, then delete only redundant cases.

## Migration Plan

1. Add the port, production adapter, in-memory adapter, and external-seam characterization test without changing callers.
2. Inject the port into autosave and submit paths; preserve current outcomes and invalidations.
3. Move fill-from, revoke, reopen, confirmation, and quick-add composition behind `useLeadFormEditor`.
4. Switch `LeadForm` and loaded rendering to declared editor slices; remove obsolete exports and glue.
5. Run targeted tests, repository gates, and strict OpenSpec validation.

Rollback is a source revert; there are no data migrations, flags, or deployment-order constraints.
