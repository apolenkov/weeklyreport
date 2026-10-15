# Proposal

## Why

C0576: `computeDeadline` applies the configured deadline wall-clock time in the
settings timezone with no stated rule for a time that does not exist (spring
forward) or occurs twice (fall back). Probing the current algorithm showed the
gap case is deterministic (shifted forward by the gap) but the fold case depends
on the clock time of `periodStart`, which the function is documented to discard:
the same deadline setting resolved to instants one hour apart.

Decision (coordinator 008, 15.10): follow the platform default (Temporal
`compatible`): a nonexistent time moves forward, an ambiguous time takes the
earlier occurrence. The default timezone (Europe/Moscow) has no DST, so the edge
only concerns configured foreign zones.

Backlog: TASK-503.33. Evidence: `task-503/portfolio-33/CONTRACT-503-33.md`.

## What Changes

- Spec: the deadline wall-clock resolution rule (gap and fold) becomes explicit.
- Tests: fold independent of `periodStart`'s clock time; fold → earlier occurrence;
  gap → shifted forward by the gap length.
- Code (after the RED is observed): resolve the target wall time explicitly so the
  earlier occurrence is chosen regardless of the start instant's offset.
