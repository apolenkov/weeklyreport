# Add Quality Debt Roadmap

## Why

The exemplary-floor campaign closed with three intentionally ratcheted debt
surfaces still present: 27 type-only cycle violations in 9 connected clusters,
126 raw suppression-text matches, and 26 heterogeneous ESLint `files:` blocks.
Parser-backed measurement later resolved the raw suppression count into 115
real directives across 93 files plus 11 strings or explanatory mentions.
Treating these raw counts as interchangeable cleanup targets would weaken useful
policy and repeat the mechanical-fix mistakes recorded in
`~/work/customreport-archive/2026-07-28-per-file-walk/`.

## What Changes

- Add a normative `ratcheted-quality-debt` capability that defines the measured
  scope, vocabulary, ordering, slice boundaries, and completion evidence.
- Split implementation into four independently validated changes: type-cycle
  elimination, suppression adjudication, ESLint policy-scope cleanup, and
  deterministic seed-profile unification.
- Record the owner decisions from the 2026-07-28 grilling as durable design
  constraints instead of leaving them in session history.
- Require report and handoff checkpoints after each accepted slice.

## Non-goals

- Do not re-run the completed 16M-token per-file walk.
- Do not optimize a raw count by weakening rules, widening exclusions, moving
  suppressions, or adding type-only indirection.
- Do not execute destructive operations against an unnamed external database.
- Do not implement product or configuration code in this roadmap change.
