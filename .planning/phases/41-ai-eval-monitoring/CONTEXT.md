---
phase: 41
status: parked
parent_milestone: v8.1
title: "AI Eval & Monitoring"
---

# Phase 41: AI Eval & Monitoring

**Goal:** Park AI eval, telemetry, prompt regression, cost alerts, and integration metrics out of v8.1.

**Depends on:** none (parallel with 40)

**Requirements:** AI-EVAL-PARKED

**Plans:** 1 (parked scope decision)

- 41-01: Golden-set seed — 20-30 weekly reports + expected summaries. Stored in `apps/api/test-fixtures/ai-golden/*.json`.
- 41-02: Rubric runner — vitest spec + LLM-as-judge (Haiku rates Haiku output) on four dimensions.
- 41-03: Prompt regression spec — snapshot 5 known-good prompts + their outputs.
- 41-04: `/metrics` counters — `cr_ai_tokens_total`, `cr_ai_latency_ms`, `cr_ai_errors_total`. Grafana panel JSON.
- 41-05: Daily cost alert — BullMQ cron job sums tokens × Haiku price, alerts via log channel.

**Status:** parked — moved to the future-work todo; not a v8.1 release gate.

**Cross-refs:**

- `TODO(Phase-54-activation)` markers in AI module — activation condition
- `.planning/milestones/v8.1-ROADMAP.md § Phase 41` — full spec
