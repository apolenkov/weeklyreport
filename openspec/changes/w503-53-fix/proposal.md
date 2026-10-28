# Proposal

## Why

`mapFeedback` in `product-feedback.prisma-support.ts` converts a stored
`ProductFeedback` row into the domain record. `type` and `status` are plain
`String` columns, and the mapper casts them with `as FeedbackRecord["type"]`
and `as FeedbackRecord["status"]` without checking them. A legacy or manually
edited row with a value outside the shared enums therefore reaches the domain
and the wire as a trusted value (C1319, TASK-503.53).

## What Changes

- `mapFeedback` checks `type` and `status` against the shared
  `feedbackTypeSchema` and `feedbackStatusSchema` before it builds the record.
- An out-of-enum value raises `FeedbackInvalidStatusError` (code
  `STORE_INVALID_STATUS`). The message names the row ID, so the failing row can
  be found in logs. The client-facing response text is unchanged.
- No schema, migration, wire or payload-type change. Valid rows map as before.

## Open Question

The read path raises `FeedbackInvalidStatusError`, and the handler currently
answers that class with `400 invalid_request`. A stored row that is wrong is a
server-side fault, so a `500` would be more accurate. The card's decision
(throw, answer 500 with a logged row ID) is not implemented here, because the
change of HTTP mapping needs its own decision. Until then, a bad row makes the
whole list request fail with `400`.

## Capabilities

### Modified Capabilities

- `authenticated-product-feedback`: storage mapping validates the domain enums
  for feedback type and status.

## Impact

- `apps/api/src/modules/product-feedback/product-feedback.prisma-support.ts`
- New unit test `apps/api/src/modules/product-feedback/product-feedback.prisma-support.test.ts`
- Read paths that map rows: list, update and related reads in
  `product-feedback.prisma-repository.ts`.
