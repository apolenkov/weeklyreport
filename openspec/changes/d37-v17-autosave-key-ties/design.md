# Design

## Context

See `proposal.md` for the C2689 evidence and owning contract. The existing
encoder sorts object properties with `Intl.Collator("en-US")`. Canonically
equivalent but distinct accent keys compare equally and retain insertion
order. The draft and reconciliation consumers use fixed schema property names.

## Goals / Non-Goals

**Goals:** Repair insertion independence at the helper boundary while
preserving every nonzero collator result.

**Non-Goals:** Introduce product fields, normalize key names, change period
ordering, or promise identical results across ICU versions.

## Decisions

Keep the collator and use JavaScript string comparison only when it reports
zero for distinct keys. Replacing locale ordering entirely would change
existing non-tied output beyond the proven defect. Extend the existing
insertion-order test rather than adding a second test owner or a production
export. Its mixed-case control protects existing nonzero collation.

## Risks / Trade-offs

- Unicode tie fixtures protect the independently declared helper contract;
  they are not reachable product payload fields. Do not infer product loss.
- Locale ordering remains runtime-dependent. Cross-ICU behavior and speed
  remain unmeasured and do not justify a performance claim.
- No persistence, lifecycle, authorization, or schema changes are involved.
  Reverting this helper/test patch restores the prior behavior without migration.
