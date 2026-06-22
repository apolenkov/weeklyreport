# Restyle the `+N more` collapsed-stages tooltip to a softer surface

## Why

The lead found the `+N more` collapsed-stages reveal harsher than the rest of
the UI: it renders on the shared Radix default dark surface
(`bg-foreground`/`text-background` — white-on-black), which reads heavier than
the new amber ComingSoon badge and the app's light popovers. This is the
deferred "+N more restyle" decision pulled out of `fix-coming-soon-tooltip-clipping`
(its design Decision 2): the restyle waited on a concrete user direction so it
would not violate the repo "Visual And Theme Work" rule.

## What changes

- The `CollapsedStagesIndicator`'s tooltip surface only is restyled to the
  light popover tokens already used by `dropdown-menu`/`select`
  (`border bg-popover text-popover-foreground shadow-md`), with the dark Radix
  arrow hidden (`hideArrow`). It is a `className` override on that one
  `TooltipContent`.
- The SHARED dark `TooltipContent` default is left UNTOUCHED — stage chips and
  the sidebar keep the dark surface. The restyle does not introduce a token,
  theme, or background change; it reuses existing popover tokens on one control.
- The reveal content, the owned-vs-vacant wording, and the non-visual
  `aria-label` path are unchanged.

## Impact

- Affected spec: `lead-pipeline-card` (MODIFIED: "The collapsed-stages indicator
  reveals through the styled tooltip").
- Affected code: `apps/web/src/components/lead/sdlc-collapsed-indicator.tsx`
  (+ a guard in `sdlc-pipeline.test.tsx`).
- Scope is one indicator; no other tooltip consumer changes.
