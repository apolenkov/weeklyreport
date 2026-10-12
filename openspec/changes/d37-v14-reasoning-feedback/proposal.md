# Proposal

## Why

After an administrator corrects a missing custom reasoning value, the Provider form still marks the corrected field invalid and shows the old error. D37-V14 C4523 reproduces this at the actual AiProviderForm DOM boundary; the RED receipts live in the coordinator's D37-V14 handoff.

## What Changes

- Clear only the stale local custom-reasoning error when the generation input corrects that value or selects a mode that does not require it.
- Keep blank/invalid-value refusal and ordinary explicit submission unchanged.

## Capabilities

### Modified Capabilities

- `ai-provider-admin-layout`: custom reasoning validation feedback reflects correction of the current input.

## Impact

One web source and its approved existing wrapper-state test change. Existing shared field validation supplies the admitted custom-value rule; no schema, provider configuration, credential policy or server behavior changes.

## Non-goals

- Required-model/credential/endpoint validation policy or provider lifecycle changes.
- Native browser/assistive-technology acceptance, layout changes or new error categories.
- Other D37-V14 ordering/performance hypotheses and main specification synchronization.
