---
tags:
  - tanstack-query
  - testing
  - dedup
  - nit
aliases:
  - activity24h-querykey-assertion
related:
  - graceful-coalescing-kurzweil
---

## Background

Identified in Codex review §23 of
`.planning/plans/graceful-coalescing-kurzweil.md`. Both `Activity24hCard` and
`ActivityLivePanel` call `trpc.activity.live.queryOptions()`. TanStack Query
deduplicates requests sharing the same `queryKey`, which is the intended
behavior. However, there is no explicit assertion that the two call sites
produce identical query keys — if a future refactor passes different arguments
to either component, deduplication silently breaks and both make separate
requests.

## Why deferred

NIT severity — the current behavior is correct and the risk is low given stable
component props. Adding an assertion is a robustness improvement, not a bug
fix. Deferred to avoid noise in the §23 commit set.

## Acceptance criteria

One of the following (pick the lighter option at implementation time):

**Option A — unit test (~20 LoC):**
A Vitest unit test imports both `Activity24hCard` and `ActivityLivePanel`,
renders them in a test tRPC context, and asserts that both resolved
`queryKey` arrays are deeply equal.

**Option B — dev-mode assertion (~5 LoC):**
A `console.assert` (or `if (process.env.NODE_ENV === 'development') throw`)
in a shared helper that constructs the query options, verifying the key
matches the canonical form at construction time.

Either option must not affect production bundle size meaningfully.

## Estimate

~20 LoC for Option A (unit test), ~5 LoC for Option B (dev assert).
Option A preferred for long-term regression safety.
