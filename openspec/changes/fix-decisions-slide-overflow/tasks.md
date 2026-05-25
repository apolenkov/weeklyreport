# Tasks

- [ ] T1: Add scrollable container to decision section on slide deck — edit
      `apps/web/src/components/slides/decision-slide-section.tsx`, wrap cards
      in `<div className="overflow-y-auto max-h-[400px]">` (exact height TBD
      per visual audit)
- [ ] T2: Add exit-fullscreen button — add button in decision slide header or
      reuse existing close mechanism; ensure Esc key also works
- [ ] T3: Test scroll behavior — open decision slide, add 8+ decisions, verify
      scroll works and doesn't hide last item
- [ ] T4: Test exit paths — verify both button click and Esc key exit fullscreen
      cleanly
- [ ] T-V: Verification — `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass;
      manual spot-check in dev slide view
