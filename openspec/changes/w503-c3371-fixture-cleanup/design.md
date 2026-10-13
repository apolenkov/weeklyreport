## Context

`applyArchivedFillFixture` owns the pool and Prisma client used by the explicit
minimal `archived-fill-only` preparation variant. Its constructor currently
precedes `try`; sequential `finally` awaits skip pool cleanup on disconnect failure.

## Decisions

Use the existing `prisma/seed.ts` pattern directly: protected Prisma creation,
an explicit primary-failure flag (including a rejection with `undefined`), and
independent cleanup attempts. Re-throw the original value when cleanup succeeds.
When cleanup fails, throw `AggregateError` with the primary failure first and
as `cause`, followed by disconnect and pool errors in attempted cleanup order.
Without a primary failure, aggregate only the cleanup errors.

No helper, production test seam, dependency, fixture-data or guard change is needed.
Unit tests invoke the existing public entrypoint and mock resource dependencies;
they prove cleanup attempts and error propagation, not actual database shutdown.

## Validation

Record mocked RED before source edits and GREEN afterward in the external
TASK-503 wave-05 handoff archive. The coordinator owns full repository gates,
independent review, commit and delivery; this package runs no database or browser.
