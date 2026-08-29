# Slice boundaries ride index.ts barrels, enforced by ESLint zones

**Status:** accepted (2026-07-14; revisit scheduled after the 2026-07-14
review backlog is implemented)

## Context

Both apps enforce internal boundaries mechanically: api modules and web
feature slices may reach a sibling only through that sibling's `index.ts`
(`import-x/no-restricted-paths` zones in `eslint.config.ts`; the last
grandfathered raw-path edges were retired on 2026-07-14). The barrel is the
carrier of the boundary: the zone allowlist is generated from sibling
`index.ts` paths, so a new cross-slice edge is legal only through the facade.

Industry guidance pushes the other way for app-internal code: internal barrel
files can increase compile and bundle costs and introduce cycle risk. The
trade-off is explicit in the target architecture: barrels are limited to
curated public surfaces, while convenience re-export trees are prohibited.

## Decision

Keep barrel-carried boundaries. Rationale for diverging from the
anti-barrel guidance:

- Our barrels are **curated public surfaces** (the condition under which
  even the anti-barrel sources accept them), not convenience re-export dumps;
  every export exists because a sibling consumes it.
- The boundary itself is enforced by ESLint zones, and the barrel is what
  makes the zone allowlist generative — no per-edge grandfather list to
  maintain.
- The measured cost is currently acceptable: webpack production build stays
  green through three mutual barrel pairs, and no TDZ/cycle incident has
  surfaced in vitest, SSR, or live hydration.

During the 2026-07-14 review-backlog implementation the mechanism is
**frozen**: no new barrel exports beyond what a fix strictly needs, no
reversal work mixed into correctness changes.

## Consequences

- Cross-slice imports stay uniform and mechanically checkable; deep imports
  are lint errors, not review nits.
- We accept the bundler evaluating whole barrels; if build time or bundle
  size regresses measurably, that is the revisit trigger.
- Revisit (after the backlog): pilot zone-enforced boundaries WITHOUT a
  barrel on one representative slice (direct imports allowed through an
  explicit per-file allowlist) and compare build cost, cycle risk, and
  ergonomics before any repo-wide change.
