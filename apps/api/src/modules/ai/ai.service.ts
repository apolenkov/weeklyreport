// Phase 31 (AI-SPEC §3): AiService — sync tRPC-callable surface for
// AI-01 (summary), AI-02 (sentiment, added in 31-03), AI-03 (on-track,
// added in 31-04). Returns a discriminated-union sentinel so failure
// modes (no key, outage, rate limit, budget exceeded) never bubble raw
// exceptions into the tRPC error mapper.
import { Injectable } from "@nestjs/common";

import { computeContentHash, withCache } from "./ai-cache.js";
import {
  AiRateLimitError,
  AiUnavailableError,
  runStructured,
  type AnthropicClientFactory,
  type RunStructuredResult,
} from "./ai-client.js";
import type { AiFacade } from "./ai-facade.js";
import {
  SUMMARY_MODEL,
  SUMMARY_SYSTEM_PROMPT,
  SUMMARY_TOOL_DESCRIPTION,
  SUMMARY_TOOL_NAME,
  buildSummaryUserPrompt,
  condenseReportForPrompt,
  summarySchema,
  type SummaryResult,
} from "./prompts/summary.js";
import {
  SENTIMENT_MODEL,
  SENTIMENT_SYSTEM_PROMPT,
  SENTIMENT_TOOL_DESCRIPTION,
  SENTIMENT_TOOL_NAME,
  buildSentimentUserPrompt,
  sentimentSchema,
  type SentimentResult,
} from "./prompts/sentiment.js";
import {
  ON_TRACK_MODEL,
  ON_TRACK_SYSTEM_PROMPT,
  ON_TRACK_TOOL_DESCRIPTION,
  ON_TRACK_TOOL_NAME,
  buildOnTrackUserPrompt,
  onTrackSchema,
  type OnTrackResult,
} from "./prompts/on-track.js";

export type AiInsightAvailable<R> = {
  available: true;
  result: R;
  cached: boolean;
};

export type AiInsightUnavailable = {
  available: false;
  reason: "unavailable" | "rate_limit" | "budget_exceeded" | "not_found";
};

export type AiInsightResult<R> = AiInsightAvailable<R> | AiInsightUnavailable;

// Phase 32-A1 (C-01): per-report budget cap. ~$0.05 at Haiku 4.5 pricing
// (input $0.80/MT + output $4/MT, mixed; 50K tokens covers typical use).
// Enforced before EVERY Anthropic call across summary/sentiment/on-track.
export const PER_REPORT_BUDGET_TOKENS = 50_000;

// Phase 39-06 (visual regression): when AI_VISUAL_STUB=true, every AI call
// returns a frozen response so screenshot baselines stay byte-stable across
// runs. Anthropic Haiku output varies on every invocation; stubbing here is
// the cheapest spot — short-circuits before SDK construction *and* before
// any cache read so the stubbed answer never poisons the AiInsight table
// in production environments. Off by default; only the visual project sets
// it via the Playwright webServer env block.
const AI_VISUAL_STUB = (): boolean => process.env["AI_VISUAL_STUB"] === "true";

const STUB_SUMMARY: SummaryResult = {
  narrative:
    "Портфель в целом в зелёной зоне с управляемыми рисками. Команда закрыла плановый объём задач, два проекта требуют внимания на следующей неделе.",
  tone: "neutral",
  highlights: [
    "5 из 6 проектов на треке",
    "Активная митигация двух рисков",
    "Решение по бюджету ожидает руководителя",
  ],
};

const STUB_SENTIMENT: SentimentResult = {
  level: "medium",
  rationale: "Stubbed sentiment for visual regression baseline.",
};

const STUB_ON_TRACK: OnTrackResult = {
  verdict: "on-track",
  confidence: "medium",
  rationale: "Stubbed on-track verdict for visual regression baseline.",
};

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

  /**
   * Phase 32-A1 (C-01): per-report budget guard helper. Sums recent token
   * usage across all 3 kinds for a single report and returns true when the
   * cumulative inputs+outputs exceed the cap. Called by all 3 features
   * (summary, sentiment, on-track) before any Anthropic SDK call.
   */
  private async isOverBudget(reportId: string): Promise<boolean> {
    if (!reportId) return true; // unscoped calls are denied per C-01 fix
    const cumulative = await this.facade.getRecentInsightTokenSum(reportId);
    return cumulative > PER_REPORT_BUDGET_TOKENS;
  }

  async summary(reportId: string): Promise<AiInsightResult<SummaryResult>> {
    return this.runSummary(reportId, false);
  }

  async regenerateSummary(
    reportId: string,
  ): Promise<AiInsightResult<SummaryResult>> {
    return this.runSummary(reportId, true);
  }

  private async runSummary(
    reportId: string,
    bustCache: boolean,
  ): Promise<AiInsightResult<SummaryResult>> {
    // Phase 39-06: visual regression stub. Bypass facade + Anthropic so
    // baselines render the same string on every run. The bustCache flag is
    // moot here — the stub is its own source of truth.
    if (AI_VISUAL_STUB()) {
      return { available: true, result: STUB_SUMMARY, cached: false };
    }
    const report = await this.facade.getReportForSummary(reportId);
    if (!report) {
      return { available: false, reason: "not_found" };
    }

    const condensedContent = condenseReportForPrompt(report);
    const cacheInput = {
      reportId: report.reportId,
      sectionCount: report.sectionCount,
      counts: {
        green: report.greenCount,
        yellow: report.yellowCount,
        red: report.redCount,
      },
      sections: report.sections,
    };
    const contentHash = computeContentHash(cacheInput);

    if (bustCache) {
      await this.facade.deleteAiInsight("summary", contentHash);
    }

    // Phase 32-A1 (C-01): budget guard scoped per-report. Sums input+output
    // tokens across ALL kinds (summary/sentiment/on_track) for this report
    // in the last hour. Bail before SDK call if cap exceeded.
    if (await this.isOverBudget(report.reportId)) {
      return { available: false, reason: "budget_exceeded" };
    }

    try {
      const { row, cached } = await withCache<SummaryResult>({
        facade: this.facade,
        kind: "summary",
        contentHash,
        reportId: report.reportId,
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
        return { available: false, reason: "rate_limit" };
      }
      if (err instanceof AiUnavailableError) {
        return { available: false, reason: "unavailable" };
      }
      // Unknown error — also unavailable (no raw bubble).
      return { available: false, reason: "unavailable" };
    }
  }

  // AI-02: per-Risk sentiment classification. Cache key is the risk text
  // tuple, NOT the riskId — same text reused across reports hits the same
  // cached row.
  async sentiment(riskId: string): Promise<AiInsightResult<SentimentResult>> {
    // Phase 39-06: visual regression stub.
    if (AI_VISUAL_STUB()) {
      return { available: true, result: STUB_SENTIMENT, cached: false };
    }
    const risk = await this.facade.getRiskForSentiment(riskId);
    if (!risk) {
      return { available: false, reason: "not_found" };
    }
    const contentHash = computeContentHash({
      risk: risk.risk,
      impact: risk.impact,
      mitigation: risk.mitigation,
    });

    // Phase 32-A1 (C-01): budget guard. Derive reportId from the risk's
    // section. The cache row WILL still be shared across reports for the
    // same risk-text tuple, but the budget guard fires per-report-scope.
    if (await this.isOverBudget(risk.reportId)) {
      return { available: false, reason: "budget_exceeded" };
    }

    try {
      const { row, cached } = await withCache<SentimentResult>({
        facade: this.facade,
        kind: "sentiment",
        contentHash,
        reportId: risk.reportId,
        generate: async () => {
          const userPrompt = buildSentimentUserPrompt(risk);
          const r = await runStructured(
            {
              model: SENTIMENT_MODEL,
              system: SENTIMENT_SYSTEM_PROMPT,
              user: userPrompt,
              toolName: SENTIMENT_TOOL_NAME,
              toolDescription: SENTIMENT_TOOL_DESCRIPTION,
              schema: sentimentSchema,
            },
            this.clientFactory,
          );
          return { result: r.result, usage: r.usage, modelId: SENTIMENT_MODEL };
        },
      });
      return { available: true, result: row.result, cached };
    } catch (err) {
      if (err instanceof AiRateLimitError) {
        return { available: false, reason: "rate_limit" };
      }
      return { available: false, reason: "unavailable" };
    }
  }

  // AI-03: per-cell on-track advisory verdict. Pre-computed counts are
  // injected into the user prompt with a "DO NOT change these numbers"
  // directive (PITFALLS C-2). The verdict is advisory — never replaces
  // the lead's chosen traffic-light colour.
  async onTrack(
    sectionId: string,
    projectId: string,
  ): Promise<AiInsightResult<OnTrackResult>> {
    // Phase 39-06: visual regression stub.
    if (AI_VISUAL_STUB()) {
      return { available: true, result: STUB_ON_TRACK, cached: false };
    }
    const cell = await this.facade.getCellForOnTrack(sectionId, projectId);
    if (!cell) {
      return { available: false, reason: "not_found" };
    }
    const cacheInput = {
      sectionId: cell.sectionId,
      projectId: cell.projectId,
      leadColour: cell.leadColour,
      currentItemCount: cell.currentItemCount,
      completedCount: cell.completedCount,
      blockedCount: cell.blockedCount,
      riskCount: cell.riskCount,
      decisionCount: cell.decisionCount,
      currentWeekText: cell.currentWeekText,
      nextWeekText: cell.nextWeekText,
      riskHighlights: cell.riskHighlights,
    };
    const contentHash = computeContentHash(cacheInput);

    // Phase 32-A1 (C-01): budget guard scoped per-report. The reportId is
    // looked up via the cell's section.
    if (await this.isOverBudget(cell.reportId)) {
      return { available: false, reason: "budget_exceeded" };
    }

    try {
      const { row, cached } = await withCache<OnTrackResult>({
        facade: this.facade,
        kind: "on_track",
        contentHash,
        reportId: cell.reportId,
        generate: async () => {
          const userPrompt = buildOnTrackUserPrompt(cell);
          const r = await runStructured(
            {
              model: ON_TRACK_MODEL,
              system: ON_TRACK_SYSTEM_PROMPT,
              user: userPrompt,
              toolName: ON_TRACK_TOOL_NAME,
              toolDescription: ON_TRACK_TOOL_DESCRIPTION,
              schema: onTrackSchema,
            },
            this.clientFactory,
          );
          return { result: r.result, usage: r.usage, modelId: ON_TRACK_MODEL };
        },
      });
      return { available: true, result: row.result, cached };
    } catch (err) {
      if (err instanceof AiRateLimitError) {
        return { available: false, reason: "rate_limit" };
      }
      return { available: false, reason: "unavailable" };
    }
  }
}
