## Context

See `proposal.md` for the regression. The existing view model already supplies
canonical visible-stage order, raw and derived status, ownership, hidden-stage
metadata, and completeness. The current `StageChip` also owns the status glyph,
tooltip, lock cue, accessible name, focus treatment, and mobile touch floor.
Only responsive composition is wrong. The period dual-state, role-coverage,
destructive-database, and deferred-feature invariants are preserved unchanged.

## Goals / Non-Goals

**Goals:**

- Restore the connected SDLC-process gestalt on wide product cards.
- Keep the current accessible stage control and an overflow-safe narrow layout.
- Encode the visual invariant in structural tests and exact-source browser
  evidence so a later mobile repair cannot erase it silently.

**Non-Goals:**

- No alternate stage ordering, horizontal scroller, runtime viewport reads, or
  duplicated mobile component tree.
- No change to status persistence, risk flooring, ownership, filtering, or
  report lifecycle.

## Decisions

1. **One component tree, three CSS modes.** Below 48 rem the stage container is
   a two-column grid; from 48 rem through below 64 rem it is a four-column grid;
   at and above 64 rem it becomes one non-wrapping compact fixed-width arrow
   lane. CSS media variants avoid hydration drift and keep one semantic order.

2. **Connect adjacent rendered stages, not canonical placeholders.** The
   connector is emitted before every visible stage after the first. Mine mode
   therefore connects only the contribution being shown; Everyone connects the
   complete assigned pipeline. Unassigned and collapsed stages do not create
   orphan arrows.

3. **Keep the current accessible StageChip content, but restore compact wide
   geometry.** Status glyph, truncation-safe label, tooltip, lock badge, focus
   ring, and touch floor remain. In the wide lane every rendered stage gets the
   same named 6.625 rem (106 CSS px) width and cannot grow, so `Analysis` has
   identical geometry in two-, three-, five-, and seven-stage products. The
   sequence is centered in the available card space. Grid layouts use the
   available columns without a horizontal scroller; each stage remains at least
   44 px tall through tablet widths. A mechanical revert to the pre-regression
   component is rejected because it would discard later accessibility
   improvements.

4. **Use the existing shared height token.** A wide-only, `aria-hidden`
   connector box uses `STAGE_CHIP_BOX_HEIGHT`; its flex alignment cannot be
   affected by the assignee label below the neighboring chip.

5. **Test source structure and rendered geometry separately.** Component tests
   pin breakpoint classes, connector count/semantics, canonical order, grid
   placement, the `+N` tap/focus affordance, and preserved chip behavior.
   One-off Chrome checks measure connector/chip alignment, non-wrapping wide
   layout, two- and four-column grid boundaries, narrow overflow, touch targets,
   focus, and status interaction on the exact candidate SHA. No harness is
   tracked.

6. **Keep the Lead toolbar explicit at every breakpoint.** Below 48 rem the
   context toolbar stays in normal flow and may use at most two explicit rows;
   no spacer-only row or clipped control is allowed, and period-navigation
   arrows retain the 44 px phone touch floor. At 48 rem and above the toolbar
   is sticky and retains the compact desktop control height. A single named,
   conditional form-owned source reserves content space for the fixed
   completion rail; route containers must not add competing clearance.

## Risks / Trade-offs

- **[Risk] Seven stages plus connectors do not fit near 1024 px.** → Use a
  compact fixed stage width, small fixed gaps, `min-w-0`, and full accessible
  names/tooltips; measure the seeded seven-stage card at the breakpoint and
  raise the breakpoint if the card still overflows.
- **[Risk] A connector appears detached after filtering.** → Derive connectors
  only from the final `visibleStages` sequence and assert count `N - 1`.
- **[Risk] Responsive styles reintroduce root overflow.** → Keep the wide lane
  fixed-width, use two/four-column grids below the breakpoint, prohibit
  horizontal swiping, and verify root/card `scrollWidth <= clientWidth` at
  boundary viewports.

## Migration Plan

1. Replace the unconditional row contract and focused tests in one change.
2. Verify focused Web tests, typecheck/lint, strict OpenSpec, and real Chrome at
   desktop, 1024 px landscape, 768 px portrait, and 375 px phone.
3. Sync and archive the accepted delta, then rerun final exact-SHA acceptance.

Rollback is an ordinary source revert plus a forward OpenSpec change; archived
planning history is never rewritten.
