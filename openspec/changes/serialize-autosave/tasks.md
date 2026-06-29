## 1. Web hook — serialize the debounce path

- [ ] 1.1 In `apps/web/src/hooks/use-lead-form-autosave.ts`, in the debounce
      timer callback, when `saveDraftMut.isPending` stash the current payload
      key and snapshot into `queuedKeyRef` / `queuedPayloadRef` and return
      without calling `mutateRef.current(...)` — mirroring the guard in
      `forceSave`. Only start a mutation (set `state="saving"`, write
      `inFlightRef`, call `mutateRef.current(...)`) when no save is in flight.
- [ ] 1.2 In the `onSuccess` queued-save drain, replace
      `void mutateAsyncRef.current({ ... })` with the fire-and-forget
      `mutateRef.current({ ... })` so the mutation's own `onSuccess` / `onError`
      handle the outcome and no unhandled promise rejection leaks.
- [ ] 1.3 Confirm `inFlightRef` is only written when a mutation actually starts
      (debounce start branch and the drain), so it is never overwritten while a
      save is pending — preserving the "lastSavedRef stamps only confirmed
      payloads" invariant.
- [ ] 1.4 In the `onSuccess` drain, send the queued payload to the section it
      was built for: stop overriding `queued.reportSectionId` with
      `reportSectionIdRef.current` (use the queued payload's own
      `reportSectionId`, or capture the section id alongside the queued
      key/snapshot at queue time). This prevents a payload queued for section A
      from being written to section B after the lead navigates reports/periods.

- [ ] 1.5 Scope the confirmed-save baseline stamp to the in-flight section.
      Capture the in-flight save's section id at mutate time (alongside
      `inFlightRef`) — the section the mutation is actually sent to: the queued
      payload's own `reportSectionId` in the drain, `reportSectionId` on the
      debounce / `forceSave` path. In every `onSuccess` (including the drain),
      stamp `lastSavedRef.current = inFlightRef.current` only when that captured
      section id still equals `reportSectionIdRef.current`; on a mismatch (the
      lead navigated reports/periods while the save was in flight) skip the stamp
      and do not schedule a save for the newly loaded section, so the section's
      freshly-primed `initialSavedKey` baseline is preserved.

## 2. Tests

- [ ] 2.1 Add/extend the autosave hook test: continued edits while a save is in
      flight queue the newer payload (one mutation at a time), and an earlier
      save's `onSuccess` does not stamp `lastSavedRef` with the newer
      unconfirmed key (so `dirty` stays true until the queued save confirms).
- [ ] 2.2 Add a test that a failing queued save surfaces exactly one error
      (mutation `onError`) and emits no unhandled promise rejection from the
      drain call site.
- [ ] 2.3 Add a test that switching `reportSectionId` while a save is in flight
      (a queued payload pending) drains the queued payload to the section it was
      built for, not the new `reportSectionId` — guarding the cross-section
      retarget edge.

- [ ] 2.4 Add a test that a section-A save in flight, with no queued payload,
      that resolves after `reportSectionId` switched to section B does NOT stamp
      section B's baseline with section A's key — section B stays non-dirty and no
      autosave is scheduled for section B.

## 3. Verification

- [ ] 3.1 Run the gates and record results: `pnpm typecheck`, `pnpm lint`,
      `pnpm test`, `pnpm build`.
- [ ] 3.2 Run `openspec validate "serialize-autosave" --strict` and confirm
      exit 0.
