// Phase 31 (AI-01) — AiService cache + sentinel + budget guard tests.
// Mocks @anthropic-ai/sdk; provides an in-memory AiFacade fake.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const messagesCreateMock = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    public messages = { create: messagesCreateMock };
    constructor(public readonly opts: { apiKey: string }) {}
  }
  return { default: MockAnthropic };
});

import { _resetAiClientForTests } from '../ai-client.js';
import { AiService } from '../ai.service.js';
import type {
  AiFacade,
  AiInsightRow,
  AiInsightUpsertInput,
  CellForOnTrack,
  ReportForSummary,
  RiskForSentiment,
} from '../ai-facade.js';
import type { AiInsightKind } from '@prisma/client';

class InMemoryFacade implements AiFacade {
  public reports = new Map<string, ReportForSummary>();
  public risks = new Map<string, RiskForSentiment>();
  public cells = new Map<string, CellForOnTrack>();
  public insights = new Map<string, AiInsightRow<unknown>>();
  public recentTokenSum = 0;

  private key(kind: AiInsightKind, hash: string) {
    return `${kind}:${hash}`;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getReportForSummary(reportId: string): Promise<ReportForSummary | null> {
    return this.reports.get(reportId) ?? null;
  }
  // eslint-disable-next-line @typescript-eslint/require-await
  async getRiskForSentiment(riskId: string): Promise<RiskForSentiment | null> {
    return this.risks.get(riskId) ?? null;
  }
  // eslint-disable-next-line @typescript-eslint/require-await
  async getCellForOnTrack(sectionId: string, projectId: string): Promise<CellForOnTrack | null> {
    return this.cells.get(`${sectionId}:${projectId}`) ?? null;
  }
  // eslint-disable-next-line @typescript-eslint/require-await
  async getAiInsight<R>(kind: AiInsightKind, hash: string): Promise<AiInsightRow<R> | null> {
    return (this.insights.get(this.key(kind, hash)) as AiInsightRow<R> | undefined) ?? null;
  }
  // eslint-disable-next-line @typescript-eslint/require-await
  async upsertAiInsight<R>(input: AiInsightUpsertInput<R>): Promise<AiInsightRow<R>> {
    const row: AiInsightRow<R> = {
      id: `${input.kind}-${input.contentHash}`,
      kind: input.kind,
      contentHash: input.contentHash,
      result: input.result,
      modelId: input.modelId,
      inputTokens: input.usage.inputTokens,
      outputTokens: input.usage.outputTokens,
      cacheCreationTokens: input.usage.cacheCreationTokens,
      cacheReadTokens: input.usage.cacheReadTokens,
      createdAt: new Date(),
    };
    this.insights.set(this.key(input.kind, input.contentHash), row as AiInsightRow<unknown>);
    return row;
  }
  // eslint-disable-next-line @typescript-eslint/require-await
  async deleteAiInsight(kind: AiInsightKind, hash: string): Promise<void> {
    this.insights.delete(this.key(kind, hash));
  }
  // eslint-disable-next-line @typescript-eslint/require-await
  async getRecentInsightTokenSum(): Promise<number> {
    return this.recentTokenSum;
  }
}

const REPORT_ID = '00000000-0000-4000-8000-000000000001';
const sampleReport: ReportForSummary = {
  reportId: REPORT_ID,
  periodLabel: '2026-W18',
  sectionCount: 2,
  greenCount: 5,
  yellowCount: 1,
  redCount: 0,
  sections: [
    {
      authorName: 'Alice',
      trafficLights: [{ projectName: 'Acme', status: 'green' }],
      riskCount: 1,
      decisionCount: 0,
      itemCount: 4,
    },
    {
      authorName: 'Bob',
      trafficLights: [{ projectName: 'Globex', status: 'yellow' }],
      riskCount: 0,
      decisionCount: 1,
      itemCount: 3,
    },
  ],
};

beforeEach(() => {
  _resetAiClientForTests();
  messagesCreateMock.mockReset();
  process.env['ANTHROPIC_API_KEY'] = 'test-key';
});

afterEach(() => {
  delete process.env['ANTHROPIC_API_KEY'];
});

describe('AiService.summary', () => {
  it('returns not_found when the report is missing', async () => {
    const facade = new InMemoryFacade();
    const service = new AiService(facade);
    const r = await service.summary(REPORT_ID);
    expect(r).toEqual({ available: false, reason: 'not_found' });
    expect(messagesCreateMock).not.toHaveBeenCalled();
  });

  it('cache miss → SDK called → AiInsight upserted', async () => {
    const facade = new InMemoryFacade();
    facade.reports.set(REPORT_ID, sampleReport);
    messagesCreateMock.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          input: {
            narrative: 'Five greens, one yellow. Risks tracked. Decisions pending.',
            tone: 'positive',
            highlights: ['5 of 6 green'],
          },
        },
      ],
      usage: { input_tokens: 4500, output_tokens: 120 },
    });
    const service = new AiService(facade);
    const r = await service.summary(REPORT_ID);

    expect(messagesCreateMock).toHaveBeenCalledTimes(1);
    expect(r.available).toBe(true);
    if (r.available) {
      expect(r.cached).toBe(false);
      expect(r.result.tone).toBe('positive');
    }
    expect(facade.insights.size).toBe(1);
  });

  it('cache hit on second call → SDK NOT called', async () => {
    const facade = new InMemoryFacade();
    facade.reports.set(REPORT_ID, sampleReport);
    messagesCreateMock.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          input: {
            narrative: 'Five greens, one yellow. Risks tracked. Decisions pending.',
            tone: 'positive',
            highlights: ['5 of 6 green'],
          },
        },
      ],
      usage: { input_tokens: 4500, output_tokens: 120 },
    });
    const service = new AiService(facade);
    await service.summary(REPORT_ID); // miss
    const r2 = await service.summary(REPORT_ID); // hit

    expect(messagesCreateMock).toHaveBeenCalledTimes(1);
    expect(r2.available).toBe(true);
    if (r2.available) expect(r2.cached).toBe(true);
  });

  it('regenerateSummary busts cache → SDK called again', async () => {
    const facade = new InMemoryFacade();
    facade.reports.set(REPORT_ID, sampleReport);
    messagesCreateMock.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          input: {
            narrative: 'Sample narrative one two three four five.',
            tone: 'neutral',
            highlights: [],
          },
        },
      ],
      usage: { input_tokens: 4500, output_tokens: 100 },
    });
    const service = new AiService(facade);
    await service.summary(REPORT_ID);
    await service.regenerateSummary(REPORT_ID);

    expect(messagesCreateMock).toHaveBeenCalledTimes(2);
  });

  it('SDK throws → returns unavailable sentinel (no exception bubble)', async () => {
    const facade = new InMemoryFacade();
    facade.reports.set(REPORT_ID, sampleReport);
    messagesCreateMock.mockRejectedValueOnce(new Error('network down'));
    const service = new AiService(facade);
    const r = await service.summary(REPORT_ID);
    expect(r).toEqual({ available: false, reason: 'unavailable' });
  });

  it('missing ANTHROPIC_API_KEY → unavailable sentinel', async () => {
    delete process.env['ANTHROPIC_API_KEY'];
    _resetAiClientForTests();
    const facade = new InMemoryFacade();
    facade.reports.set(REPORT_ID, sampleReport);
    const service = new AiService(facade);
    const r = await service.summary(REPORT_ID);
    expect(r).toEqual({ available: false, reason: 'unavailable' });
    expect(messagesCreateMock).not.toHaveBeenCalled();
  });

  it('budget exceeded → returns budget_exceeded sentinel without calling SDK', async () => {
    const facade = new InMemoryFacade();
    facade.reports.set(REPORT_ID, sampleReport);
    facade.recentTokenSum = 60_000; // exceeds 50K cap
    const service = new AiService(facade);
    const r = await service.summary(REPORT_ID);
    expect(r).toEqual({ available: false, reason: 'budget_exceeded' });
    expect(messagesCreateMock).not.toHaveBeenCalled();
  });

  it('rate-limit error → returns rate_limit sentinel', async () => {
    const facade = new InMemoryFacade();
    facade.reports.set(REPORT_ID, sampleReport);
    const err = new Error('429') as Error & { name: string };
    err.name = 'RateLimitError';
    messagesCreateMock.mockRejectedValueOnce(err);
    const service = new AiService(facade);
    const r = await service.summary(REPORT_ID);
    expect(r).toEqual({ available: false, reason: 'rate_limit' });
  });
});

describe('summary system prompt — char-count floor', async () => {
  it('SUMMARY_SYSTEM_PROMPT is at least 3500 chars (≥1024-token cache breakpoint)', async () => {
    const { SUMMARY_SYSTEM_PROMPT } = await import('../prompts/summary.js');
    expect(SUMMARY_SYSTEM_PROMPT.length).toBeGreaterThanOrEqual(3500);
  });
});

describe('sentiment system prompt — char-count floor', async () => {
  it('SENTIMENT_SYSTEM_PROMPT is at least 3500 chars', async () => {
    const { SENTIMENT_SYSTEM_PROMPT } = await import('../prompts/sentiment.js');
    expect(SENTIMENT_SYSTEM_PROMPT.length).toBeGreaterThanOrEqual(3500);
  });
});

describe('AiService.sentiment', () => {
  const RISK_ID_A = '22222222-2222-4222-8222-222222222222';
  const RISK_ID_B = '33333333-3333-4333-8333-333333333333';
  const SAMPLE_RISK = {
    riskId: RISK_ID_A,
    risk: 'Single engineer holds critical knowledge',
    impact: 'Key absence stalls progress',
    mitigation: 'Pair-programming weekly',
  } as const;

  it('returns not_found when risk is missing', async () => {
    const facade = new InMemoryFacade();
    const service = new AiService(facade);
    const r = await service.sentiment(RISK_ID_A);
    expect(r).toEqual({ available: false, reason: 'not_found' });
    expect(messagesCreateMock).not.toHaveBeenCalled();
  });

  it('cache miss → SDK called → row upserted with kind=sentiment', async () => {
    const facade = new InMemoryFacade();
    facade.risks.set(RISK_ID_A, { ...SAMPLE_RISK });
    messagesCreateMock.mockResolvedValueOnce({
      content: [
        { type: 'tool_use', input: { level: 'medium', rationale: 'Bus factor with mitigation in progress' } },
      ],
      usage: { input_tokens: 1500, output_tokens: 30 },
    });
    const service = new AiService(facade);
    const r = await service.sentiment(RISK_ID_A);
    expect(r.available).toBe(true);
    if (r.available) expect(r.result.level).toBe('medium');
    expect(facade.insights.size).toBe(1);
    expect([...facade.insights.values()][0]?.kind).toBe('sentiment');
  });

  it('cache hit on second call with identical text → SDK NOT called', async () => {
    const facade = new InMemoryFacade();
    facade.risks.set(RISK_ID_A, { ...SAMPLE_RISK });
    messagesCreateMock.mockResolvedValueOnce({
      content: [{ type: 'tool_use', input: { level: 'medium', rationale: 'cached' } }],
      usage: { input_tokens: 1500, output_tokens: 30 },
    });
    const service = new AiService(facade);
    await service.sentiment(RISK_ID_A);
    await service.sentiment(RISK_ID_A);
    expect(messagesCreateMock).toHaveBeenCalledTimes(1);
  });

  it('two different riskIds with identical text share one cached row', async () => {
    const facade = new InMemoryFacade();
    facade.risks.set(RISK_ID_A, { ...SAMPLE_RISK, riskId: RISK_ID_A });
    facade.risks.set(RISK_ID_B, { ...SAMPLE_RISK, riskId: RISK_ID_B });
    messagesCreateMock.mockResolvedValueOnce({
      content: [{ type: 'tool_use', input: { level: 'low', rationale: 'shared' } }],
      usage: { input_tokens: 1500, output_tokens: 30 },
    });
    const service = new AiService(facade);
    await service.sentiment(RISK_ID_A);
    await service.sentiment(RISK_ID_B);
    expect(messagesCreateMock).toHaveBeenCalledTimes(1);
    expect(facade.insights.size).toBe(1);
  });

  it('SDK throws → returns unavailable sentinel', async () => {
    const facade = new InMemoryFacade();
    facade.risks.set(RISK_ID_A, { ...SAMPLE_RISK });
    messagesCreateMock.mockRejectedValueOnce(new Error('boom'));
    const service = new AiService(facade);
    const r = await service.sentiment(RISK_ID_A);
    expect(r).toEqual({ available: false, reason: 'unavailable' });
  });
});
