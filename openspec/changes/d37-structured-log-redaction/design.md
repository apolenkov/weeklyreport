# Design

## Context

See proposal.md for motivation. The logger merges child and per-call context, redacts top-level known keys, strips reserved fields and sends the same logical context to JSON and OTel sinks. Native synthetic diagnostics prove nested markers reach all three boundaries.

## Goals / Non-Goals

Preserve the existing privacy vocabulary and logging API while protecting JSON-style context objects/arrays. Keep Date and other opaque value serialization and error/circular behavior. Do not inspect raw Error causes/stacks or add sensitive fields, backpressure, file recovery or durability behavior. No report lifecycle, role middleware or destructive-target contract changes.

## Decisions

Before: merged context -> top-level redaction -> JSON/file and OTel.
After: merged context -> recursively copied record/array context with known keys replaced -> unchanged envelope/JSON/file and OTel.

Keep one central traversal so callers and sinks cannot diverge. A per-call WeakMap retains repeated references and cycles without mutating inputs; cycles continue to trigger the existing JSON envelope fallback. Preserve opaque values rather than clone custom prototypes or change their serialization. JSON round-trip cloning was rejected because it changes Date/value behavior and fails on cycles before the existing error boundary. No dependency is needed.

## Risks / Trade-offs

- Unbounded recursion could revisit cycles -> record copied references before traversing children and exercise the existing cyclic fallback.
- Repeated object references could expose an unredacted second occurrence -> reuse the redacted copy for every occurrence.
- Ordinary organization fields or Date could change -> explicit boundary controls preserve them.
- Current live nested producer is not identified -> report this reachability limit independently; it does not waive the admitted context privacy contract.

## Migration Plan

No data migration or runtime setting changes. Root integrates the bounded logger/test/change artifact patch with normal hooks and completes aggregate acceptance under D42. Rollback restores the prior implementation and reopens the privacy finding.
