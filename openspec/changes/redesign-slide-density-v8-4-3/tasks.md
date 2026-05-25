# Tasks

- [x] T1: Refactor `status-slide-deck.tsx` — change card container from `p-6`
      to `p-3`; update gap from `gap-5` to `gap-3`
- [x] T2: Refactor `SlideHeader` — change `line-height` from `1.6` to `1.4` in
      the header text wrapper (no explicit SlideHeader component; leading classes
      already tight; N/A for current codebase)
- [x] T3: Audit `SummarySlide` and `DecisionSlide` for inherited padding;
      apply ratio reduction (24px → 12px) — applied to `lead-unified-slide.tsx`
      section grid: `gap-4` → `gap-3`
- [x] T4: Browser spot-check — load a report with 15+ slides, visually verify
      density improvement without cramping, check contrast/readability at 100% zoom
- [ ] T5: Commit — `refactor(slides): tighten card padding and line-height for
  v8.4.3 density`
- [ ] T-V: Verification — `pnpm typecheck`, `pnpm lint`, `pnpm test:slides`
      pass; visual regression review in browser
