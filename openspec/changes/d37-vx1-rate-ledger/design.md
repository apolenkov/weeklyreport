# Design

## Context

See proposal.md. The request history producer appends reservations and signed corrections; pace reads it under the existing lock before each append. Public callers are crawler presses, authentication and scenario API.

## Goals / Non-Goals

Preserve the authorized budget after a filesystem read failure. No new retention, parser policy, lock protocol or browser behavior.

## Decisions

Catch ENOENT as first-run absence and rethrow every other original read error. This prevents append when history is unknown; fail-open empty history is incompatible with the existing budget. Keep signed corrections, which represent measured refunds.

The boundary regression uses a real write-only file. It verifies EACCES admission before exercising pace. Unsupported privileged/platform contexts fail explicitly rather than claim PASS.

Before: unreadable history → empty usage → append.
After: unreadable history → original error → lock released, no append.
Missing history → existing first reservation remains unchanged.

## Risks / Trade-offs

Unavailable history now stops work → original error makes recovery diagnosable. Concurrency, malformed-ledger policy and long-run growth remain unproved; this change does not claim to fix them. No database, product lifecycle, authorization or shared configuration invariants change.

## Migration Plan

No schema or infrastructure migration. Root integrates the tested patch and runs aggregate gates. Revert the scoped patch if a contract contradiction is established.
