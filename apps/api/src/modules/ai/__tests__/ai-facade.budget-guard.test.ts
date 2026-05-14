// Phase 32-A1 (C-01) — per-report token budget guard test.
//
// Asserts the budget guard:
//   - allows calls under the cap
//   - blocks calls when the cumulative report tokens exceed the cap
//   - is enforced on summary, sentiment, and on-track (all 3 features)
//   - denies unscoped calls (no reportId derivable) — defensive only since
//     every facade lookup now sets reportId on the input
//
// Mocks @anthropic-ai/sdk so no live API calls are made.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const messagesCreateMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    public messages = { create: messagesCreateMock };
    constructor(public readonly opts: { apiKey: string }) {}
  }
  return { default: MockAnthropic };
});

import { _resetAiClientForTests } from "../ai-client.js";
import { AiService, PER_REPORT_BUDGET_TOKENS } from "../ai.service.js";
import type {
  AiFacade,
  AiInsightRow,
  AiInsightUpsertInput,
  CellForOnTrack,
  ReportForSummary,
  RiskForSentiment,
} from "../ai-facade.js";
import type { AiInsightKind } from "@prisma/client";

class InMemoryFacade implements AiFacade {
  public reports = new Map<string, ReportForSummary>();
  public risks = new Map<string, RiskForSentiment>();
  public cells = new Map<string, CellForOnTrack>();
  public insights = new Map<string, AiInsightRow<unknown>>();
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

const REPORT_ID = "00000000-0000-4000-8000-000000000010";
const OTHER_REPORT_ID = "00000000-0000-4000-8000-0000000000ff";
const RISK_ID = "11111111-1111-4111-8111-111111111111";
const SECTION_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_ID = "33333333-3333-4333-8333-333333333333";

const sampleReport: ReportForSummary = {
  reportId: REPORT_ID,
  periodLabel: "2026-W18",
  sectionCount: 1,
  greenCount: 1,
  yellowCount: 0,
  redCount: 0,
  sections: [
    {
      authorName: "Alice",
      trafficLights: [{ projectName: "Acme", status: "green" }],
      riskCount: 0,
      decisionCount: 0,
      itemCount: 1,
    },
  ],
};

const sampleRisk: RiskForSentiment = {
  riskId: RISK_ID,
  reportId: REPORT_ID,
  risk: "Vendor renewal pending",
  impact: "Could delay launch",
  mitigation: "Legal review scheduled",
};

const sampleCell: CellForOnTrack = {
  sectionId: SECTION_ID,
  reportId: REPORT_ID,
  projectId: PROJECT_ID,
  leadName: "Alice",
  projectName: "Acme",
  leadColour: "green",
  currentItemCount: 1,
  completedCount: 1,
  blockedCount: 0,
  riskCount: 0,
  decisionCount: 0,
  currentWeekText: "Shipped login.",
  nextWeekText: "Begin RBAC.",
  riskHighlights: "",
};

beforeEach(() => {
  _resetAiClientForTests();
  messagesCreateMock.mockReset();
  process.env["ANTHROPIC_API_KEY"] = "test-key";
});

afterEach(() => {
  delete process.env["ANTHROPIC_API_KEY"];
});

describe("AiService budget guard (Phase 32-A1 / C-01)", () => {
  it("PER_REPORT_BUDGET_TOKENS is 50_000 (≈ $0.05 at Haiku 4.5)", () => {
    expect(PER_REPORT_BUDGET_TOKENS).toBe(50_000);
  });

  describe("summary", () => {
    it("under budget → allows the SDK call", async () => {
      const facade = new InMemoryFacade();
      facade.reports.set(REPORT_ID, sampleReport);
      facade.recentTokenSumByReport.set(REPORT_ID, 1_000);
      messagesCreateMock.mockResolvedValueOnce({
        content: [
          {
            type: "tool_use",
            input: {
              narrative: "Single green report. No issues. Steady.",
              tone: "positive",
              highlights: [],
            },
          },
        ],
        usage: { input_tokens: 4500, output_tokens: 100 },
      });
      const service = new AiService(facade);
      const r = await service.summary(REPORT_ID);
      expect(r.available).toBe(true);
      expect(messagesCreateMock).toHaveBeenCalledTimes(1);
    });

    it("over budget → returns budget_exceeded sentinel without calling SDK", async () => {
      const facade = new InMemoryFacade();
      facade.reports.set(REPORT_ID, sampleReport);
      facade.recentTokenSumByReport.set(
        REPORT_ID,
        PER_REPORT_BUDGET_TOKENS + 1,
      );
      const service = new AiService(facade);
      const r = await service.summary(REPORT_ID);
      expect(r).toEqual({ available: false, reason: "budget_exceeded" });
      expect(messagesCreateMock).not.toHaveBeenCalled();
    });

    it("budget on a different report does NOT block this one", async () => {
      const facade = new InMemoryFacade();
      facade.reports.set(REPORT_ID, sampleReport);
      facade.recentTokenSumByReport.set(
        OTHER_REPORT_ID,
        PER_REPORT_BUDGET_TOKENS * 10,
      );
      messagesCreateMock.mockResolvedValueOnce({
        content: [
          {
            type: "tool_use",
            input: {
              narrative: "Single green report. No issues. Steady.",
              tone: "positive",
              highlights: [],
            },
          },
        ],
        usage: { input_tokens: 100, output_tokens: 100 },
      });
      const service = new AiService(facade);
      const r = await service.summary(REPORT_ID);
      expect(r.available).toBe(true);
      expect(messagesCreateMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("sentiment", () => {
    it("over budget → returns budget_exceeded without calling SDK", async () => {
      const facade = new InMemoryFacade();
      facade.risks.set(RISK_ID, sampleRisk);
      facade.recentTokenSumByReport.set(
        REPORT_ID,
        PER_REPORT_BUDGET_TOKENS + 1,
      );
      const service = new AiService(facade);
      const r = await service.sentiment(RISK_ID);
      expect(r).toEqual({ available: false, reason: "budget_exceeded" });
      expect(messagesCreateMock).not.toHaveBeenCalled();
    });

    it("under budget → calls SDK and returns result", async () => {
      const facade = new InMemoryFacade();
      facade.risks.set(RISK_ID, sampleRisk);
      facade.recentTokenSumByReport.set(REPORT_ID, 1_000);
      messagesCreateMock.mockResolvedValueOnce({
        content: [
          {
            type: "tool_use",
            input: { level: "low", rationale: "Vendor renewal scheduled" },
          },
        ],
        usage: { input_tokens: 1000, output_tokens: 30 },
      });
      const service = new AiService(facade);
      const r = await service.sentiment(RISK_ID);
      expect(r.available).toBe(true);
    });
  });

  describe("on-track", () => {
    it("over budget → returns budget_exceeded without calling SDK", async () => {
      const facade = new InMemoryFacade();
      facade.cells.set(`${SECTION_ID}:${PROJECT_ID}`, sampleCell);
      facade.recentTokenSumByReport.set(
        REPORT_ID,
        PER_REPORT_BUDGET_TOKENS + 1,
      );
      const service = new AiService(facade);
      const r = await service.onTrack(SECTION_ID, PROJECT_ID);
      expect(r).toEqual({ available: false, reason: "budget_exceeded" });
      expect(messagesCreateMock).not.toHaveBeenCalled();
    });

    it("under budget → calls SDK and returns result", async () => {
      const facade = new InMemoryFacade();
      facade.cells.set(`${SECTION_ID}:${PROJECT_ID}`, sampleCell);
      facade.recentTokenSumByReport.set(REPORT_ID, 1_000);
      messagesCreateMock.mockResolvedValueOnce({
        content: [
          {
            type: "tool_use",
            input: {
              verdict: "on-track",
              confidence: "high",
              rationale: "Steady velocity",
            },
          },
        ],
        usage: { input_tokens: 1200, output_tokens: 60 },
      });
      const service = new AiService(facade);
      const r = await service.onTrack(SECTION_ID, PROJECT_ID);
      expect(r.available).toBe(true);
    });
  });

  describe("unscoped calls (no reportId)", () => {
    it("sentiment with empty reportId on the risk → budget_exceeded", async () => {
      const facade = new InMemoryFacade();
      facade.risks.set(RISK_ID, { ...sampleRisk, reportId: "" });
      const service = new AiService(facade);
      const r = await service.sentiment(RISK_ID);
      expect(r).toEqual({ available: false, reason: "budget_exceeded" });
      expect(messagesCreateMock).not.toHaveBeenCalled();
    });

    it("on-track with empty reportId on the cell → budget_exceeded", async () => {
      const facade = new InMemoryFacade();
      facade.cells.set(`${SECTION_ID}:${PROJECT_ID}`, {
        ...sampleCell,
        reportId: "",
      });
      const service = new AiService(facade);
      const r = await service.onTrack(SECTION_ID, PROJECT_ID);
      expect(r).toEqual({ available: false, reason: "budget_exceeded" });
      expect(messagesCreateMock).not.toHaveBeenCalled();
    });
  });
});
