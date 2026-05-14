# Phase 40 Plan - Park Theme Scope

## Goal

Close Phase 40 for current v8.1 scope by moving full dark mode, theme
switching, and background redesign to GSD backlog while keeping a visible
Coming Soon signal in the navigation.

## Tasks

- [x] Reclassify dark mode/theme switching as future UI improvement work.
- [x] Capture future work in `.planning/todos/pending/2026-05-14-future-ui-telemetry-coming-soon.md`.
- [x] Add a top-menu `Theme` Coming Soon control without real theme logic.
- [x] Leave CSS token migration and screenshot evidence out of current v8.1.

## Verification

- `apps/web/src/components/navigation/nav-bar.test.tsx` covers the parked
  Theme control.
