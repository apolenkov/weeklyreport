# Landing hero: «Weekly Report» wordmark, drop the pulse motif

## Problem

Live demo feedback (2026-06-23) on the landing/login left hero:

- The hero brand wordmark currently reads «YOUR / PULSE» (Phase 58
  `PulseMark`). The owner wants it to read **Weekly Report** instead —
  the landing should name the artifact users come for, not carry the
  pulse brand.
- The hero animates: the «PULSE» word breathes (`pulse-breathe`) and a
  golden ECG/heartbeat trace sweeps across the background
  (`pulse-ecg-scan`). The owner wants the **pulse animation removed**
  from the landing.

Feedback was captured on the login page because the target slides URL
(`/lead/report/...?mode=slides`) redirects unauthenticated visitors to
`/`; the annotations land on the login hero, which is the surface in
scope here.

This intentionally reverses the decorative half of the Phase 58 «Your
PULSE» rebrand on the landing. It does NOT touch the product name
elsewhere (right-panel «Status Reporting System», nav brand-pill) — that
stays a separate decision.

## What changes

Scope: the landing/login left hero only
(`apps/web/src/app/login-page.client.tsx` + the `landing/` components +
`apps/web/src/styles/pulse.css`).

1. **Wordmark → «Weekly Report».** Replace the «YOUR / PULSE» lettering
   with a two-tier mark: eyebrow **WEEKLY** + display **REPORT**
   (variant A — keeps the existing two-row rhythm and the Fraunces
   display face). The `role="img"` accessible name and the page's
   `sr-only` `<h1>` become **Weekly Report**.
2. **Remove the pulse animation.** Drop the breathing-weight animation
   on the display word and remove the ECG/heartbeat trace entirely
   (both tracks + the SVG layer). The word renders static.
3. **Keep the rest.** The dark-green gradient column, the static dot
   grid, the gold hairline, and the tagline cycler (its own fade
   transition, governed by the existing `landing-page-hero` spec) stay.
4. **Clean up.** Delete the now-dead pulse keyframes
   (`pulse-breathe`, `pulse-ecg-scan`, `pulse-q-breathe`,
   `pulse-q-dot`) and the now-empty `prefers-reduced-motion` overrides
   that targeted them.

## Impact

- Affected specs: `landing-page-hero` (ADD two requirements — brand
  wordmark text + no decorative pulse motion). The existing tagline
  requirements are unchanged.
- Affected code:
  - `apps/web/src/components/landing/pulse-mark.tsx`
  - `apps/web/src/components/landing/pulse-background.tsx`
  - `apps/web/src/styles/pulse.css`
  - `apps/web/src/app/login-page.client.tsx` (sr-only `<h1>` + comments)
  - tests: `pulse-mark.test.tsx`, `pulse-background.test.tsx`,
    landing `__snapshots__/`
- UI strings stay English (`Weekly Report`) per repo rule.
- No schema, API, or data changes.
