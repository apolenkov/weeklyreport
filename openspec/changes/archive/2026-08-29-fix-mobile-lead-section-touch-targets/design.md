## Context

See `proposal.md` for the aggregated runtime measurement. The section disclosure buttons and sticky Submit action retain explicit compact dimensions on an iPhone-sized viewport instead of applying the established 44 px mobile touch-target floor.

## Goals / Non-Goals

**Goals:**

- Apply one existing responsive touch-target contract to all four section disclosures.
- Apply the same mobile height floor to every actionable sticky completion control.
- Preserve desktop density and all state semantics.

**Non-Goals:**

- Change section information architecture, rail placement, labels, or business behavior.
- Treat framework development tools as product controls.
- Add a new token or breakpoint.

## Decisions

### Reuse the shared mobile touch-target token at the shared owners

The common section disclosure control will apply the existing mobile-only minimum width and height so all four consumers change together. The sticky completion rail will apply the same floor to each actionable button. This avoids repeated page-level overrides and keeps desktop classes intact.

### Aggregate rendered evidence

The browser helper collects every undersized product button before failing, so one source-bound pass reports the complete remaining set. The exact Next.js development-tools button is excluded because it is environment chrome and is absent from the product build.

### Preserve load-bearing invariants

These are CSS-only changes. Period dual-state, role-coverage chains, the destructive-database guard, and the deferred-feature pattern are preserved. There is no request, schema, persistent-write, or rollout-order change.

## Risks / Trade-offs

- [Mobile section headers or rail actions need more space] -> use the existing 44 px token and verify root and nested horizontal fit on both supported mobile profiles.
- [Desktop density changes accidentally] -> scope minimums below 48 rem and pin existing desktop classes in focused tests.
- [A disabled action is omitted from measurement] -> measure every visible button, including disabled controls.

## Migration Plan

No data or API migration is required. Deploy the responsive class changes with focused and source-bound browser evidence. Rollback is a source revert.
