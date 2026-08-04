# Enable theme switch

## Problem

Dark/light theme toggle exists in nav bar as `ThemeComingSoonControl`
(ComingSoonBadge). CLAUDE.md visual rules require research memo + explicit
user sign-off before implementing theme work. Currently, only light theme is
available.

## Solution

1. **Research phase** (required): audit current color tokens, design dark
   palette, produce mockups showing light + dark versions of key surfaces
   (reports, landing, nav).
2. **Implementation** (after approval): add theme toggler to nav bar,
   implement dark Tailwind config, apply `dark:` prefixed utilities to
   components, store preference in localStorage.

## Activation trigger

**Design research approval** — this change cannot move to implementation until:

1. Research memo in `.planning/research/theme-dark-exploration.md` approved by
   user.
2. Mockups show light + dark versions of ≥3 core UI surfaces.
3. User explicitly confirms: "proceed with dark theme implementation".

## Non-goals

- Implement system-preference detection (manual toggle only).
- Change brand colors or rebrand.

## Status

Deferred — TODO(theme-future) in
`apps/web/src/shared/ui/navigation/coming-soon-controls.tsx` (the inert Theme
coming-soon control). Research phase blocked pending approval.
