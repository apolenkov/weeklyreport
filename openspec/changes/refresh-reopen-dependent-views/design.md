## Context

See `proposal.md` for the stale-view failure. Both reopen response surfaces use the same server mutation but own separate TanStack Query mutation hooks. Before this change they refreshed the request list and count without refreshing the live report projections that derive section state and available actions.

The server lifecycle transition is already authoritative. The client must invalidate dependent reads after every settled attempt because a timeout, stale request, or raced response can still leave local cache state behind the server.

## Goals / Non-Goals

**Goals:**

- Refresh the request queue, request count, submission dashboard, and Lead form projections from both response surfaces.
- Preserve the response note on failure and clear it only after confirmed success.
- Reuse the existing cache-key invalidation helpers.

**Non-Goals:**

- Change reopen authorization, lifecycle transitions, schemas, or persisted data.
- Add optimistic section-state updates or a new cache abstraction.
- Change the current visual layout.

## Decisions

### Invalidate dependent reads in each mutation's `onSettled`

Each existing response hook calls `invalidateSubmissionDashboard`, `invalidateLeadForm`, and the two reopen-request invalidations from `onSettled`.

```text
before: respond mutation -> request list/count refresh
after:  respond mutation -> request list/count + dashboard + Lead form refresh
```

`onSettled` is used instead of `onSuccess` because an ambiguous transport failure or stale auto-close can still accompany server-side state that differs from the cache. Direct cache rewriting was rejected because the mutation result does not contain every dependent projection.

### Keep response-draft ownership local to each surface

The dashboard closes its responder only through the existing success callback. The review/admin hook likewise resets its draft only on success. Error handling shows the existing toast and leaves the note intact for correction or retry.

A shared response-form store was rejected because the two surfaces do not need cross-route draft persistence and already have bounded local ownership.

### Preserve load-bearing invariants

The change performs client cache invalidation only. It neither mutates nor relaxes period dual-state, canonical role-procedure chains, or the destructive database guard. No migration, feature flag, downstream API change, or deployment ordering is required.

## Risks / Trade-offs

- [Several invalidations can issue overlapping refetches] → Reuse TanStack Query key filters and existing helpers so equivalent active queries deduplicate normally.
- [A failed invalidation promise could create an unhandled rejection] → Keep invalidation fire-and-forget with the existing bounded rejection handling.
- [Future response surfaces could omit the dependent refresh] → Keep regression coverage at both current mutation owners and the shared cache-key contract.

## Migration Plan

Ship the client-only change with its focused tests. Rollback restores the previous mutation callbacks; no data or server rollback is required.
