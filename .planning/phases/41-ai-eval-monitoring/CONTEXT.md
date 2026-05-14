---
phase: 41
status: planned
parent_milestone: v8.1
title: "AI Eval & Monitoring"
---

# Phase 41: AI Eval & Monitoring

**Goal:** Golden-set + rubric runner active in CI, prompt regression spec live, AI metrics in `/metrics` + Grafana panel, daily cost alert wired.

**Depends on:** none (parallel with 40)

**Requirements:** AI-EVAL-01..05

**Plans:** 5 (provisional)

- 41-01: Golden-set seed — 20-30 weekly reports + expected summaries. Stored in `apps/api/test-fixtures/ai-golden/*.json`.
- 41-02: Rubric runner — vitest spec + LLM-as-judge (Haiku rates Haiku output) on four dimensions.
- 41-03: Prompt regression spec — snapshot 5 known-good prompts + their outputs.
- 41-04: `/metrics` counters — `cr_ai_tokens_total`, `cr_ai_latency_ms`, `cr_ai_errors_total`. Grafana panel JSON.
- 41-05: Daily cost alert — BullMQ cron job sums tokens × Haiku price, alerts via log channel.

**Status:** planned — parked until AI features are activated with a real API key.

**Cross-refs:**

- `TODO(Phase-54-activation)` markers in AI module — activation condition
- `.planning/milestones/v8.1-ROADMAP.md § Phase 41` — full spec
