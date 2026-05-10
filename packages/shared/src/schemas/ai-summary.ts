import { z } from 'zod';

/**
 * Phase 54 (UFB-055) — payload shape for the `ai.periodSummary` tRPC
 * procedure.
 *
 * Seeds-only scaffolding: in this phase the backend always returns
 * `source: 'mock'` because no real LLM provider is wired yet. The
 * shape is forward-compatible — when the org picks a provider, the
 * same surface flips to `source: 'ai'` without a contract bump.
 *
 * Field semantics:
 *
 *   summary      — free-form prose. May be empty when the period has
 *                  no published sections; the UI renders an empty
 *                  state instead of a hallucinated paragraph.
 *   source       — `'mock'` while AI_PROVIDER is unset/`'mock'`,
 *                  `'ai'` once a real provider is wired. UI uses
 *                  this to render a «(заглушка)» badge.
 *   citationIds  — section ids that the (eventual) RAG pipeline
 *                  cited. Currently the full section-id list; in the
 *                  real implementation this will narrow to the
 *                  grounded subset.
 */
export const aiSummarySchema = z.object({
  summary: z.string(),
  source: z.enum(['mock', 'ai']),
  citationIds: z.array(z.string().uuid()),
});

export type AiSummary = z.infer<typeof aiSummarySchema>;
