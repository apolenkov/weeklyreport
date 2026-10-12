# Design

## Context

See proposal.md. AiProviderForm stores the missing-custom-value error after submit but only hides it for non-custom modes. Input changes update form state without retiring that stale feedback. The actual public fields render its stored error as aria-invalid, aria-describedby and an alert.

## Decisions

Before: blank custom submit → stored error → corrected input → stale invalid marker. After: blank custom submit → stored error → generation correction admitted by the existing shared custom-value field schema, or non-custom mode → retire only that local error. Whitespace-only input and unrelated model changes retain the current error. Saving still requires an explicit submit and uses the existing draft conversion.

Reuse the custom-value field from aiProviderGenerationDraftSchema rather than duplicating a length rule or validating the entire draft to clear one error. Model, credential, endpoint and provider-role validation retain their existing boundaries. No arbitrary live-validation policy is introduced for other fields.

## Invariants

The provider schema, revision data/props, credential inheritance, server validation, role middleware, active pointer and lifecycle are unchanged. Period dual-state and destructive guards are unaffected; no database operation is involved.

## Risks / Trade-offs

- Clearing an error on any unrelated generation edit would hide an unresolved blank value → clear only when the missing-value condition is corrected using the existing shared field validator, or ceases to apply.
- DOM checks do not prove native AT/browser behavior → preserve that boundary as needs-evidence for the coordinator's later browser lane.

## Migration Plan

No migration or flag is needed. Apply the source/test together with normal hooks. Root synchronizes the main specification and runs aggregate gates/review on the integrated tree. Rollback restores source/test together and leaves the original DOM defect open.
