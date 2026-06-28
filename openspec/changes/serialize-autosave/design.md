## Context

`useLeadFormAutosave` debounces lead-section edits into a single
`reports.saveDraft` mutation. It already serializes the manual path: `forceSave`
checks `saveDraftMut.isPending` and, when a save is in flight, stashes the
current payload into `queuedKeyRef` / `queuedPayloadRef` and returns, letting
the `onSuccess` drain fire it next. The debounce timer (the autosave path) does
not apply this guard — it calls `mutateRef.current(...)` unconditionally and
overwrites the single `inFlightRef` slot. So two mutations can run in parallel
against one slot. The hook's correctness rests on one invariant: `lastSavedRef`
is only ever stamped with a payload key that the server actually confirmed.
Parallel saves break that invariant.

## Goals / Non-Goals

**Goals:**

- The debounce path serializes exactly like `forceSave` — one mutation at a
  time, newer payloads queued via the existing drain.
- `lastSavedRef` (and therefore `dirty`) reflects only confirmed payloads.
- No unhandled promise rejection escapes the queued-save drain.

**Non-Goals:**

- No schema, tRPC, or shared-package change. The `client-error-policy` spec is
  not modified; the unhandled rejection is fixed at the call site, not by
  reshaping the error seam.
- The server-side lost-update fix (section optimistic lock) is a separate
  change (`add-section-optimistic-lock`); this change is purely client-side
  save ordering.

## Decisions

1. Reuse the existing queue machinery rather than add a second mechanism.
   `forceSave` already populates `queuedKeyRef` / `queuedPayloadRef` and the
   `onSuccess` drain already fires them. The debounce timer takes the same
   branch when `saveDraftMut.isPending`, so there is one queue and one drain.
   Alternative — a save-mutex or a request id — adds state for no behavior the
   single-slot queue does not already give us.

2. Drain via `mutateRef.current(...)`, not `void mutateAsyncRef.current(...)`.
   The mutation's own `onSuccess` / `onError` already drive `state`, the toast,
   and the next drain. `mutateAsync` returns a promise the drain immediately
   discards; on failure it rejects with no `.catch`, producing the spurious
   second error report. `mutate` is fire-and-forget by design — the right tool
   for a callback-driven chain. (`forceSave` keeps `mutateAsync` because its
   own caller awaits it.)

## Data flow (before / after)

Before — debounce fires while a save is in flight:

```
inFlight: keyA  --(timer fires for keyB)-->  inFlightRef overwritten = keyB
two mutations in flight on one slot; saveA.onSuccess stamps lastSavedRef
with whichever inFlightRef holds now -> dirty=false for an unconfirmed key
```

After — debounce fires while a save is in flight:

```
inFlight: keyA  --(timer fires for keyB, isPending)--> queue keyB, no mutate
saveA.onSuccess: stamp lastSavedRef=keyA, then drain -> mutate(keyB)
inFlightRef = keyB only when keyB actually starts
```

## Risks / Trade-offs

- [A burst of edits collapses to last-only] → Intended: the queue holds a
  single most-recent payload, so intermediate keystrokes between two saves are
  coalesced, exactly as the debounce already coalesces. No edit is lost because
  `dirty` stays true until the final payload confirms.
- [`onError` clears `queuedKeyRef`] → Already the current behavior; an
  in-flight failure drops the queued payload but leaves `dirty` true, so the
  debounce re-arms and saves again. Preserved, not changed.

## Invariants preserved

- `lastSavedRef` is stamped only from confirmed payloads (restored, was
  violated).
- Single in-flight slot (`inFlightRef`) is never overwritten mid-flight.
- No change to period dual-state, the role-coverage gate, the destructive-db
  guard, or the deferred-feature pattern — none are touched.
