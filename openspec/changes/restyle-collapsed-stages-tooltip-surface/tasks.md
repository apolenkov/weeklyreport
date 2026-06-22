# Tasks

## 1. Web — restyle the one indicator

- [x] 1.1 In `apps/web/src/components/lead/sdlc-collapsed-indicator.tsx`, override
      the `TooltipContent` className to the light popover tokens
      (`border bg-popover text-popover-foreground shadow-md text-left`) and pass
      `hideArrow` so the dark Radix arrow does not clash with the light surface.
      The shared dark `TooltipContent` default is NOT modified.

## 2. Tests

- [x] 2.1 Added a guard in `sdlc-pipeline.test.tsx`: on hover the visible reveal
      content (`[data-slot="tooltip-content"]`) uses `bg-popover` and NOT
      `bg-foreground`. The existing `#89` reveal-text and `#90` severity-colour
      tests still pass (they read the sr-only reveal node + the indicator style,
      neither of which the restyle touches).

## 3. Specs

- [x] 3.1 `lead-pipeline-card` delta — MODIFIED "The collapsed-stages indicator
      reveals through the styled tooltip" to require the softer light popover
      surface on the indicator while leaving the shared dark default for other
      consumers.

## 4. Verification

- [x] 4.1 `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green
      (combined gate on the implementation branch).
- [ ] 4.2 Live: in Mine mode hover the `+N more` indicator — the reveal shows on
      the light popover surface (not white-on-black); stage-chip and sidebar
      tooltips stay dark. (Live-verify phase — see handoff.)
- [x] 4.3 `openspec validate restyle-collapsed-stages-tooltip-surface --strict`.
