# W503-110: feedback type and status are storage invariants

## Why

`ProductFeedback.type` and `ProductFeedback.status` are plain `String` columns.
The API rejects unknown stored values when it maps a row, but nothing stops a
write outside the application (a script, a manual repair, a future service)
from storing a value the shared enums do not know; the inbox then fails on that
row. The 02.11 consilium (Claude + Astra, TASK-503.110) chose a database CHECK:
the allowed values are a storage invariant, and adding it before the first
production deployment costs one forward-only migration.

## What Changes

- Add a forward-only migration with two CHECK constraints that mirror
  `FEEDBACK_TYPES` and `FEEDBACK_STATUSES` from `@weeklyreport/shared`.
- The migration never rewrites rows: an existing row outside the enums blocks
  constraint validation and must be resolved explicitly.
- A migration contract test keeps the SQL value lists equal to the shared enums.

## Impact

- `prisma/migrations/<timestamp>_product_feedback_value_checks/`
- `prisma/migrations/product-feedback-value-check-contract.test.ts`
- Capability: `authenticated-product-feedback`
