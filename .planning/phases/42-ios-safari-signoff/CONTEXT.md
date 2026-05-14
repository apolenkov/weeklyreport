---
phase: 42
status: parked
parent_milestone: v8.1
title: "iOS Safari Sign-off"
---

# Phase 42: iOS Safari Sign-off

**Goal:** Park real-device iOS Safari sign-off out of v8.1; keep current UAT repeatability on Dockerized local stack plus Playwright/log evidence.

**Depends on:** none

**Requirements:** MOB-PARKED

**Plans:** 1 (parked scope decision)

- 42-01: RUNBOOK addendum + checklist — 25-item checklist covering PDF download, tap-target audit, dialog scroll lock, sticky-header collisions, viewport zoom, share sheet, copy-link, period nav.
- 42-02: Manual sign-off + screenshot evidence — real iPhone SE, iPhone 14, iPad portrait, iPad landscape. Screenshots committed to `docs/ios-signoff-evidence/`.

**Status:** parked — moved to future UI/UAT backlog; not a v8.1 release gate.

**Cross-refs:**

- `.planning/milestones/v8.1-ROADMAP.md § Phase 42` — full spec
- `apps/web/e2e/` — existing Playwright mobile specs (virtual device coverage)
