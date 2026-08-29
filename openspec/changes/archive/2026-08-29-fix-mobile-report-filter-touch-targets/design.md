## Context

See `proposal.md` for the runtime finding. The ownership filter uses an explicit compact width that remains 40 px on an iPhone-sized viewport even though the shared mobile touch-target token is 44 px.

## Goals / Non-Goals

**Goals:**

- Apply the existing 44 px touch-target floor to every option in the ownership filter below 48 rem.
- Preserve desktop density and all filter semantics.

**Non-Goals:**

- Change labels, option order, selected-state logic, report queries, or permissions.
- Add a new sizing token or breakpoint.

## Decisions

### Reuse the shared mobile touch-target token

Each filter option will use the existing mobile-only minimum width and height token while keeping its compact desktop classes. Reusing the shared token keeps the fix consistent with navigation, toolbar, and Fill From controls and avoids a filter-specific magic size.

### Preserve behavior and invariants

This is a CSS-only change. Period dual-state, role-coverage chains, the destructive-database guard, and the deferred-feature pattern are preserved. There is no request, schema, database, or rollout-order change.

### Verify focused classes and rendered geometry

The component test will pin the mobile-only floor and desktop classes. The source-bound browser pass remains the proof of the actual rendered dimensions and horizontal fit.

## Risks / Trade-offs

- [The mobile filter becomes slightly wider] -> use the established 44 px token and verify root and nested horizontal fit.
- [Desktop density changes accidentally] -> scope the new minimum to viewports below 48 rem and pin the desktop contract.

## Migration Plan

No data or API migration is required. Deploy the responsive class change with focused and browser evidence. Rollback is a source revert.
