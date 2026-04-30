// Phase 31 (AI-SPEC §3): AiService — sync tRPC-callable surface for
// AI-01 (summary), AI-02 (sentiment, added in 31-03), AI-03 (on-track,
// added in 31-04). Returns a discriminated-union sentinel so failure
// modes (no key, outage, rate limit, budget exceeded) never bubble raw
// exceptions into the tRPC error mapper.
import { Injectable } from '@nestjs/common';

import { computeContentHash, withCache } from './ai-cache.js';
import {
  AiRateLimitError,
  AiUnavailableError,
  runStructured,
  type AnthropicClientFactory,
  type RunStructuredResult,
} from './ai-client.js';
import type { AiFacade } from './ai-facade.js';
import {
  SUMMARY_MODEL,
  SUMMARY_SYSTEM_PROMPT,
  SUMMARY_TOOL_DESCRIPTION,
  SUMMARY_TOOL_NAME,
  buildSummaryUserPrompt,
  condenseReportForPrompt,
  summarySchema,
  type SummaryResult,
} from './prompts/summary.js';

export type AiInsightAvailable<R> = {
  available: true;
  result: R;
  cached: boolean;
};

export type AiInsightUnavailable = {
  available: false;
  reason: 'unavailable' | 'rate_limit' | 'budget_exceeded' | 'not_found';
};

export type AiInsightResult<R> = AiInsightAvailable<R> | AiInsightUnavailable;

const PER_REPORT_BUDGET_TOKENS = 50_000;

@Injectable()
export class AiService {
  constructor(
    private readonly facade: AiFacade,
    /**
     * Optional client factory injection — production passes undefined and
     * the SDK wrapper uses its lazy default; unit tests pass a factory
     * returning a vi.mocked Anthropic instance.
     */
    private readonly clientFactory?: AnthropicClientFactory,
  ) {}

  async summary(reportId: string): Promise<AiInsightResult<SummaryResult>> {
    return this.runSummary(reportId, false);
  }

  async regenerateSummary(reportId: string): Promise<AiInsightResult<SummaryResult>> {
    return this.runSummary(reportId, true);
  }

  private async runSummary(
    reportId: string,
    bustCache: boolean,
  ): Promise<AiInsightResult<SummaryResult>> {
    const report = await this.facade.getReportForSummary(reportId);
    if (!report) {
      return { available: false, reason: 'not_found' };
    }

    const condensedContent = condenseReportForPrompt(report);
    const cacheInput = {
      reportId: report.reportId,
      sectionCount: report.sectionCount,
      counts: { green: report.greenCount, yellow: report.yellowCount, red: report.redCount },
      sections: report.sections,
    };
    const contentHash = computeContentHash(cacheInput);

    if (bustCache) {
      await this.facade.deleteAiInsight('summary', contentHash);
    }

    // Budget guard (AI-SPEC §7): bail before SDK call if cumulative tokens
    // for THIS report's recent insights exceed the per-report cap.
    const cumulative = await this.facade.getRecentInsightTokenSum([contentHash]);
    if (cumulative > PER_REPORT_BUDGET_TOKENS) {
      return { available: false, reason: 'budget_exceeded' };
    }

    try {
      const { row, cached } = await withCache<SummaryResult>({
        facade: this.facade,
        kind: 'summary',
        contentHash,
        generate: async () => {
          const userPrompt = buildSummaryUserPrompt(report, condensedContent);
          const r: RunStructuredResult<SummaryResult> = await runStructured(
            {
              model: SUMMARY_MODEL,
              system: SUMMARY_SYSTEM_PROMPT,
              user: userPrompt,
              toolName: SUMMARY_TOOL_NAME,
              toolDescription: SUMMARY_TOOL_DESCRIPTION,
              schema: summarySchema,
            },
            this.clientFactory,
          );
          return { result: r.result, usage: r.usage, modelId: SUMMARY_MODEL };
        },
      });

      return { available: true, result: row.result, cached };
    } catch (err) {
      if (err instanceof AiRateLimitError) {
        return { available: false, reason: 'rate_limit' };
      }
      if (err instanceof AiUnavailableError) {
        return { available: false, reason: 'unavailable' };
      }
      // Unknown error — also unavailable (no raw bubble).
      return { available: false, reason: 'unavailable' };
    }
  }
}
