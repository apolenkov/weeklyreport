## Why

An administrator can currently retest the live provider and inadvertently make
the report assistant unavailable. The assistant control also briefly becomes
interactive before availability is known; both violate the intended reliable
global AI experience.

## What Changes

- Preserve an active revision's `active` lifecycle when it is retested, while
  saving the latest safe capability result and measured embedding dimensions.
- Remove the obsolete `MISTRAL_API_SERVER` legacy-bootstrap input and always
  bootstrap the Mistral profile against its approved global endpoint.
- Make the Lead Chat control fail closed: it is enabled only after the
  authenticated availability read explicitly reports `available`.
- Add focused regression coverage for all three behaviors.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-provider-configuration`: Retesting an active revision must preserve
  active availability, and legacy Mistral bootstrap no longer accepts a
  regional server selector.
- `lead-report-assistant`: The Chat control must remain disabled while
  availability is unresolved or unavailable.

## Impact

Affected areas are the AI-provider lifecycle service and tests, environment
schema and deployment examples, existing Mistral bootstrap documentation, and
the Lead report assistant UI/tests. No database schema change, credential
format change, or new API endpoint is required.

## Non-goals

- Adding regional or per-provider endpoint selection for built-in profiles.
- Changing the configured provider runtime, authorization model, or semantic
  embedding preparation behavior.
