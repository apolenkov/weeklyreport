# Design

## Context

See proposal.md. batchScript keeps completed rows locally and also writes sessionStorage for transport failure recovery. Root approved the narrow returned storage-error path after direct generated-DOM RED and bounded diagnostic advice.

## Goals / Non-Goals

Preserve current completed evidence and request-budget honesty. No volatile fallback, new failure enum, retries or new actions.

## Decisions

Catch only storage writes. Start timing before the first write. On failure return local rows, stopped true, unknown request count and original error name/message. An initial failure returns an empty current batch without acting or rereading older rows.

runBatch handles the returned error before settlement, records existing press-batch-failed and coverage-incomplete findings and marks restoration unsuccessful. Existing quick/full consumers then retain evidence and abort dependent work. Real transport exceptions continue through recoverBatch unchanged. Successful signed request settlement remains unchanged.

Before: completed row → persistence throws → caller only sees older stored evidence.
After: completed row → persistence error outcome → existing incomplete/abort path preserves row and reason.

## Risks / Trade-offs

Native quota/navigation workloads are not proved by jsdom → preserve those needs-evidence subclaims. Existing readonly full consumers are inspected, not rewritten. Root runs aggregate type/gates and native acceptance. Product lifecycle, role authorization, destructive guards and durable exports are untouched.

## Migration Plan

No schema/config migration. Root integrates the scoped patch and owns aggregate acceptance and archival.
