# Head slides use the shared carousel and fullscreen model

**Date:** 2026-06-22

**Status:** accepted and implemented.

The head slide deck uses the same navigation model as the lead deck:

- a top horizontal carousel replaces the lead list sidebar;
- the active slide fills the viewport;
- readiness is a compact strip within the active slide;
- slide status is rendered once.

The data scope remains role-specific: the head sees all authorized lead data,
while a lead sees only the lead's permitted data. Framed cards, token-driven
stripes, and the token-only color rule remain the visual primitives.
