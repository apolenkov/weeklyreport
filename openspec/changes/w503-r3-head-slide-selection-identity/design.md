# Design

## Context

`HeadSlidesClient` kept `rawSelectedIndex` and clamped it to the slide count at
render. The slide list is rebuilt on every `weeklyReport.get` refetch and sorted
for review (tone, score, owner name), so an unrelated edit can move slides while
the index stays put.

## Decisions

- State holds the selected slide key. `slideArticleKey` (`id:pageIndex`), already
  the React key of each rendered slide article, is exported from
  `status-slide-deck.tsx` and reused; no second identity notion is introduced.
- The rendered index is the position of that key, or `0` when absent (initial
  state, or the slide left the list). `onSelect(index)` stores the key of the
  slide at that index, or clears it for an out-of-range index.
- The key is not cleared when it is absent, so transient empty states (activity
  skeleton, shrink then grow) behave as the index clamp did: selection returns
  with the slide.

## Assumptions

- A page-index change of a paginated slide (density or content growth) is a
  different key and falls back to the first slide; only the head deck uses
  document density, where pagination is content-driven.
