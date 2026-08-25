## Context

See `proposal.md` for the runtime finding. The Fill From split-button container uses the responsive toolbar-height token and a 1 px border. Its child segments use `height: 100%`, so the container's two border pixels reduce each rendered child box from 44 px to 42 px on mobile. The existing width floor already uses the shared 44 px touch-target token.

## Goals / Non-Goals

**Goals:**

- Reuse the established mobile touch-target token for each actionable split-button segment.
- Preserve the compact desktop toolbar height.
- Verify the actual rendered geometry in the source-bound mobile browser pass.

**Non-Goals:**

- Change Fill From mutations, source-period selection, labels, or menu behavior.
- Change the toolbar-height or touch-target tokens.
- Modify API, database, authorization, or period state.

## Decisions

### Floor each actionable segment below the mobile breakpoint

Both child segments will use the existing mobile touch-target token as their responsive minimum width and height. The container retains its existing toolbar-height token and border. This fixes the element that owns the interactive hit area instead of increasing the whole toolbar or adding a new component-specific token.

An unconditional minimum height was rejected because it would expand the compact desktop control. Increasing the container height was rejected because the child `height: 100%` would still lose the border pixels and because it would alter adjacent toolbar geometry.

### Keep behavior and load-bearing invariants unchanged

The change is CSS-only. Period dual-state, role-coverage chains, the destructive-database guard, and the deferred-feature pattern are preserved. There is no request path, shared schema, persistent write, or rollout-order change.

### Combine focused and rendered checks

The component test pins the mobile-only token classes and the desktop token contract. The source-bound browser pass measures both rendered dimensions at an authenticated mobile viewport and checks that the document does not overflow horizontally.

## Risks / Trade-offs

- [A 44 px child extends into the bordered container edge] -> keep the parent at the same 44 px outer height and verify the rendered child box and visible control in Chromium.
- [The split button becomes wider on narrow screens] -> retain the existing 44 px width floor and assert document width against viewport width.
- [Desktop density changes accidentally] -> apply the new minimum height only below 48 rem and retain the existing desktop toolbar-height token.

## Migration Plan

No data or API migration is required. Deploy the CSS-class change with its focused test and mobile browser evidence. Rollback is a source revert; no persistent state changes need reversal.
