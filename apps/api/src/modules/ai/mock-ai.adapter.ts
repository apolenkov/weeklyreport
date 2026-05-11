// Phase 54 (UFB-055): MockAiAdapter — deterministic stub used until
// the org picks a real LLM provider. Returns a short bracketed string
// that encodes (a) the marker tag the UI can detect, (b) the section
// count, and (c) the period id so tests and humans can trace which
// period a cached value came from.
//
// Determinism is the point: the value depends only on the input, so
// the Redis cache layer and any future snapshot tests behave
// predictably. No network calls, no clocks, no rng.

import { Injectable } from '@nestjs/common';

import {
  aiSummaryDurationSeconds,
  aiSummaryGeneratedTotal,
} from '../../infrastructure/metrics/metrics.registry.js';
import type { AiAdapter, AiAdapterContext } from './ai.adapter.js';

@Injectable()
export class MockAiAdapter implements AiAdapter {
  /**
   * Returns a sentinel string of the form
   *
   *   `[mock-summary] N sections, period <id>`
   *
   * The `[mock-summary]` prefix lets the UI badge the result as a
   * stub without parsing the rest. The prompt is ignored on purpose —
   * a real adapter would honour it, but the stub is content-free by
   * design so test fixtures cannot accidentally rely on its body.
   */
  async generate(_prompt: string, context: AiAdapterContext): Promise<string> {
    const t0 = Date.now();
    const count = context.sections.length;
    const result = `[mock-summary] ${count} sections, period ${context.periodId}`;
    aiSummaryGeneratedTotal.inc({ provider: 'mock', status: 'ok' });
    aiSummaryDurationSeconds.observe({ provider: 'mock' }, (Date.now() - t0) / 1000);
    return result;
  }
}
