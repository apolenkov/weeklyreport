# Design

## Context

The queue job identity includes the complete semantic work identity. The same
identity can be replaced between reading a terminal state and removing its job.
See proposal.md and the C1996 native interleaving receipt.

## Goals / Non-Goals

**Goals:** reuse a replacement being processed by a worker.

**Non-Goals:** retrying infrastructure failures or mutating active job data.

## Decisions

After removal rejects, read the same job's current state once. Return only when
it is active; otherwise propagate the original removal error. A blanket catch
would silently retain a terminal job, and unconditional retries add races.

Before: terminal read -> replacement locked -> remove error -> request fails.
After: terminal read -> replacement locked -> remove error -> active recheck
-> request reuses the work. Other removal failures remain technical errors.

Report lifecycle, role coverage, identity, and destructive target invariants
remain unchanged. No schema migration, feature flag, or web consumer change.

## Risks / Trade-offs

- A non-active replacement or failed recheck still fails the request; no
  infrastructure error is converted to a successful enqueue.
- The queue remains concurrent after the recheck, as for ordinary active-job
  deduplication. The real Worker must complete the retained same-identity job.
