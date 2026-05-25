# Enable i18n

## Problem

UI strings are currently hardcoded English (per CLAUDE.md: "Static production
UI strings stay English until a real i18n phase exists"). Landing page tagline
cycler and theme switcher both have TODO(i18n-future) markers. RU/EN locale
switcher in nav bar is inert. Phase 58 roadmap includes i18n: UI text in both
Russian and English, user selectable.

## Solution

1. Extract all hardcoded UI strings from components into `.intl/messages/`
   JSON files (next-intl or similar i18n library).
2. Add locale switcher to nav bar; persist user preference to localStorage or
   database.
3. Wrap app with locale provider; inject locale into all components.
4. Provide RU and EN message files for all UI surfaces.

## Activation trigger

**Phase 58 milestone** — i18n is a Phase 58 scope item. Activate only when
Phase 58 is unlocked and i18n library is chosen.

## Non-goals

- Translate backend API errors (API errors stay English).
- Translate database seed data (product/group names stay as-is).

## Status

Deferred — TODO(i18n-future) in `nav-bar.tsx:162`, `tagline-cycler.tsx:19`.
