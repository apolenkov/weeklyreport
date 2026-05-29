// Phase 31 (AI-01) — AiService cache + sentinel + budget guard tests.
// Mocks @anthropic-ai/sdk; provides an in-memory AiFacade fake.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const messagesCreateMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    public messages = { create: messagesCreateMock };
    constructor(public readonly opts: { apiKey: string }) {}
  }
  return { default: MockAnthropic };
});

import type { AiInsightKind } from "@prisma/client";
import { AiService } from "./ai.service.js";
import { _resetAiClientForTests } from "./ai-client.js";
import type {
  AiFacade,
  AiInsightRow,
  AiInsightUpsertInput,
  CellForOnTrack,
  ReportForSummary,
  RiskForSentiment,
} from "./ai-facade.js";

class InMemoryFacade implements AiFacade {
  public reports = new Map<string, ReportForSummary>();
  public risks = new Map<string, RiskForSentiment>();
  public cells = new Map<string, CellForOnTrack>();
  public insights = new Map<string, AiInsightRow<unknown>>();
  // Phase 32-A1 (C-01): per-report token sums for the budget guard.
  public recentTokenSumByReport = new Map<string, number>();

  private key(kind: AiInsightKind, hash: string) {
    return `${kind}:${hash}`;
  }

  async getReportForSummary(
    reportId: string,
  ): Promise<ReportForSummary | null> {
    return this.reports.get(reportId) ?? null;
  }

  async getRiskForSentiment(riskId: string): Promise<RiskForSentiment | null> {
    return this.risks.get(riskId) ?? null;
  }

  async getCellForOnTrack(
    sectionId: string,
    projectId: string,
  ): Promise<CellForOnTrack | null> {
    return this.cells.get(`${sectionId}:${projectId}`) ?? null;
  }

  async getAiInsight<R>(
    kind: AiInsightKind,
    hash: string,
  ): Promise<AiInsightRow<R> | null> {
    return (
      (this.insights.get(this.key(kind, hash)) as
        | AiInsightRow<R>
        | undefined) ?? null
    );
  }

  async upsertAiInsight<R>(
    input: AiInsightUpsertInput<R>,
  ): Promise<AiInsightRow<R>> {
    const row: AiInsightRow<R> = {
      id: `${input.kind}-${input.contentHash}`,
      kind: input.kind,
      contentHash: input.contentHash,
      reportId: input.reportId ?? null,
      result: input.result,
      modelId: input.modelId,
      inputTokens: input.usage.inputTokens,
      outputTokens: input.usage.outputTokens,
      cacheCreationTokens: input.usage.cacheCreationTokens,
      cacheReadTokens: input.usage.cacheReadTokens,
      createdAt: new Date(),
    };
    this.insights.set(
      this.key(input.kind, input.contentHash),
      row as AiInsightRow<unknown>,
    );
    return row;
  }

  async deleteAiInsight(kind: AiInsightKind, hash: string): Promise<void> {
    this.insights.delete(this.key(kind, hash));
  }

  async getRecentInsightTokenSum(reportId: string): Promise<number> {
    return this.recentTokenSumByReport.get(reportId) ?? 0;
  }
}

const REPORT_ID = "00000000-0000-4000-8000-000000000001";
const sampleReport: ReportForSummary = {
  reportId: REPORT_ID,
  periodLabel: "2026-W18",
  sectionCount: 2,
  greenCount: 5,
  yellowCount: 1,
  redCount: 0,
  sections: [
    {
      authorName: "Alice",
      trafficLights: [{ projectName: "Acme", status: "green" }],
      riskCount: 1,
      decisionCount: 0,
      itemCount: 4,
    },
    {
      authorName: "Bob",
      trafficLights: [{ projectName: "Globex", status: "yellow" }],
      riskCount: 0,
      decisionCount: 1,
      itemCount: 3,
    },
  ],
};

beforeEach(() => {
  _resetAiClientForTests();
  messagesCreateMock.mockReset();
  process.env["ANTHROPIC_API_KEY"] = "test-key";
});

afterEach(() => {
  delete process.env["ANTHROPIC_API_KEY"];
});

describe("AiService.summary", () => {
  it("returns not_found when the report is missing", async () => {
    const facade = new InMemoryFacade();
    const service = new AiService(facade);
    const r = await service.summary(REPORT_ID);
    expect(r).toEqual({ available: false, reason: "not_found" });
    expect(messagesCreateMock).not.toHaveBeenCalled();
  });

  it("cache miss → SDK called → AiInsight upserted", async () => {
    const facade = new InMemoryFacade();
    facade.reports.set(REPORT_ID, sampleReport);
    messagesCreateMock.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          input: {
            narrative:
              "Five greens, one yellow. Risks tracked. Decisions pending.",
            tone: "positive",
            highlights: ["5 of 6 green"],
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
      expect(r.result.tone).toBe("positive");
    }
    expect(facade.insights.size).toBe(1);
  });

  it("cache hit on second call → SDK NOT called", async () => {
    const facade = new InMemoryFacade();
    facade.reports.set(REPORT_ID, sampleReport);
    messagesCreateMock.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          input: {
            narrative:
              "Five greens, one yellow. Risks tracked. Decisions pending.",
            tone: "positive",
            highlights: ["5 of 6 green"],
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

  it("regenerateSummary busts cache → SDK called again", async () => {
    const facade = new InMemoryFacade();
    facade.reports.set(REPORT_ID, sampleReport);
    messagesCreateMock.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          input: {
            narrative: "Sample narrative one two three four five.",
            tone: "neutral",
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

  it("SDK throws → returns unavailable sentinel (no exception bubble)", async () => {
    const facade = new InMemoryFacade();
    facade.reports.set(REPORT_ID, sampleReport);
    messagesCreateMock.mockRejectedValueOnce(new Error("network down"));
    const service = new AiService(facade);
    const r = await service.summary(REPORT_ID);
    expect(r).toEqual({ available: false, reason: "unavailable" });
  });

  it("missing ANTHROPIC_API_KEY → unavailable sentinel", async () => {
    delete process.env["ANTHROPIC_API_KEY"];
    _resetAiClientForTests();
    const facade = new InMemoryFacade();
    facade.reports.set(REPORT_ID, sampleReport);
    const service = new AiService(facade);
    const r = await service.summary(REPORT_ID);
    expect(r).toEqual({ available: false, reason: "unavailable" });
    expect(messagesCreateMock).not.toHaveBeenCalled();
  });

  it("budget exceeded → returns budget_exceeded sentinel without calling SDK", async () => {
    const facade = new InMemoryFacade();
    facade.reports.set(REPORT_ID, sampleReport);
    facade.recentTokenSumByReport.set(REPORT_ID, 60_000); // exceeds 50K cap
    const service = new AiService(facade);
    const r = await service.summary(REPORT_ID);
    expect(r).toEqual({ available: false, reason: "budget_exceeded" });
    expect(messagesCreateMock).not.toHaveBeenCalled();
  });

  it("rate-limit error → returns rate_limit sentinel", async () => {
    const facade = new InMemoryFacade();
    facade.reports.set(REPORT_ID, sampleReport);
    const err = new Error("429") as Error & { name: string };
    err.name = "RateLimitError";
    messagesCreateMock.mockRejectedValueOnce(err);
    const service = new AiService(facade);
    const r = await service.summary(REPORT_ID);
    expect(r).toEqual({ available: false, reason: "rate_limit" });
  });
});

describe("summary system prompt — char-count floor", async () => {
  it("SUMMARY_SYSTEM_PROMPT is at least 3500 chars (≥1024-token cache breakpoint)", async () => {
    const { SUMMARY_SYSTEM_PROMPT } = await import("./prompts/summary.js");
    expect(SUMMARY_SYSTEM_PROMPT.length).toBeGreaterThanOrEqual(3500);
  });
});

describe("sentiment system prompt — char-count floor", async () => {
  it("SENTIMENT_SYSTEM_PROMPT is at least 3500 chars", async () => {
    const { SENTIMENT_SYSTEM_PROMPT } = await import("./prompts/sentiment.js");
    expect(SENTIMENT_SYSTEM_PROMPT.length).toBeGreaterThanOrEqual(3500);
  });
});

describe("AiService.sentiment", () => {
  const RISK_ID_A = "22222222-2222-4222-8222-222222222222";
  const RISK_ID_B = "33333333-3333-4333-8333-333333333333";
  const SAMPLE_RISK = {
    riskId: RISK_ID_A,
    reportId: REPORT_ID,
    risk: "Single engineer holds critical knowledge",
    impact: "Key absence stalls progress",
    mitigation: "Pair-programming weekly",
  } as const;

  it("returns not_found when risk is missing", async () => {
    const facade = new InMemoryFacade();
    const service = new AiService(facade);
    const r = await service.sentiment(RISK_ID_A);
    expect(r).toEqual({ available: false, reason: "not_found" });
    expect(messagesCreateMock).not.toHaveBeenCalled();
  });

  it("cache miss → SDK called → row upserted with kind=sentiment", async () => {
    const facade = new InMemoryFacade();
    facade.risks.set(RISK_ID_A, { ...SAMPLE_RISK });
    messagesCreateMock.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          input: {
            level: "medium",
            rationale: "Bus factor with mitigation in progress",
          },
        },
      ],
      usage: { input_tokens: 1500, output_tokens: 30 },
    });
    const service = new AiService(facade);
    const r = await service.sentiment(RISK_ID_A);
    expect(r.available).toBe(true);
    if (r.available) expect(r.result.level).toBe("medium");
    expect(facade.insights.size).toBe(1);
    expect([...facade.insights.values()][0]?.kind).toBe("sentiment");
  });

  it("cache hit on second call with identical text → SDK NOT called", async () => {
    const facade = new InMemoryFacade();
    facade.risks.set(RISK_ID_A, { ...SAMPLE_RISK });
    messagesCreateMock.mockResolvedValueOnce({
      content: [
        { type: "tool_use", input: { level: "medium", rationale: "cached" } },
      ],
      usage: { input_tokens: 1500, output_tokens: 30 },
    });
    const service = new AiService(facade);
    await service.sentiment(RISK_ID_A);
    await service.sentiment(RISK_ID_A);
    expect(messagesCreateMock).toHaveBeenCalledTimes(1);
  });

  it("two different riskIds with identical text share one cached row", async () => {
    const facade = new InMemoryFacade();
    facade.risks.set(RISK_ID_A, { ...SAMPLE_RISK, riskId: RISK_ID_A });
    facade.risks.set(RISK_ID_B, { ...SAMPLE_RISK, riskId: RISK_ID_B });
    messagesCreateMock.mockResolvedValueOnce({
      content: [
        { type: "tool_use", input: { level: "low", rationale: "shared" } },
      ],
      usage: { input_tokens: 1500, output_tokens: 30 },
    });
    const service = new AiService(facade);
    await service.sentiment(RISK_ID_A);
    await service.sentiment(RISK_ID_B);
    expect(messagesCreateMock).toHaveBeenCalledTimes(1);
    expect(facade.insights.size).toBe(1);
  });

  it("SDK throws → returns unavailable sentinel", async () => {
    const facade = new InMemoryFacade();
    facade.risks.set(RISK_ID_A, { ...SAMPLE_RISK });
    messagesCreateMock.mockRejectedValueOnce(new Error("boom"));
    const service = new AiService(facade);
    const r = await service.sentiment(RISK_ID_A);
    expect(r).toEqual({ available: false, reason: "unavailable" });
  });
});

describe("on-track system prompt — char-count floor", async () => {
  it("ON_TRACK_SYSTEM_PROMPT is at least 3500 chars", async () => {
    const { ON_TRACK_SYSTEM_PROMPT } = await import("./prompts/on-track.js");
    expect(ON_TRACK_SYSTEM_PROMPT.length).toBeGreaterThanOrEqual(3500);
  });
});

describe("AiService.onTrack", () => {
  const SECTION_ID = "44444444-4444-4444-8444-444444444444";
  const PROJECT_ID = "55555555-5555-4555-8555-555555555555";

  const SAMPLE_CELL = {
    sectionId: SECTION_ID,
    reportId: REPORT_ID,
    projectId: PROJECT_ID,
    leadName: "Alice",
    projectName: "ProjectAlpha",
    leadColour: "green" as const,
    currentItemCount: 4,
    completedCount: 2,
    blockedCount: 0,
    riskCount: 1,
    decisionCount: 0,
    currentWeekText: "Shipped login flow.",
    nextWeekText: "Begin RBAC.",
    riskHighlights: "- Vendor delay (impact: medium)",
  };

  it("returns not_found when cell is missing", async () => {
    const facade = new InMemoryFacade();
    const service = new AiService(facade);
    const r = await service.onTrack(SECTION_ID, PROJECT_ID);
    expect(r).toEqual({ available: false, reason: "not_found" });
    expect(messagesCreateMock).not.toHaveBeenCalled();
  });

  it("cache miss → SDK called → row upserted with kind=on_track", async () => {
    const facade = new InMemoryFacade();
    facade.cells.set(`${SECTION_ID}:${PROJECT_ID}`, { ...SAMPLE_CELL });
    messagesCreateMock.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          input: {
            verdict: "on-track",
            confidence: "high",
            rationale: "Steady velocity with one bounded risk",
          },
        },
      ],
      usage: { input_tokens: 1200, output_tokens: 60 },
    });
    const service = new AiService(facade);
    const r = await service.onTrack(SECTION_ID, PROJECT_ID);
    expect(r.available).toBe(true);
    if (r.available) expect(r.result.verdict).toBe("on-track");
    expect([...facade.insights.values()][0]?.kind).toBe("on_track");
  });

  it("user prompt contains pre-computed counts and DO NOT directive", async () => {
    const facade = new InMemoryFacade();
    facade.cells.set(`${SECTION_ID}:${PROJECT_ID}`, { ...SAMPLE_CELL });
    messagesCreateMock.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          input: {
            verdict: "on-track",
            confidence: "high",
            rationale: "fine",
          },
        },
      ],
      usage: { input_tokens: 1200, output_tokens: 60 },
    });
    const service = new AiService(facade);
    await service.onTrack(SECTION_ID, PROJECT_ID);

    const arg = messagesCreateMock.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    const messages = arg["messages"] as Array<{
      role: string;
      content: string;
    }>;
    const userPrompt = messages[0]?.content ?? "";
    expect(userPrompt).toContain("DO NOT change these numbers");
    expect(userPrompt).toContain("currentItemCount: 4");
    expect(userPrompt).toContain("completedCount: 2");
    expect(userPrompt).toContain("blockedCount: 0");
    expect(userPrompt).toContain("riskCount: 1");
    expect(userPrompt).toContain("decisionCount: 0");
  });

  it("cache hit on second call with identical snapshot → SDK NOT called", async () => {
    const facade = new InMemoryFacade();
    facade.cells.set(`${SECTION_ID}:${PROJECT_ID}`, { ...SAMPLE_CELL });
    messagesCreateMock.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          input: {
            verdict: "on-track",
            confidence: "medium",
            rationale: "cached",
          },
        },
      ],
      usage: { input_tokens: 1200, output_tokens: 60 },
    });
    const service = new AiService(facade);
    await service.onTrack(SECTION_ID, PROJECT_ID);
    await service.onTrack(SECTION_ID, PROJECT_ID);
    expect(messagesCreateMock).toHaveBeenCalledTimes(1);
  });

  it("SDK throws → returns unavailable sentinel", async () => {
    const facade = new InMemoryFacade();
    facade.cells.set(`${SECTION_ID}:${PROJECT_ID}`, { ...SAMPLE_CELL });
    messagesCreateMock.mockRejectedValueOnce(new Error("boom"));
    const service = new AiService(facade);
    const r = await service.onTrack(SECTION_ID, PROJECT_ID);
    expect(r).toEqual({ available: false, reason: "unavailable" });
  });
});
