// Phase 54 (UFB-055): AiAdapter — pluggable provider seam for the
// future RAG / period-summary pipeline. Seeds-only scaffolding: only the
// MockAiAdapter is implemented in this phase. The real provider
// (Claude / GPT / YandexGPT / on-prem Llama) is deferred to a follow-on
// phase that explicitly picks one + budgets it.
//
// This sits ALONGSIDE the existing AiService (Phase 31/32, Anthropic
// SDK + AiInsight cache + per-report budget guard). The two are
// intentionally separate:
//   - AiService.summary({ reportId })        — per-report card on
//     assembled report, real Anthropic Haiku call, cached in
//     AiInsight table.
//   - AiAdapter (new)                        — period-level RAG
//     summary surface (`ai.periodSummary`), Mock-only for now,
//     Redis-cached for 60s. Will swap to a real provider once the
//     org picks one.
//
// Selection happens at module-construction time via `AI_PROVIDER`:
//   - unset or "mock"  → MockAiAdapter
//   - anything else    → throw at boot so misconfigured envs fail loud.

/**
 * Context passed to {@link AiAdapter.generate}. Kept intentionally
 * minimal — the period-summary path only needs the period id, the
 * section payload bullets, and a free-form prompt. Richer context
 * (embeddings, citations, retrieval scores) will be added when the
 * real RAG pipeline lands.
 */
export interface AiAdapterContext {
  /** Period (report) id whose sections are being summarised. */
  readonly periodId: string;
  /**
   * Section bodies condensed to text. Order is stable (caller sorts
   * by author name) so a deterministic mock can quote section count.
   */
  readonly sections: ReadonlyArray<{
    readonly sectionId: string;
    readonly authorName: string;
    readonly text: string;
  }>;
}

/**
 * AiAdapter — the seam every future LLM provider must satisfy. The
 * return type is a plain string (not a structured object) because the
 * stub surface only renders prose; richer responses (citations, tone
 * scores) will gain new methods rather than rewriting `generate`.
 */
export interface AiAdapter {
  /**
   * Generate a free-form summary string for the given context.
   *
   * @param prompt  the user-visible instruction (system prompt is the
   *                adapter's responsibility — different providers
   *                handle system prompts differently)
   * @param context the structured context for retrieval/grounding
   * @returns generated text
   */
  generate(prompt: string, context: AiAdapterContext): Promise<string>;
}

/**
 * Injection token for the AiAdapter port. Nest's DI does not support
 * interface tokens, so we expose a string literal here and bind it in
 * AiModule. Consumers (AiSummaryService) `@Inject(AI_ADAPTER)` to
 * receive the concrete implementation chosen by env.
 */
export const AI_ADAPTER = "AI_ADAPTER" as const;
