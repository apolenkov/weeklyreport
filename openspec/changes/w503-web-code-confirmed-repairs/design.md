# Design

## Context

The three source-confirmed sequences are described in proposal.md and independent triage sample review. The owning hooks already define their shared contracts. Repairs stay at those owners rather than changing callers or introducing test-only seams.

## Goals / Non-Goals

Goals: preserve current user intent and current validation at each owner, with actual RED-to-GREEN regressions. No data migrations, new dependencies, palette/layout changes or Registry/Backlog writes.

## Decisions

1. Parent selection invalidates its stage error together with the existing stage reset. The existing dialog derives an implicit sole owned stage; save continues to validate normally.
2. The unpinned weekly query is immediately stale so mounting or changing to its key requests current active data. Redirect eligibility requires a successful fetch after mount and no active fetch. Merely checking isFetching would accept a fresh cached value or an offline-paused cached query. Explicitly pinned queries retain existing freshness and background content behavior.
3. Keep router.replace navigation. The shared URL owner serializes navigation: the first intent is sent, later events compose into the latest desired query, and acknowledgement sends the composed remainder. External query/path changes and popstate discard pending intent. Pure link construction reads the observed URL, not mutable pending state. This avoids out-of-order intermediate acknowledgements and preserves marker stripping and repeated unrelated params. Replacing navigation with history.replaceState was rejected because server consumers require navigation semantics.

## Risks / Trade-offs

- Serial navigation delays the second transition until the first is observed; controls remain usable and latest composed intent is preserved. Owner tests cover intermediate acknowledgements, cancellation, external navigation and StrictMode.
- A separate router navigation to an exactly identical pending URL is indistinguishable via query hooks; it has the same visible URL. Browser Back is explicit popstate and cancels pending work.
- A fresh active query can fail or pause; do not pin cached identity. Existing error/retained-content contract remains in place.
- B has no provisioned native slot. Focused unit checks are permitted; native/browser acceptance requires Root allocation and wr-heavy. Six gates use the shared queue.
