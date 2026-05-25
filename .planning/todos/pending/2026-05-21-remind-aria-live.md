---
tags:
  - aria
  - accessibility
  - verify
  - low
aliases:
  - remind-aria-live
related:
  - graceful-coalescing-kurzweil
---

## Background

Added in commit `559a891` as part of the Pulse RemindLeadButton implementation
(§23 of `.planning/plans/graceful-coalescing-kurzweil.md`). The button renders
a visually hidden `sr-only` span to announce the action result to screen
readers via an `aria-live` region.

## Why deferred

This is a manual verification item, not an implementation gap. The `aria-live`
span is in the DOM; correctness depends on screen reader behavior (NVDA, VoiceOver,
JAWS) which cannot be verified by automated unit or Playwright tests without
specialist tooling. Implementation is complete; coverage is unverified.

## Acceptance criteria

- VoiceOver (macOS) or NVDA (Windows) announces the error/success text from the
  `sr-only` span when RemindLeadButton fires and a status message appears.
- The announcement fires without requiring focus to move to the span.
- No duplicate announcements on repeated clicks.

## Estimate

0 LoC (implementation already landed). Manual QA session ~30 min.
