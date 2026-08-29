## Context

See `proposal.md` for the runtime finding. The shared theme defines `--toolbar-control-h` as 32 px on desktop and remaps it to the 44 px `--touch-target-min` below 48 rem. Report-shell controls already use that responsive token, but the navigation Theme, Language, Sign out, and skeleton elements hard-code `h-8`; the icon buttons also hard-code a 40 px width.

## Goals / Non-Goals

**Goals:**

- Reuse the established responsive density token for navigation rail geometry.
- Keep all three user-visible rail controls consistent through one responsive contract.
- Make the pre-hydration skeleton reserve the same geometry.

**Non-Goals:**

- Change control order, labels, routes, session behavior, tooltips, or desktop information density.
- Introduce a second breakpoint or a navigation-specific size token.

## Decisions

### Reuse the toolbar height token in the navigation rail

The shared Coming Soon `nav` shape and the web Sign out button will use `--toolbar-control-h` for height and minimum width. Their existing desktop width may remain wider than the token; on mobile, the token supplies the 44 px floor in both dimensions.

This is preferred to adding `max-md:h-11` at each consumer because the existing theme token already owns the 32 px desktop to 44 px mobile transition. It also avoids changing `--touch-target-min` or adding a navigation-only token.

### Keep deferred controls behavior-neutral

Theme and Language remain inert buttons with their current accessible names and shared `ComingSoonBadge` tooltip. The change modifies only rendered geometry. The deferred-feature pattern is preserved; period dual-state, role coverage, and destructive database guards are unaffected.

### Test the primitive and each web rail consumer

The shared primitive test will pin token use for the `nav` shape. Web navigation tests will pin Sign out and skeleton parity. The source-bound mobile browser pass remains the rendered-geometry proof.

## Risks / Trade-offs

- [The mobile rail becomes wider] -> use the existing 44 px product token and keep the 2.5 spacing gap; validate at the 390 px viewport for overflow.
- [Skeleton and hydrated controls diverge] -> assert the same height and minimum-width token in focused tests.
- [Desktop density changes accidentally] -> preserve the token's 32 px desktop value and existing explicit widths.

## Migration Plan

No data or API migration is required. Deploy the CSS-class change with focused component tests and the mobile browser evidence. Rollback is a source revert; no persistent state changes.
