## Why

Lead Form works, but changes to saving, conflicts, submission, and dialogs still require callers to coordinate internal draft state. This makes the form harder to change and test through the single handle already required by `openspec/specs/lead-form-draft-module/spec.md`.

## What Changes

- Consolidate draft lifecycle orchestration behind one declared Lead Form interface.
- Replace the submit-only write seam with one write port covering draft save, submit, fill-from, revoke, and reopen operations.
- Provide a production tRPC adapter and an in-memory test adapter at that seam.
- Keep optimistic-lock versions, save reconciliation, generation guards, mutation state, and conflict handling inside the module implementation.
- Reduce `LeadForm` and loaded-rendering call sites to narrow state and command slices.
- Replace tests tied to shallow helper modules once equivalent behavior is proven through the deep module interface.

### Non-goals

- No user-visible behavior or UI-string changes.
- No new routes, tRPC procedures, shared schemas, database changes, or deployment changes.
- No broad frontend architecture migration outside Lead Form.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. The implementation will conform more directly to the existing `lead-form-draft-module`, `lead-form-draft-orchestration`, and `lead-form-loaded-view-model` specifications without changing their requirements.

## Impact

- Primary code: `apps/web/src/features/report-sections/model/lead-form/` and `apps/web/src/features/report-pages/ui/lead/`.
- Tests: Lead Form draft, autosave, generation, conflict, submit, and rendering suites.
- Public product behavior and server contracts remain unchanged.
