# ADR: Phase 54 — AI Summary Activation

**Status:** OPEN  
**Created:** 2026-05-12  
**Ref:** TODO(Phase-54-activation) markers in codebase

---

## Context

Phase 54 landed AI Summary infrastructure in seeds-only / mock mode. The
`MockAiAdapter` is wired; real providers (Anthropic, YandexGPT, Llama) are
behind a `TODO(Phase-54-activation)` gate. Metrics exist in code but the
real path never fires in production.

See `apps/api/src/modules/ai/` and `TODO(Phase-54-activation)` markers.

---

## Decision Required

**Which AI provider to activate first?**

| Option               | Pros                            | Cons                          |
| -------------------- | ------------------------------- | ----------------------------- |
| Anthropic Claude API | Best quality, REST, proven      | External, cost per token      |
| YandexGPT            | On-premise option for corporate | Needs VPN/proxy, Russian-only |
| Llama (self-hosted)  | Zero cost, no data egress       | GPU infra needed, setup work  |

No decision yet. Awaiting product direction from Head/Director.

---

## Activation Checklist (when decision is made)

- [ ] Choose provider (Anthropic / YandexGPT / Llama)
- [ ] Provision API key / infra
- [ ] Set `AI_PROVIDER=anthropic|yandex|llama` in `.env.production`
- [ ] Remove `MockAiAdapter` guard at `TODO(Phase-54-activation)` markers
- [ ] Smoke test: POST `/api/trpc/reports.generateAiSummary` → non-mock response
- [ ] Verify `customreport_ai_summary_generated_total{provider="anthropic"}` metric fires
- [ ] Load test: P99 < 5s for summary generation
- [ ] Monitor: Grafana `ai-summary` dashboard for error rate

---

## Open Questions

1. Monthly token budget? (Cost cap before graceful degradation)
2. PII policy — does the report data contain personal data that must not leave the corporate network?
3. Summarize per-lead section or full assembled report?

---

## Links

- Phase directory: `.planning/phases/54-ai-rag/`
- TODO markers: `grep -rn "TODO(Phase-54" apps/api/src/`
- Metric: `customreport_ai_summary_generated_total`
