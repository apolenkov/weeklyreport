# Add landing tagline cycler

## Problem

Landing page hero section displays a single static tagline. Product wants
dynamic messaging that cycles through multiple taglines on page load or timed
rotation to increase engagement.

## Solution

Implement `TaglineCycler` component (exists as TODO stub at
`apps/web/src/components/landing/tagline-cycler.tsx:11`) with:

1. Array of 4–6 product taglines (source: product docs or copy audit).
2. Rotation strategy: either pick a random tagline on load, or cycle with
   1.5–3s interval per tagline (fade-in/out CSS transition).
3. Integrate into landing hero section; replace hardcoded tagline string.
4. No build blocker or feature flag — activate immediately.

## Non-goals

- i18n support (taglines stay English for now; see `enable-i18n` deferred
  change).
- Analytics tracking or rotation impression logging.
- Configuration UI for taglines.

## Status

Open — TODO(UFB-062-cycling) in codebase.
