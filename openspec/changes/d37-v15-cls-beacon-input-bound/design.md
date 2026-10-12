# Design

## Context

See proposal.md for motivation and the public endpoint delta for the approved input ceiling. The actual controller parses the shared schema before observing one of five real histograms. CLS uses raw scores; the other metrics use milliseconds.

## Goals / Non-Goals

Protect aggregate integrity at the existing parse boundary. Do not alter histogram units, buckets, labels, or performance thresholds. Period state, authorization builders, and database guards are unaffected.

## Decisions

Add a name-specific shared-schema refinement at `value`, retaining the existing nonnegative numeric parser and timing maximum. A private named CLS ceiling avoids an unnecessary public export. Changing histogram buckets would not reject input; duplicating validation in the controller would create two owners.

Before: body → schema with generic maximum → CLS histogram can observe 300000.
After: body → schema with CLS ceiling 10 → rejected input becomes 400 before observation; timing maximum remains 300000.

## Test Audit

- Failure: admitted oversized CLS corrupts real aggregate observations.
- Consumer: actual controller/body/schema/real histogram; schema tests separately check field issue location and name-specific boundaries.
- RED: controller count is 1 for CLS 10.0001 and 300000; schema accepts both.
- Value: rejection tests check real state and status; positive controls protect CLS 0/10 and all timing maxima. No mocks or production test seams are added.

## Risks / Trade-offs

Previously accepted CLS values above 10 become invalid → explicitly approved input admission contract, with boundary and unchanged timing controls. Local controller invocation proves observation behavior; deployed HTTP and dashboard effects remain separate acceptance work.

## Migration Plan

No migration or dependency change. Root integrates the shared-schema update with normal hooks. Rollback restores the previous schema; local evidence remains in the external D37-V15 handoff. The web sender contract and native acceptance remain Root-owned.
