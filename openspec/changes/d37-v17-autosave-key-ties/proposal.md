# Proposal

## Why

The autosave comparison helper can encode the same plain object differently
when its distinct property names compare equally under locale collation.
D37-V17/C2689 contradicts the existing insertion-order regression in
`apps/web/src/features/report-sections/model/autosave/use-lead-form-autosave.test.tsx`.
Current product payload keys are fixed ASCII; a user-visible dirty-state loss
has not been established.

## What Changes

- Keep the existing collator order for every nonzero comparison.
- Break collation ties between distinct property names by string comparison.
- Extend the existing owner test with precomposed/decomposed accent keys and
  retain a non-tied mixed-case ordering control.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This repairs the existing helper contract; `skip_specs: true` records
that no new requirement is introduced. The owning specification remains
`openspec/specs/lead-form-draft-module/spec.md`, including its non-Date
compatibility scenario.

## Impact

Only the comparison helper and its existing test owner change. Consumers are
draft comparison and save-identity/metadata reconciliation. Evidence and the
task brief are retained in the external D37-V17 handoff directory.

## Non-goals

- Change period ordering or any ID tie policy.
- Admit arbitrary Unicode field names into product schemas.
- Claim cross-ICU stability, a performance improvement, or product dirty loss.
- Change invalid-Date admission or replace invalid values silently.
