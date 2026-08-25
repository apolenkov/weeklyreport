## Context

See `proposal.md` for the aggregated runtime measurement. The Products tab repeats three compact row controls for each product. Their fixed 28 px and 34 px dimensions do not adopt the product's 44 px mobile touch-target token.

## Goals / Non-Goals

**Goals:**

- Apply one responsive geometry contract at the shared product-row owners so every repeated row is repaired.
- Preserve desktop table density and all control state semantics.
- Verify mobile viewport fit after the repeated controls enlarge.

**Non-Goals:**

- Change product management data flow, mutations, permissions, or other admin resources.
- Replace the controls with a new overflow menu.
- Add a new sizing token or breakpoint.

## Decisions

### Apply the shared mobile touch floor to each product-row control type

The disclosure and row action owners will apply the existing mobile-only 44 px minimum width and height while preserving their compact desktop classes. Fixing the shared row source updates all product rows consistently without page-specific selectors.

### Preserve action semantics and viewport fit

Accessible names, `aria-expanded`, dialog and archive handlers, and disabled behavior remain unchanged. The browser evidence measures every visible product control and the root document width so the larger targets do not trade accessibility for horizontal overflow.

### Preserve load-bearing invariants

This is a CSS/layout change. Period dual-state, role-coverage chains, the destructive-database guard, and the deferred-feature pattern are preserved. There is no request, schema, persistent-write, migration, feature-flag, or rollout-order change.

## Risks / Trade-offs

- [Repeated larger controls make rows taller] -> accept mobile vertical growth while retaining compact desktop classes.
- [Controls crowd narrow rows] -> allow the existing mobile row layout to reflow and verify root horizontal fit on iPhone 14 and Pixel 7.
- [One state uses a different class path] -> test disclosure state and both row actions through their direct component surface.

## Migration Plan

No data or API migration is required. Deploy the responsive class change with focused and browser evidence. Rollback is a source revert.
