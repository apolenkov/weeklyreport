# Design

## Context

See proposal.md. The service's initial-dispatch catch awaits `markExportFailed` before rethrowing E1. That method logs E1 before the repository's generation-fenced Prisma write. A write rejection E2 bypasses the rethrow. The actual request router wraps the service with `withDomainErrorMapping`; unknown Error causes survive for logging while the transport message remains `Unexpected error`.

## Goals / Non-Goals

Preserve E1 identity for the public service caller and keep E2 diagnostics. Do not infer total diagnostic loss or physical database/queue behavior from port injection. No changes to retry dispatch: its lost-ack contract deliberately leaves a pending row recoverable.

## Decisions

Wrap only the existing initial compensation await in a local try/catch. On E2, log a distinct compensation-failed event containing jobId, reportId, generation, and normalized E2 message; then execute the existing `throw error` for E1. Reuse the existing `errorMessage` helper for the secondary diagnostic; this avoids adding a normalization branch to the request method while respecting its cognitive-complexity limit. The primary compensation input keeps its current normalization. No new recovery helper, AggregateError, exception type, or catch added inside public `markExportFailed`: other callers must still see persistence failures.

Before: valid request -> durable queued(g1) -> locked queue dispatch rejects E1 -> E1 logged -> compensation rejects E2 -> caller E2.
After: same sequence -> E2 separately logged -> caller E1 -> existing tRPC safe mapping retains E1 cause.

Use one table-driven service test for compensation succeeds/fails, reusing the existing stateful locked repository fixture and real `PdfExportBullmqEnqueuer`. Inject failures only at existing `JobEnqueuer.add` and repository persistence ports. Queue admission verifies the actual persisted job/requester/generation before rejecting E1; compensation checks the same pending job before returning E2. Observe caller exception identity, durable row status, and separate diagnostic context. Existing coverage has only successful compensation; extend that owner test rather than duplicate the scenario elsewhere.

## Risks / Trade-offs

- Compensation can leave a queued row when persistence is unavailable -> disclose that status; existing orphan recovery remains unchanged.
- Controlled port failure is not a real simultaneous Redis/PG outage -> claim only the service exception contract.
- Logger delivery failures and non-stringifiable custom rejection objects are outside the frozen C1143 admitted infrastructure producer -> do not invent new clauses or claim they are tested.

## Migration Plan

No schema, dependency, feature flag, authorization, lifecycle-tuple, guard, or web changes. Root merges only after actual RED/GREEN, six gates, and independent acceptance on the delivered tree. Roll back the scoped service/test commit if needed. C12 immediately takes priority after pushed TASK513 receipt.
