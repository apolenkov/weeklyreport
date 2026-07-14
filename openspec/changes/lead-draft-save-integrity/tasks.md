## 1. Reseed guard against in-flight edits (P0)

- [ ] 1.1 In `use-lead-form-draft-orchestration.ts`, thread the autosave
      hook's `dirty` flag (or an equivalent unsaved-edits signal) back into
      the reseed effect. This likely requires reordering the hook so the
      reseed effect can read the current dirty state — for example by
      hoisting a `draftDirtyRef` that the autosave hook updates, since
      `useLeadFormAutosave` is currently constructed after the reseed effect
      using `draftSection` as an input.
- [ ] 1.2 When the incoming `serverSection`'s draft-payload key differs from
      `lastServerDraftKeyRef.current` AND local edits are dirty AND the
      difference is explained by the just-completed in-flight save (not an
      independent external edit), skip `setDraftSection(serverSection)` —
      update only `lastServerDraftKeyRef.current` and the optimistic-lock
      `version`.
- [ ] 1.3 When the incoming change is a genuine external edit (server draft
      key differs and it is NOT explained by the local in-flight save) AND
      the local draft is NOT dirty, reseed as before.
- [ ] 1.4 When the incoming change is a genuine external edit AND the local
      draft IS dirty, do NOT silently overwrite `draftSection` — route
      through the existing `handleConflict` reload/toast path instead, so
      the lead is told their draft was reloaded rather than losing edits
      with no signal. This closes the same silent-loss class the in-flight
      guard (1.2) closes, for the external-edit trigger instead of the
      save-echo trigger.
- [ ] 1.5 Preserve server-assigned id reconciliation (e.g. client-temp id →
      real id after create) even when the reseed is otherwise suppressed.
- [ ] 1.6 Test: type into a field, let autosave debounce and start saving,
      keep typing before the save's refetch resolves; assert the
      post-refetch `draftSection` still contains the keystrokes typed during
      the round trip (not the pre-round-trip snapshot).
- [ ] 1.7 Test: an external edit arriving while the draft is clean (not
      dirty) still reseeds `draftSection` from the server, unchanged from
      current behavior.
- [ ] 1.8 Test: an external edit arriving while the draft IS dirty does NOT
      silently overwrite `draftSection`; the conflict/reload toast fires
      instead.
- [ ] 1.9 Test: a save that assigns a new server id to a client-temp record
      still reconciles that id into the local draft even while other fields
      remain locally dirty.

## 2. Risk-impact filter hardening

- [ ] 2.1 In `lead-section-draft-payload.ts`, add `&& hasText(r.impact)` to
      the `risks` filter (line ~60), matching the `decisions` filter's
      three-field check.
- [ ] 2.2 Test: a risk with `risk` and `mitigation` filled but `impact`
      whitespace-only is excluded from `sectionToDraftPayload`'s `risks`
      array; a risk with all three fields filled is included.

## 3. Preservation test for the refuted "silent" framing

- [ ] 3.1 Add or confirm a test in `use-lead-form-autosave.test.tsx` (or the
      orchestration hook's test file) asserting that a rejected save (e.g.
      the server's `safeText` refinement rejecting a bad payload) produces a
      visible `toast.error` call AND leaves `dirty: true` — this pins the
      amendment's finding (rejected saves are NOT silent) so a future change
      cannot regress it while believing it is "fixing" BL-01.

## 4. Spec delta

- [ ] 4.1 `lead-form-draft-orchestration`: MODIFY the requirement "Lead form
      draft orchestration is isolated behind a tested hook" to add the
      dirty-guard scenario (see `specs/lead-form-draft-orchestration/spec.md`
      in this change).
- [ ] 4.2 `lead-section-draft-payload`: ADD a requirement that the risks
      filter requires all three text fields, matching decisions (new spec
      capability — no prior spec file exists for this module; see
      `specs/lead-section-draft-payload/spec.md` in this change).

## 5. Gates and verification

- [ ] 5.1 `pnpm --filter @customreport/api db:generate`
- [ ] 5.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 5.3 Live browser drive per proposal.md "Verification" — real React
      timing, not fake timers, since the bug IS a timing race.
- [ ] 5.4 `openspec validate lead-draft-save-integrity --strict`
