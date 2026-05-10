// Phase 54 (UFB-055): AiSummaryService unit tests. Exercises the
// cache → repo → adapter happy path, the not-found branch, and the
// empty-period short-circuit (no adapter call).
import { describe, expect, it } from 'vitest';

import type { AiAdapter, AiAdapterContext } from '../ai.adapter.js';
import {
  AiSummaryService,
  type AiSummaryRepository,
} from '../ai-summary.service.js';
import { NullAiSummaryCache } from '../ai-summary.cache.js';

function makeAdapter(text: string): AiAdapter & {
  calls: AiAdapterContext[];
} {
  const calls: AiAdapterContext[] = [];
  return {
    calls,
    async generate(_prompt, context) {
      calls.push(context);
      return text;
    },
  };
}

function makeRepo(
  sections:
    | null
    | Array<{ sectionId: string; authorName: string; text: string }>,
): AiSummaryRepository {
  return {
    async getSectionsForPeriod() {
      return sections;
    },
  };
}

describe('AiSummaryService (Phase 54 / UFB-055)', () => {
  it('returns mock-source result when adapter emits the sentinel', async () => {
    const adapter = makeAdapter('[mock-summary] 1 sections, period p');
    const service = new AiSummaryService(adapter, new NullAiSummaryCache());
    service.setRepository(
      makeRepo([{ sectionId: 's-1', authorName: 'A', text: 'hello' }]),
    );

    const result = await service.getSummary('p');
    expect(result).toEqual({
      summary: '[mock-summary] 1 sections, period p',
      source: 'mock',
      citationIds: ['s-1'],
    });
    expect(adapter.calls).toHaveLength(1);
  });

  it('tags non-sentinel adapter output as ai-source', async () => {
    const adapter = makeAdapter('Real LLM prose without sentinel');
    const service = new AiSummaryService(adapter, new NullAiSummaryCache());
    service.setRepository(
      makeRepo([{ sectionId: 's-1', authorName: 'A', text: 'x' }]),
    );

    const result = await service.getSummary('p');
    expect(result.source).toBe('ai');
  });

  it('throws when the period does not exist', async () => {
    const adapter = makeAdapter('unused');
    const service = new AiSummaryService(adapter, new NullAiSummaryCache());
    service.setRepository(makeRepo(null));

    await expect(service.getSummary('missing')).rejects.toThrow(
      /Period missing not found/,
    );
  });

  it('returns empty mock result without calling adapter when no sections', async () => {
    const adapter = makeAdapter('should-not-be-called');
    const service = new AiSummaryService(adapter, new NullAiSummaryCache());
    service.setRepository(makeRepo([]));

    const result = await service.getSummary('p-empty');
    expect(result).toEqual({
      summary: '',
      source: 'mock',
      citationIds: [],
    });
    expect(adapter.calls).toHaveLength(0);
  });

  it('caches the result — second call does not hit adapter', async () => {
    const adapter = makeAdapter('[mock-summary] 1 sections, period p');
    const memo = new Map<string, unknown>();
    const cache = {
      async getOrCompute<T>(key: string, fn: () => Promise<T>): Promise<T> {
        if (memo.has(key)) return memo.get(key) as T;
        const v = await fn();
        memo.set(key, v);
        return v;
      },
    };
    const service = new AiSummaryService(adapter, cache);
    service.setRepository(
      makeRepo([{ sectionId: 's-1', authorName: 'A', text: 'hi' }]),
    );

    await service.getSummary('p');
    await service.getSummary('p');
    expect(adapter.calls).toHaveLength(1);
  });

  it('throws when repository is not wired', async () => {
    const adapter = makeAdapter('x');
    const service = new AiSummaryService(adapter, new NullAiSummaryCache());
    // intentionally skip setRepository
    await expect(service.getSummary('p')).rejects.toThrow(
      /repository not wired/,
    );
  });
});

