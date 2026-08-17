## Context

See `proposal.md`. Runtime measurement showed Next route focus moving `main#main-content` to viewport top (`scrollY=67`) and Dashboard actions shifting `15.375px` when `Details` becomes `Less`, while source inspection found intrinsic-height History emptiness, flex-wrapped document actions, auto-sized Dashboard action columns, and deck-owned density toolbars. Existing paper tokens, report toolbar primitives, and Coming-Soon primitives are retained.

## Goals / Non-Goals

**Goals:**

- Fix the four observed desktop composition defects through shared layout seams.
- Keep the result token-driven, accessible, and cheap to render.
- Preserve current report behavior and produce fresh source-bound evidence.

**Non-Goals:**

- Mobile redesign, new dependencies, animated art, data/query changes, or slide-template implementation.
- Sticky navigation as a workaround for route focus-scroll.

## Decisions

### Preserve the owner-approved Head Status composition as the desktop baseline

The 2026-08-17 owner walkthrough accepted the Head Status composition as the visual baseline: restrained density, aligned geometry, compact controls, a quiet decorative background, and stable element positions without unnecessary rows. Follow-on desktop surfaces SHOULD converge on that language without mechanically duplicating the page or redesigning the accepted baseline without a concrete defect.

### Disable automatic route scroll only on desktop primary links

Desktop Next links use `scroll={false}` so focus remains on the activating navigation control and `main` is not native-focus scrolled below the static header. The accessible `tabIndex={-1}` main targets and skip-link contract remain unchanged. Sticky navigation and removal of main focusability were rejected because they mask the cause or regress accessibility.

### Use one decorative application surface

Desktop application mains share a CSS-only paper surface built from existing semantic colors and non-interactive pseudo/background layers. Shapes carry no text, status, or function; card layers remain opaque enough for contrast. External images and animation were rejected as unnecessary cost and distraction.

### Repair layout ownership at existing seams

History owns its grid-row height; both Head headers use a desktop `minmax(0,1fr) auto` grid; Head and hosted Lead slide density state moves to their report shells so each control can join its trailing context cluster. Standalone Lead decks keep their local density control. This preserves DOM focus order and the existing period, scope, density, fullscreen, and publication models.

### Reserve Dashboard action geometry

The two trailing desktop queue tracks use fixed compact widths sized for every primary and disclosure label. Skeleton rows use the same tracks, control heights, and minimum row height as loaded rows. Expansion may add detail height, but it does not move the summary-row actions.

### Separate working density from deferred templates

Document/Presentation remains functional in Head and hosted Lead report chrome. A single shared Coming-Soon control names only `Slide templates` in Head slides mode, and `openspec/deferred/add-slide-template-selection` records the future catalog, preview, persistence, and export work. No feature flag is added.

## Risks / Trade-offs

- [Risk] Decorative layers reduce text contrast. -> Keep them behind opaque/tokenized surfaces and run contrast/axe checks.
- [Risk] `scroll={false}` preserves a non-zero user scroll on navigation. -> The primary regression is scoped to top-of-page activation and browser acceptance asserts zero; future deliberate scroll-restoration policy remains separate.
- [Risk] Moving density state changes deck lifecycle. -> Keep the same state values and add focused reversibility/record-preservation tests.
- [Risk] Fixed Dashboard action tracks clip a label. -> Size both tracks for the longest current primary/disclosure label and verify the live seeded queue.
- [Risk] Header actions still wrap below desktop breakpoint. -> This is intentional because mobile redesign is out of scope and controls must remain reachable.

## Migration Plan

Land one frontend/OpenSpec commit, run focused tests and desktop visual acceptance, then repeat the exact-SHA runtime sweep. Rollback is a normal commit revert; no data, configuration, flag, or credential migration exists. Period dual-state, role-coverage, and destructive-database invariants are preserved; the deferred-feature invariant is strengthened.

The product implementation and visual evidence are bound to commit `8c59ef306399c6bad6b6c62664bcc6ff93bc8b99` / tree `09c1a80eeb90ea1f87c4de4835956d53eba67caf`. Closing task metadata is permitted only as a direct metadata-only descendant so the product SHA remains the runtime and screenshot authority.
