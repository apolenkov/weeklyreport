---
phase: 42
status: planned
parent_milestone: v8.1
title: "iOS Safari Sign-off"
---

# Phase 42: iOS Safari Sign-off

**Goal:** RUNBOOK addendum complete, manual sign-off round done on real iPhone + iPad, screenshot evidence committed.

**Depends on:** Phase 40 (test in final B2B theme, not v8.0 green palette)

**Requirements:** MOB-01..03

**Plans:** 2 (provisional)

- 42-01: RUNBOOK addendum + checklist — 25-item checklist covering PDF download, tap-target audit, dialog scroll lock, sticky-header collisions, viewport zoom, share sheet, copy-link, period nav.
- 42-02: Manual sign-off + screenshot evidence — real iPhone SE, iPhone 14, iPad portrait, iPad landscape. Screenshots committed to `docs/ios-signoff-evidence/`.

**Status:** planned — blocked on Phase 40 completion and real device availability.

**Cross-refs:**

- `.planning/milestones/v8.1-ROADMAP.md § Phase 42` — full spec
- `apps/web/e2e/` — existing Playwright mobile specs (virtual device coverage)
