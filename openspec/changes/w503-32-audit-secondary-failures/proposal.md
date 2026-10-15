# Proposal

## Why

`trpc.audit.ts` states that audit bookkeeping is best-effort and "cannot fail
the mutation that already succeeded". That holds for a failing durable write,
but not for the reporting around it: a throwing audit log stream (C0558), a
throwing drop metric or a throwing error logger inside the persist catch
(C0540) each replace a computed mutation result with INTERNAL_SERVER_ERROR.

## What Changes

- Failures of the audit reporting itself (log-stream emit, drop metric, error
  log) MUST NOT change the outcome of a mutation. They stay observable where
  possible; no new sink and no new configuration.
- The throwing sinks in the RED test are fault injections. None is an admitted
  production path today (see `wave3/claude-D-C0555/REPORT.md`), so this is the
  documented contract made explicit as defense in depth. API owner confirms.

## Scope limits

- Post-outcome only. Audit-before-commit for named procedures (a future
  fail-closed clause) is not implemented and not precluded.
- The `trpc.logging.ts` caller (`recordTrpcFailure` / `recordTrpcSuccess`) logs
  the request end with the same logger outside the audit path; a throwing
  logger replaces the result there too. Not changed here; the error-path
  control therefore breaks only the audit sinks, not the logger.

## Not claimed

- No production sink outage or PostgreSQL proof: the tests are fault injections
  through the canonical `protectedProcedure` chain.
- Async stderr stream errors, the durable audit guarantee, the mutation's own
  database commit and fail-closed audit for privileged flows (login, admin,
  cron) are outside this change.

## Remaining clauses of TASK-503.32 (no RED, reason recorded)

| Clause | Why no RED from source                                                                                                                                          |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C0536  | Unbounded `targets` needs a named bulk mutation, its maximum cardinality and a truncation policy.                                                               |
| C0538  | Depth, size and cycle guard needs an admitted max-size payload; a cyclic input needs a transport that can carry one.                                            |
| C0541  | `describeShape` bounds need an accepted HTTP payload, measured cost and a truncation contract.                                                                  |
| C0555  | `audit-logger.ts` callers beyond the middleware (login, admin, cron) need a real sink failure and the per-flow policy; the middleware half is covered by C0558. |

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `operational-logger-wiring`: audit reporting failures and mutation outcomes.
