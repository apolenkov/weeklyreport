# Catalog — web-comp-landing (2026-07-02)

4 files. Purpose/layer/domain per file, for the architecture-grouping analysis.

| File                                                      | Layer     | Domain  | Purpose                                                                                                                                            | Key exports      | Deps                                                                          |
| --------------------------------------------------------- | --------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------- |
| apps/web/src/components/landing/landing-page.constants.ts | config    | landing | Static list of cadence-neutral taglines cycled on the landing hero.                                                                                | LANDING_TAGLINES | none (consumed by tagline-cycler component)                                   |
| apps/web/src/components/landing/pulse-background.tsx      | component | landing | Zero-JS static decorative background (gradient + dot grid) for the landing page's left column; motion/heartbeat motif previously here was removed. | PulseBackground  | pulse.css styles (className hooks only)                                       |
| apps/web/src/components/landing/pulse-mark.tsx            | component | landing | Landing hero wordmark rendering the static 'WEEKLY REPORT' brand mark (formerly an animated 'Your PULSE' mark, now static text only).              | PulseMark        | pulse.css styles (className hooks only)                                       |
| apps/web/src/components/landing/tagline-cycler.tsx        | component | landing | Client component that auto-rotates a randomized landing-hero tagline through a fade-out/swap/fade-in cycle using a setTimeout chain.               | TaglineCycler    | LANDING_TAGLINES from landing-page.constants; React useState/useEffect/useRef |

</content>
