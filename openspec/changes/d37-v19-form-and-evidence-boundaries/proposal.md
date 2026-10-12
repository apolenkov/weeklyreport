# Proposal

## Why

The approved D37-V19 corrections prevent lost period-policy edits, invalid pause reasons, and duplicate or misdirected feedback actions. The corrected v2 handoff and existing `admin-settings-ui`, `record-status-derivation`, and `authenticated-product-feedback` contracts define the scope.

## What Changes

- Keep independent period-policy field changes in the same current draft.
- Gate the confirmed trimmed pause reason with the shared persisted-text bound and retain input for correction.
- Keep captured dimensions and all diagnostic rows visible without an extra renderer cap, distinguishing repeated rows.
- Bind the feedback edit draft to the selected record, expose disclosure state, and admit one pending action per form until failure or completion.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `admin-settings-ui`: clarify independent draft-field preservation.
- `record-status-derivation`: clarify the existing persisted pause-reason bound at its dialog.
- `authenticated-product-feedback`: clarify existing inline evidence and explicit record/action boundaries.

## Impact

The nine exact source/test paths in the corrected D37-V19 patch. No shared schema, persistence, role predicate, capture-ingress limit, dependency or configuration changes. Raw evidence remains in the external D37-V19 handoff.

## Non-goals

- No new viewport cap, diagnostic truncation, retention or capture policy.
- No guarantee of database idempotency from a synchronous UI guard.
- No native browser, assistive-technology or whole-finding closure from unit controls.
