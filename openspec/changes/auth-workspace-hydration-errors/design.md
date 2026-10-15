# Design

## Context

See `proposal.md`. The real ingress supplies a real context factory to the
Express tRPC adapter. A context failure is converted by tRPC into a shaped 500,
but the procedure's logger cannot run without a context. The HTTP access
logger intentionally excludes `/trpc`. The formatter currently uses
`requestId: "no-context"` when construction fails; changing that response field
needs a separate decision and is not selected here.

## Goals / Non-Goals

The repair is limited to the mounted ingress diagnostic. Root authorized it
after the real HTTP baseline produced two intended missing-log failures and
two passing controls; raw evidence is retained at
`/home/user/work/handoffs/task-503/auth-contracts-30/http-red-r2/`.
Preserve canonical role middleware, period lifecycle invariants and the
destructive-target guard unchanged.

## Decisions

```text
Before
HTTP -> validated request ID -> mountApiIngress -> real context factory
     -> dependency throws -> real adapter -> shaped 500
                              procedure logging is never reached

After the scoped repair
HTTP -> validated request ID -> same context and adapter failure path
     -> safe correlated ingress diagnostic -> same shaped 500
```

Use the actual `auth.me` router and production middleware chain through the
mounted ingress. A fake existing Prisma dependency rejects its organization
read; do not mock the context, adapter or formatter. This is a controlled
dependency failure, not a native PostgreSQL/Redis outage. Clear the existing
organization cache around each case so a prior successful request cannot
hide the failure. Success and null-session cases use the same fixture.

The regression checks status and shaped body independently from the expected
safe error log. A raw dependency error never becomes the expected log value.
No new exported production helper or test-only flag is needed. The existing
ingress unit test mocks both the context and adapter, so extending it would
not establish this contract; existing PDF ingress tests exercise a distinct
download boundary.

The ingress wraps its real context factory and logs only a rejection from that
invocation, then rethrows the original failure. An absent context in adapter
`onError` is insufficient: request metadata can be rejected before the factory
is called. The real mixed-query/mutation batch regression demonstrated that
false context diagnostic. Read the request ID normalized by `CorrelationIdMiddleware`,
which `configureHttpPipeline` mounts before raw Express ingress. Do not add a
second normalizer. Keep only registered procedure names in the diagnostic;
unknown request-controlled paths collapse to a fixed marker. Read the IP from
Express, not a forwarded header; include only the typed error code.

The adapter invokes the factory once per HTTP request, including a batch, so
the catch emits one diagnostic without a WeakSet or request flags.
Do not add a fallback identity or catch-and-continue behavior. Procedure failures
with a completed context keep their existing logger. No logger/core-auth rewrite,
response mutation or new production export is required.

## Risks / Trade-offs

- Controlled rejection cannot prove a real DB/Redis failure: preserve the
  native return condition and do not claim whole C0527 closed.
- A listener can leak on assertion failure: bind only to loopback port zero,
  bound each request and test, and close all owned connections in cleanup.
- A batched failure invokes adapter callbacks per procedure: test one
  diagnostic for the actual two-call HTTP batch at the owning boundary.
- The formatter loses the request ID when no context exists: disclose this
  response residual rather than implicitly selecting an error-envelope redesign.

## Migration Plan

There is no schema, database or dependency migration. The diagnostic-only repair
follows focused RED/GREEN, independent review, all six gates on the exact SHA via
Air003 and normal atomic-lock delivery. Reverting it removes only diagnostics;
authentication/error propagation must remain unchanged.
