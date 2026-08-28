## Purpose

Define a fail-closed, prefix-scoped reduction contract for reversible
source-bound disclosure pairs without losing replay paths or row-local controls.

## ADDED Requirements

### Requirement: Pair reduction requires exact source-bound equivalence

The runtime-sweep reveal discovery consumer SHALL consider a pair-level
reduction only for two reversible read-only disclosures whose exact prefix
fingerprint, source/plan/selector/role/profile/state/route context, URL, and
material surface are equal. Each disclosure SHALL expose a disjoint valid
`aria-controls` target, a boolean `aria-expanded` transition, and
`data-reveal-independence="source-bound-row-local"` in every candidate
before/after surface.

#### Scenario: A valid pair is proven in both orders

- **WHEN** the consumer has exact-prefix-scoped paths for `A → B` and `B → A`
  from the same prepared state
- **THEN** it verifies both paths, both target bindings, equal canonical URL,
  equal material surface, and disjoint targets before marking the pair proven
- **AND** it preserves both paths and every row-local control revealed by
  either path

#### Scenario: A pair misses any source-bound proof

- **WHEN** either order is absent, has a different URL/material surface, uses
  overlapping or incomplete targets, enters a modal/background boundary, or
  lacks the explicit source-bound marker
- **THEN** the consumer keeps the branch ordinary and does not reduce it

### Requirement: Prefix identity cannot cross-contaminate reduction

The consumer SHALL derive the pair lookup from a SHA-256 fingerprint over this
canonical ordered object:

```text
{
  initialUrl,
  initialRootSurfaceDigest,
  prefixSteps: [{
    controlKey,
    operation,
    safety,
    transition,
    beforeUrl,
    afterUrl,
    beforeSurfaceDigest,
    afterSurfaceDigest,
  }],
  exitUrl,
  exitSurfaceDigest,
}
```

A lookup SHALL remain bound to the exact source SHA, tree, plan, selector,
role, profile, state, and route context.

#### Scenario: Equivalent-looking pairs have different preparation prefixes

- **WHEN** two suffixes contain the same pair identities but their landing URL,
  root material, ordered prefix, or exact campaign context differs
- **THEN** the consumer performs no cross-prefix lookup and no reduction

#### Scenario: A three-toggle proof contains every directed pair order

- **WHEN** a multi-toggle candidate contains disclosures `A`, `B`, and `C`
- **THEN** its proof set contains exactly one each of `A→B`, `B→A`, `A→C`,
  `C→A`, `B→C`, and `C→B`
- **AND** any missing, duplicate, or conflicting order keeps the candidate
  ordinary and ineligible for reduction

### Requirement: Reduction never weakens exhaustive or capacity guards

The consumer SHALL retain the full replay path as the only replay authority,
retain every row-local control, and leave `maxControlsPerSegment`, URL,
modal/background, non-mutation, and fail-closed overflow guards unchanged.

#### Scenario: Pair proof does not cover the whole branch

- **WHEN** a branch contains an untrusted fourth disclosure or another
  ineligible step after a proven pair
- **THEN** the preceding branch remains ordinary and the additional control is
  explored without trimming or rewriting evidence

#### Scenario: The projected control count exceeds the cap

- **WHEN** a candidate cannot prove a reduction before the projected count is
  `maxControlsPerSegment + 1`
- **THEN** discovery throws the existing fail-closed capacity error and emits
  no completion, continuation, resume, or acceptance authority
