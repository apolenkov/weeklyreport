# Adjudicate Exemplary Findings

## Why

The per-file walk left 57 `needs_work` flags without verifier adjudication.
Those records are not actionable: the completed verifier pass overturned
54.7% of the flags it examined, and one of the 57 records has no finding at
all.

## What Changes

- Re-check all 57 flags against the current source and record a reasoned
  `confirmed` or `overturned` verdict in the canonical roadmap data.
- Implement confirmed findings in small, independently verified slices.
- Keep schema migrations, cross-feature UI state changes, and broad test
  harness refactors separate from local low-risk fixes.

## Non-goals

- Do not re-run the 16M-token per-file walk.
- Do not decide `exactOptionalPropertyTypes`, the telemetry predicate
  conflict, or the 27 type-only cycles.
- Do not apply the 52-file type rename or 836-line deletion mechanically.
