---
phase: 40
status: planned
parent_milestone: v8.1
title: "B2B Rebrand & Dark Mode"
---

# Phase 40: B2B Rebrand & Dark Mode

**Goal:** Light B2B palette + dark theme baseline + theme toggle live, every component reads in both themes, screenshot evidence at 1280×800 + 375×667 + 768×1024.

**Depends on:** none

**Requirements:** BRAND-01..06

**Plans:** 5 (provisional)

- 40-01: PRD — rebrand goals, palette, typography, motion. Output: `docs/REBRAND-PRD.md` + design tokens spec.
- 40-02: Design tokens — `[data-theme="dark"]` block in `packages/ui/src/styles/globals.css` + light B2B refresh.
- 40-03: Theme toggle UI — nav-bar sun/moon button, `localStorage.theme` + `prefers-color-scheme` fallback.
- 40-04: Component audit pass — every page, every dialog, every chart in both themes.
- 40-05: Screenshot evidence — 5 routes × 2 themes × 3 viewports = 30 screenshots.

**Status:** planned — awaiting Phase 40 planning (research memo from W2-C informs this phase).

**Cross-refs:**

- `.planning/memory/2026-05-14-background-research.md` — visual research memo (frozen contract)
- `CLAUDE.md § "UI/визуал — research before implementation (2026-05-14)"` — sign-off required before code changes
