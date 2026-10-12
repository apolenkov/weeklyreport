# Proposal

## Why

Stored reviewer text is accepted by read schemas even when the corresponding write schemas reject it as invisible, PostgreSQL-incompatible, or overlong. The actual review service and report-section mapper pass these columns into the shared read contracts.

D37-V15's approved `rv4b-review-text-read-format` root covers C3739/C5088 and preserves the existing same-column rule in `schema-conventions` and legacy reason behavior in `review-verdict-integrity`.

## What Changes

- Reuse one private review comment text validator for required record comment text, optional present verdict comment, and both input text fields.
- Keep trimming only on verdict input; valid stored read text remains unchanged.
- Extend the existing shared schema owner with genuine malformed-read regressions and valid/legacy controls.
- Clarify the existing same-column requirement with review read/write scenarios.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `schema-conventions`: add scenarios for the existing format consistency rule on persisted review text and present verdict comments.

## Non-goals

- No reviewer-name policy, renderer cleanup, cross-field verdict admission, DB repair, or published-comment change.
- No CLS threshold or next-step null policy change.
- No performance optimization, dependency, or public export change.

## Impact

Only `review.schema.ts` and its existing schema test change. API service and persistence mapper remain callers of the shared contract. Root owns guarded mapped-read and browser acceptance, final aggregate gates, normal hooks and delivery.
