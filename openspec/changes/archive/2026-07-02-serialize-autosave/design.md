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
- `lastSavedRef` is stamped only for the section the resolved save targeted, so
  an old-section save completing after navigation does not corrupt the new
  section's baseline.
- No unhandled promise rejection escapes the queued-save drain.

**Non-Goals:**

- No schema, tRPC, or shared-package change. The `client-error-policy` spec is
  not modified; the unhandled rejection is fixed at the call site, not by
  reshaping the error seam.
- The server-side lost-update fix (section optimistic lock) is a separate
  change (`add-section-optimistic-lock`); this change is purely client-side
  save ordering.
- Autosave failure recovery is unchanged. When a save fails, the queued payload
  is dropped and the debounce does not automatically re-fire; recovery is the
  lead's next edit or a manual save. Auto-requeue-on-error is out of scope.

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

3. Drain the queued payload against its own captured section id, not the latest
   `reportSectionIdRef.current`. The hook is mounted once per Lead Form; it is
   not remounted when the lead navigates reports or periods — `lead-form.tsx`
   changes `sectionIdForActions` in place, which flows into
   `reportSectionIdRef.current`. The current drain does
   `{ ...queued, reportSectionId: reportSectionIdRef.current }`, which retargets
   a payload queued for section A onto section B whenever the lead switches
   before the in-flight save resolves — a cross-section write. The queued
   payload (`queuedPayloadRef`) already carries the correct `reportSectionId`
   from when it was built (`sectionToDraftPayload`), so the drain MUST send the
   queued payload's own `reportSectionId` (i.e. stop overriding it, or capture
   the section id alongside the queued key/snapshot). This widens to the
   debounce queue the same one-queue-slot machinery `forceSave` uses, so the
   targeting fix covers both the manual and the autosave queue paths.

4. Scope the confirmed-save baseline stamp to the in-flight section. `onSuccess`
   today runs `lastSavedRef.current = inFlightRef.current` unconditionally. The
   hook is mounted once per Lead Form, so a section-A save can still be in flight
   when the lead navigates to section B; section B's `initialSavedKey` primes
   `lastSavedRef`, then the section-A `onSuccess` overwrites it with section A's
   key — section B then reads `dirty` and the debounce schedules a spurious save
   for section B even though the lead made no B edit. Fix: capture the in-flight
   save's section id at mutate time (alongside `inFlightRef`) and, in every
   `onSuccess`, stamp `lastSavedRef` only when that captured id still equals
   `reportSectionIdRef.current`. The captured id MUST be the section the mutation
   was actually sent to — the queued payload's own `reportSectionId` on the drain
   path (consistent with Decision 3), `reportSectionId` on the debounce /
   `forceSave` path — never a later `reportSectionIdRef.current`; otherwise a
   drained section-A save would resolve with captured id = B = current and stamp
   B's baseline with A's key, re-opening the bug through the drain. The guard
   skips only the cross-section stamp and its spurious follow-up save; a
   same-section save stamps and drains exactly as before.

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
drain sends keyB's own reportSectionId, not reportSectionIdRef.current
```

## Risks / Trade-offs

- [A burst of edits collapses to last-only] → Intended: the queue holds a
  single most-recent payload, so intermediate keystrokes between two saves are
  coalesced, exactly as the debounce already coalesces. No edit is lost because
  `dirty` stays true until the final payload confirms.
- [`onError` clears `queuedKeyRef`] → Already the current behavior, preserved
  not changed: an in-flight failure drops the queued payload and sets `state`
  to `error`. `dirty` stays true (the payload key still differs from
  `lastSavedRef`), but the debounce effect does NOT auto-rearm: its deps are
  `[payloadKey, enabled, dirty, reportSectionId, debounceMs]`, and a failure
  only changes `state`, which is not a dep. So no new timer is scheduled until
  the lead edits again (new `payloadKey`) or triggers a manual `forceSave`.
  This is an explicit non-goal here (see Non-Goals) — autosave failure recovery
  is left to the user's next edit / manual save, not an automatic requeue.

## Invariants preserved

- `lastSavedRef` is stamped only from confirmed payloads (restored, was
  violated).
- Single in-flight slot (`inFlightRef`) is never overwritten mid-flight.
- A queued save always targets the section it was built for; switching reports
  or periods while a save is in flight can never retarget a queued payload onto
  a different section.
- The confirmed-save baseline stamp is section-scoped: an in-flight save that
  resolves after the lead navigated away never stamps `lastSavedRef` for the
  newly loaded section, so the new section keeps its primed `initialSavedKey`
  baseline and does not falsely read `dirty`.
- No change to period dual-state, the role-coverage gate, the destructive-db
  guard, or the deferred-feature pattern — none are touched.
