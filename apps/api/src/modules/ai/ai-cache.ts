// Phase 31 (AI-SPEC §3): contentHash + read-through cache. Per CONTEXT.md
// the hash is sha256(JSON.stringify(content)). The Prisma upsert key is
// (kind, contentHash) per AiInsight @@unique.
import { createHash } from 'node:crypto';
import type { AiInsightKind } from '@prisma/client';

import type { AiFacade, AiInsightRow } from './ai-facade.js';
import type { AnthropicUsage } from './ai-client.js';

/**
 * Stable JSON.stringify with sorted keys so equivalent inputs hit the same
 * cache slot regardless of property order.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const parts = keys.map((k) => {
    const v = (value as Record<string, unknown>)[k];
    return `${JSON.stringify(k)}:${stableStringify(v)}`;
  });
  return `{${parts.join(',')}}`;
}

export function computeContentHash(content: unknown): string {
  return createHash('sha256').update(stableStringify(content)).digest('hex');
}

export type CacheGenerate<R> = () => Promise<{
  result: R;
  usage: AnthropicUsage;
  modelId: string;
}>;

export async function withCache<R>(args: {
  facade: AiFacade;
  kind: AiInsightKind;
  contentHash: string;
  generate: CacheGenerate<R>;
}): Promise<{ row: AiInsightRow<R>; cached: boolean }> {
  const existing = await args.facade.getAiInsight<R>(args.kind, args.contentHash);
  if (existing) {
    return { row: existing, cached: true };
  }
  const generated = await args.generate();
  const row = await args.facade.upsertAiInsight<R>({
    kind: args.kind,
    contentHash: args.contentHash,
    result: generated.result,
    modelId: generated.modelId,
    usage: generated.usage,
  });
  return { row, cached: false };
}
