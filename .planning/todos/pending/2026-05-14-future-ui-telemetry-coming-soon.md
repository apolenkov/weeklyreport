---
created: 2026-05-14T18:20:00+03:00
title: Future UI Telemetry Coming Soon Scope
area: planning
files:
  - .planning/milestones/v8.1-REQUIREMENTS.md
  - .planning/milestones/v8.1-ROADMAP.md
  - apps/web/src/components/navigation/nav-bar.tsx
---

## Problem

Dark mode, live theme switching, Telegram activation, AI telemetry/eval,
real-device Safari sign-off, Dockerized observability/performance UAT, and
UI screenshot/background review are valuable, but they are not part of the
current v8.1 UAT/recovery closure. Keeping them as active v8.1 gates makes
GSD state look broken and distracts from repeating the current UAT cleanly.

## Solution

Keep the current milestone focused on UAT/recovery and PR #5 CI. Treat these
tracks as future work / Coming Soon until explicitly promoted:

- UFB-074: Dark mode and live theme switching.
- UI screenshot audit and background improvement proposals.
- Telegram real-provider integration.
- AI telemetry/eval, prompt regression, cost alerts, and metrics.
- Dockerized local UAT observability/performance pass with logs, metrics,
  index review, Redis/cache review, and follow-up recommendations.

Current code may show inert Coming Soon UI only; do not implement the real
systems until this todo is promoted into a new milestone.
