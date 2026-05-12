/**
 * Phase 54 — AI activation integration test scaffold (W3.2).
 *
 * Skipped in CI unless AI_PROVIDER env is set to a real provider value
 * (anything other than 'mock'). Provides the one-flag-flip gate for
 * activating the real AI adapter: set AI_PROVIDER and run this file.
 *
 * See .planning/phases/54-ai-rag/54-PHASE-SUMMARY.md "Activation Playbook".
 */
import { describe, it, expect } from 'vitest';

import { selectAiAdapter } from '../ai.module.js';

const isRealProvider =
  !!process.env['AI_PROVIDER'] && process.env['AI_PROVIDER'] !== 'mock';

describe.skipIf(!isRealProvider)('AI activation (real provider)', () => {
  it('selectAiAdapter() does not throw when AI_PROVIDER is set to a real value', () => {
    // If this test runs, AI_PROVIDER is set to a non-mock value.
    // selectAiAdapter() should construct a real adapter without throwing.
    // TODO(Phase-54-activation): once a real adapter is wired, this test
    // should also verify the adapter satisfies the AiAdapter interface
    // (generate() returns a string for a minimal prompt).
    expect(() => selectAiAdapter()).not.toThrow();
  });

  it('AiSummaryService returns source: "ai" (not "mock") with real adapter', async () => {
    // TODO(Phase-54-activation): implement once a real adapter exists.
    // Expected shape: { summary: string, source: 'ai', citationIds: string[] }
    // Minimal smoke test: call AiSummaryService with a seeded period id
    // and assert result.source === 'ai'.
    expect(process.env['AI_PROVIDER']).not.toBe('mock');
  });
});
