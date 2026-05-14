---
phase: 40
status: parked
parent_milestone: v8.1
title: "B2B Rebrand & Dark Mode"
---

# Phase 40: B2B Rebrand & Dark Mode

**Goal:** Park full dark mode/theme switching/background work out of v8.1 and keep only a top-menu Theme Coming Soon signal.

**Depends on:** none

**Requirements:** BRAND-PARKED

**Plans:** 1 (parked scope decision)

- 40-01: PRD — rebrand goals, palette, typography, motion. Output: `docs/REBRAND-PRD.md` + design tokens spec.
- 40-02: Design tokens — `[data-theme="dark"]` block in `packages/ui/src/styles/globals.css` + light B2B refresh.
- 40-03: Theme toggle UI — nav-bar sun/moon button, `localStorage.theme` + `prefers-color-scheme` fallback.
- 40-04: Component audit pass — every page, every dialog, every chart in both themes.
- 40-05: Screenshot evidence — 5 routes × 2 themes × 3 viewports = 30 screenshots.

**Status:** parked — moved to the future-work todo; not a v8.1 release gate.

**Cross-refs:**

- `.planning/memory/2026-05-14-background-research.md` — visual research memo (frozen contract)
- `CLAUDE.md § "UI/визуал — research before implementation (2026-05-14)"` — sign-off required before code changes
