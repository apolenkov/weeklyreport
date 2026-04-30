// Phase 31 (AI-03 / CONTEXT.md C-5) — Golden-set eval test.
//
// SKIPPED unless ANTHROPIC_API_KEY is set in env. Run via:
//   pnpm test:ai-eval
//
// This is the ONLY test in the AI module that calls the live Anthropic
// API. All other tests must vi.mock('@anthropic-ai/sdk', ...).
//
// Pass thresholds (CONTEXT.md C-5 — loose, will tighten after head sign-off):
// - ≥80% sentiment-classification match across all golden risks
// - ≥80% on-track-classification match across all golden cells
// - 0 hallucinated counts (no foreign digit-strings in narrative/rationale)
// - summary narrative ≤ 3 sentences
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

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

type FixtureRisk = RiskForSentiment & {
  // Fixtures use `id` for human readability; loadFixtures normalises it
  // into riskId so the facade lookup works.
  id?: string;
  expectedLevel: 'low' | 'medium' | 'high';
};

type Fixture = {
  id: string;
  description: string;
  report: ReportForSummary;
  risks: ReadonlyArray<FixtureRisk>;
  cells: ReadonlyArray<CellForOnTrack & { expectedVerdict: 'on-track' | 'attention' | 'off-track' }>;
  expected: { summary: { tone: 'positive' | 'neutral' | 'negative'; narrativeContains: string[] } };
};

class StubFacade implements AiFacade {
  private insights = new Map<string, AiInsightRow<unknown>>();
  constructor(public fixture: Fixture) {}
   
  async getReportForSummary(): Promise<ReportForSummary | null> {
    return this.fixture.report;
  }
   
  async getRiskForSentiment(riskId: string): Promise<RiskForSentiment | null> {
    const risk = this.fixture.risks.find((r) => r.riskId === riskId);
    if (!risk) return null;
    // Phase 32-A1 (C-01): inject reportId so the budget guard has scope.
    return { ...risk, reportId: this.fixture.report.reportId };
  }

  async getCellForOnTrack(sectionId: string, projectId: string): Promise<CellForOnTrack | null> {
    const cell = this.fixture.cells.find(
      (c) => c.sectionId === sectionId && c.projectId === projectId,
    );
    if (!cell) return null;
    return { ...cell, reportId: this.fixture.report.reportId };
  }
   
  async getAiInsight<R>(kind: AiInsightKind, hash: string): Promise<AiInsightRow<R> | null> {
    return (this.insights.get(`${kind}:${hash}`) as AiInsightRow<R> | undefined) ?? null;
  }
   
  async upsertAiInsight<R>(input: AiInsightUpsertInput<R>): Promise<AiInsightRow<R>> {
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
    this.insights.set(`${input.kind}:${input.contentHash}`, row as AiInsightRow<unknown>);
    return row;
  }
   
  async deleteAiInsight(): Promise<void> {
    /* no-op */
  }
   
  async getRecentInsightTokenSum(): Promise<number> {
    return 0;
  }
}

function loadFixtures(): Fixture[] {
  const dir = resolve(import.meta.dirname, '..', '__fixtures__', 'golden-set');
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  return files.map((f) => {
    const raw = readFileSync(resolve(dir, f), 'utf8');
    const fx = JSON.parse(raw) as Fixture;
    // Risks need riskId field for facade lookups.
    const normalisedRisks = fx.risks.map((r) => ({
      ...r,
      riskId: r.id ?? r.riskId,
    }));
    return { ...fx, risks: normalisedRisks };
  });
}

function countSentences(text: string): number {
  // Crude but adequate: count terminal punctuation [.!?] excluding decimals.
  return (text.match(/[.!?](?:\s|$)/g) ?? []).length;
}

function extractDigits(text: string): string[] {
  return text.match(/\b\d+\b/g) ?? [];
}

function inputDigits(fx: Fixture): Set<string> {
  const set = new Set<string>();
  // Collect every digit-string from the input the model could legitimately mirror.
  set.add(String(fx.report.greenCount));
  set.add(String(fx.report.yellowCount));
  set.add(String(fx.report.redCount));
  set.add(String(fx.report.sectionCount));
  for (const s of fx.report.sections) {
    set.add(String(s.itemCount));
    set.add(String(s.riskCount));
    set.add(String(s.decisionCount));
    for (const t of s.trafficLights) {
      // status string itself contains no digit
      void t;
    }
  }
  for (const c of fx.cells) {
    set.add(String(c.currentItemCount));
    set.add(String(c.completedCount));
    set.add(String(c.blockedCount));
    set.add(String(c.riskCount));
    set.add(String(c.decisionCount));
  }
  return set;
}

describe.skipIf(!process.env['ANTHROPIC_API_KEY'])('Golden-set eval (live Haiku)', () => {
  const fixtures = loadFixtures();
  let sentimentMatched = 0;
  let sentimentTotal = 0;
  let onTrackMatched = 0;
  let onTrackTotal = 0;
  const hallucinatedCounts: string[] = [];
  const summaryViolations: string[] = [];

  for (const fx of fixtures) {
    it(`fixture ${fx.id} — ${fx.description}`, async () => {
      const service = new AiService(new StubFacade(fx));
      const validInputDigits = inputDigits(fx);

      // AI-01: summary
      const summaryRes = await service.summary(fx.report.reportId);
      expect(summaryRes.available).toBe(true);
      if (summaryRes.available) {
        const sentenceCount = countSentences(summaryRes.result.narrative);
        if (sentenceCount > 3) summaryViolations.push(`${fx.id}: ${sentenceCount} sentences`);
        const digits = extractDigits(summaryRes.result.narrative);
        for (const d of digits) {
          if (!validInputDigits.has(d)) hallucinatedCounts.push(`${fx.id}: ${d}`);
        }
      }

      // AI-02: sentiment per risk
      for (const r of fx.risks) {
        sentimentTotal += 1;
        const res = await service.sentiment(r.riskId);
        if (res.available && res.result.level === r.expectedLevel) sentimentMatched += 1;
        if (res.available) {
          const digits = extractDigits(res.result.rationale);
          for (const d of digits) {
            if (!validInputDigits.has(d)) hallucinatedCounts.push(`${fx.id}/${r.riskId}: ${d}`);
          }
        }
      }

      // AI-03: on-track per cell
      for (const c of fx.cells) {
        onTrackTotal += 1;
        const res = await service.onTrack(c.sectionId, c.projectId);
        if (res.available && res.result.verdict === c.expectedVerdict) onTrackMatched += 1;
        if (res.available) {
          const digits = extractDigits(res.result.rationale);
          for (const d of digits) {
            if (!validInputDigits.has(d)) hallucinatedCounts.push(`${fx.id}/${c.sectionId}: ${d}`);
          }
        }
      }
    }, 60_000);
  }

  it('aggregate thresholds', () => {
    const sentimentRate = sentimentTotal === 0 ? 1 : sentimentMatched / sentimentTotal;
    const onTrackRate = onTrackTotal === 0 ? 1 : onTrackMatched / onTrackTotal;
    expect(sentimentRate).toBeGreaterThanOrEqual(0.8);
    expect(onTrackRate).toBeGreaterThanOrEqual(0.8);
    expect(hallucinatedCounts).toEqual([]);
    expect(summaryViolations).toEqual([]);
  });
});
