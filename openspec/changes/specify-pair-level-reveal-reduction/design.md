## Context

The current reveal canonicalization requires three eligible disclosure steps.
The exact Admin/demo trace has one URL-changing navigation prefix followed by
two same-URL row-local toggles and fails at `8199` projected controls against
the unchanged `8192` cap. The approved offline simulation shows that a
deeper-only prefix slice cannot reach the three-step minimum; a pair-level
candidate is the only bounded decision-changing hypothesis. See `proposal.md`
and the exact packet under `customreport-archive/2026-08-21-runtime-source-e657c5cf-admin-demo-5.19/`.

## Goals / Non-Goals

**Goals:**

- Specify a pair-level equivalence boundary that is exact-prefix scoped and
  source-bound.
- Preserve replay authority, both observed paths, every row-local control, and
  all existing fail-closed guards.
- Make the proof and registration-saving effect deterministic before any code
  or runtime authorization.

**Non-Goals:**

- No cap increase, graph trimming, retry, path rewrite, or product behavior.
- No browser/runtime/DB/Redis/Docker execution in this design phase.
- No assertion that live target binding or seven saved registrations exists.

## Decisions

1. **Use the full path as authority.** Derive a non-authoritative pair view;
   never synthesize a path, surface, control, receipt, continuation, or result.
2. **Bind identity to preparation.** Hash the canonical ordered object
   `{initialUrl, initialRootSurfaceDigest, prefixSteps: [{controlKey,
operation, safety, transition, beforeUrl, afterUrl, beforeSurfaceDigest,
afterSurfaceDigest}], exitUrl, exitSurfaceDigest}`. Also require the
   existing exact source, tree, plan, selector, role, profile, state, and route
   key.
3. **Require both directions for every pair.** For a three-toggle fixture, the
   proof set is exactly `A→B`, `B→A`, `A→C`, `C→A`, `B→C`, and `C→B`.
4. **Validate targets in every surface.** Require disjoint valid targets,
   boolean expanded transitions, the source-bound marker, equal URL/material,
   and complete target regions. Any missing fact keeps the branch ordinary.
5. **Keep capacity semantics unchanged.** A reduction may be accepted only
   after a deterministic registration-savings proof. The observed packet needs
   at least seven avoided registrations to fit under the cap; this is a
   sensitivity threshold, not a live claim.

Alternatives rejected: lowering the three-step minimum alone (does not reach
the observed two-toggle frontier); increasing the cap (hides the boundary);
trimming controls or paths (loses exhaustive evidence); and treating one pair
order as higher-order proof (insufficient).

## Risks / Trade-offs

- **[Risk] Pair equivalence may be over-generalized.** → Keep exact prefix and
  campaign identity, target validation, and material/URL equality mandatory.
- **[Risk] A pair proof may save fewer than seven registrations.** → Require
  deterministic savings evidence before implementation; otherwise retain the
  ordinary fail-closed branch.
- **[Risk] Live DOM evidence may be incomplete.** → Keep the candidate
  `NOT-PROVEN` and do not authorize a canary until a fresh code gate and bounded
  exact-SHA runtime proof exist.

## Migration Plan

No migration or production rollout is authorized by this design. If the delta
is later accepted and a separate implementation authorization is granted,
implement behind the unchanged cap and guards, run focused deterministic tests,
obtain a fresh Sol code gate, and only then run one source-bound exact
Admin/demo canary. Rollback is deletion/revert of the candidate reduction
while retaining ordinary exhaustive discovery.

## Open Questions

None for the specification boundary. The live registration-saving effect and
complete target-region binding are evidence tasks, not unresolved design
choices.
