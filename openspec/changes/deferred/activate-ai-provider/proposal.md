# Activate AI provider

## Problem

The AI summarization feature (Phase 54) is stubbed out with a "Not implemented"
error:

1. `apps/api/src/modules/ai/ai.module.ts:29` — throws `Error('Not implemented')`.
2. `apps/api/src/modules/ai/ai-summary.service.ts:78` — same stub.

When a lead clicks "Generate summary" or a head tries to auto-summarize a risk,
the request fails silently or displays a generic error. The feature is wired
into the UI but the backend provider is missing.

## Solution

Wire a real AI provider (Anthropic Claude, Yandex, or Llama):

- Choose a provider based on product requirements and cost (Anthropic: $0.003/1K
  input tokens; Yandex: free tier).
- Create `apps/api/src/lib/ai-client.ts` with provider-agnostic interface
  (`summarizeText()`, `generateTitle()`).
- Implement provider-specific adapters
  (`anthropic-adapter.ts`, `yandex-adapter.ts`, etc.).
- Wire the adapter into `ai-summary.service.ts`.
- Add tests and error handling (rate limits, timeouts, fallback responses).

## Non-goals

- Implement full AI-powered features (scheduled generation, multi-language, fine-tuning).
- Add user-facing AI settings (provider selection, tone, length controls).

## Source

- TODO(Phase-54-activation) at `ai.module.ts:29` and `ai-summary.service.ts:78`.
- Phase 54 specification (seed-only, not production-ready).

## Activation trigger

When product selects an AI provider and allocates budget for inference costs.
Estimated v8.6 or v9.0 (roadmap depends on product direction and cost
approval).
