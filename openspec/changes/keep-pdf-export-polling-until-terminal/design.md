## Context

The public PDF job lifecycle is `queued | completed | failed`. The database keeps a running job in its pending row until the worker atomically records completion or terminal failure. Browser acceptance showed that a cold print-route compilation can transiently remount the export control after enqueue. The worker completed successfully, but the new component instance had no `jobId`, stopped polling, and never exposed the artifact. The existing interval callback also returns `false` for any state other than an observed `queued`, even though `readJobOutcome` treats missing and non-terminal data as a signal to wait.

## Goals / Non-Goals

**Goals:**

- Keep the client status query alive through initial no-data and every non-terminal observation.
- Resume the same owned job after an in-tab remount or reload.
- Preserve the two-second polling cadence and stop immediately on `completed` or `failed`.
- Prove the decision independently of timing-sensitive browser scheduling.

**Non-Goals:**

- Introduce a new processing status.
- Change server persistence or BullMQ lifecycle semantics.
- Change download delivery, ownership, or authorization.

## Decisions

### Define terminal states instead of enumerating transient states

The polling predicate returns `false` only for `completed` and `failed`; all other values, including the initial undefined query state, keep the existing interval. This aligns the timer with `readJobOutcome`, which already waits for any non-terminal result, and prevents future transient-state additions from silently disabling polling.

Alternatives rejected:

- Poll only for `queued`: this is the behavior that left the cold export spinning after an intermediate query lifecycle transition.
- Add an API `active` state: the durable contract deliberately exposes only queued, completed, and failed, so widening it is unnecessary.
- Increase the browser timeout: the client had stopped querying, so more waiting could never recover.

### Persist only the opaque active job identity for the browser tab

After enqueue succeeds, the hook stores the job UUID under a report-scoped `sessionStorage` key before updating React state. A new instance restores that UUID after mount and resumes the ownership-bound status query. Completion, terminal failure, and status-query error remove the key before clearing the busy state. `sessionStorage` keeps the recovery tab-scoped and automatically drops it when the browsing session ends.

Alternatives rejected:

- Keep the ID only in component state: this is the reproduced failure.
- Use `localStorage`: it outlives the browser session and would retain stale jobs longer than needed.
- Put the job ID in the URL: it exposes an implementation detail in shared links and navigation history.
- Add a server endpoint that discovers the latest job: this widens the API and ambiguity surface when a report has multiple exports, while the initiating tab already knows the exact ID.

### Test the pure interval decision and re-run live browser acceptance

A small typed decision function makes the terminal/non-terminal rule deterministic under unit test without mocking TanStack Query timers. A component remount test proves tab-scoped recovery and cleanup. The same cold exact-SHA browser path that exposed the failure then proves the full queue, worker, polling, and download flow.

## Risks / Trade-offs

- **Risk:** An unknown status could poll indefinitely. **Mitigation:** The API schema fails closed on unknown statuses; query errors already clear the job and surface a retryable error.
- **Risk:** A stale or cross-user stored job ID is restored. **Mitigation:** The status endpoint enforces requester ownership; any error clears the tab-scoped key and returns the button to retryable idle.
- **Trade-off:** The initial no-data state schedules polling before the first request settles. TanStack Query still performs only its normal enabled query, and the interval is bounded by terminal status or query-error recovery.

## Migration Plan

1. Add focused polling-decision and remount-recovery regression tests.
2. Persist and restore the active tab-scoped job, then change the interval predicate.
3. Run the focused web test plus full quality gates.
4. Re-run cold real-browser PDF export for both head and viewer on the final SHA.
5. Roll back the hook and test together if status polling or delivery regresses; no data migration is involved.
