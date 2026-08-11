## Context

See `proposal.md` for the visual defect. The document root fits the iPhone viewport, but the `Current week items` board recorded a 52 px horizontal scroll offset. The mobile board has one grid column; an item-card header contains non-shrinking metadata and multiple fixed-size action controls, which can make the card wider than the board.

## Goals / Non-Goals

**Goals:**

- Let item metadata and actions reflow within a single mobile card column.
- Preserve 44 px action targets and all lifecycle actions.
- Prove both root and nested board geometry after an item dialog closes.

**Non-Goals:**

- Hide wide content with clipping or remove actions.
- Change item lifecycle, permissions, request paths, or mutation behavior.
- Redesign the fixed completion rail.

## Decisions

### Reflow the intrinsic-width source instead of hiding overflow

The card header/action region will use responsive wrapping or equivalent bounded layout below 48 rem while keeping the existing desktop arrangement. This addresses the element that creates the excessive intrinsic width. Applying `overflow-x-hidden` to the board was rejected because it would preserve the inaccessible off-screen actions and merely conceal the evidence.

### Retain action size and semantics

All visible item actions keep their existing 44 px mobile hit area, accessible names, order, and handlers. The solution may move actions to another line on mobile but must not collapse them into a new menu or change lifecycle behavior in this bounded fix.

### Verify nested scroll containers explicitly

The browser evidence will compare each current-week and next-week board's `scrollWidth` with `clientWidth` and require `scrollLeft` to remain zero after dialog open/close. A document-root width check remains useful but is insufficient because nested scroll containers can overflow while the root still fits.

### Preserve load-bearing invariants

This is a CSS/layout change. Period dual-state, role-coverage chains, the destructive-database guard, and the deferred-feature pattern are preserved. There is no API, schema, persistent-write, feature-flag, or rollout-order change.

## Risks / Trade-offs

- [Mobile cards become taller] -> accept vertical growth to preserve readable content and 44 px actions; inspect both supported mobile profiles.
- [Wrapping changes desktop density] -> scope reflow below 48 rem and pin the desktop class contract in focused tests.
- [A different card state still overflows] -> exercise populated current-week and next-week fixtures and measure every matching board, not only the first card.

## Migration Plan

No data or API migration is required. Deploy the responsive layout change with focused tests and source-bound browser evidence. Rollback is a source revert with no persistent-state cleanup.
