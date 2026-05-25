// Phase 54 (UFB-055): AiSummaryService — backs `ai.periodSummary`
// tRPC procedure. Reads the period + its sections from the database
// via AiPrismaFacade, delegates generation to the pluggable AiAdapter
// (mock-only in this phase), wraps the result in a 60s Redis cache.
//
// The return shape carries an explicit `source` tag so the UI can
// label mock responses with a «(заглушка)» badge without sniffing
// the body. `citationIds` is currently the section-id list (the mock
// has no real retrieval), but the shape is forward-compatible with a
// real RAG pipeline that returns a subset of grounded sections.

import { Injectable } from "@nestjs/common";

import { type AiAdapter } from "./ai.adapter.js";
import { type AiSummaryCachePort } from "./ai-summary.cache.js";

export type AiSummaryResult = {
  summary: string;
  source: "mock" | "ai";
  citationIds: string[];
};

/**
 * Repository port — kept minimal on purpose. Production wires
 * AiSummaryPrismaRepository; tests stub directly.
 */
export interface AiSummaryRepository {
  /**
   * Loads the published-or-otherwise-readable sections for a period
   * (Report) so the adapter has text to summarise. Returns `null`
   * when the period itself does not exist, an empty array when the
   * period exists but has no readable sections.
   */
  getSectionsForPeriod(periodId: string): Promise<null | Array<{
    sectionId: string;
    authorName: string;
    text: string;
  }>>;
}

/**
 * Mock-summary determinism check — used by the service to set the
 * `source` tag without leaking the env probe to consumers. Matches the
 * sentinel string MockAiAdapter emits.
 */
function isMockOutput(output: string): boolean {
  return output.startsWith("[mock-summary]");
}

@Injectable()
export class AiSummaryService {
  /**
   * Constructed via factory in AiModule. The repository is injected
   * separately via `setRepository` so the existing AiModule providers
   * (which already construct AiSummaryService via useFactory) do not
   * have to change shape — the router wires the repo into the service
   * at bootstrap.
   */
  private repository: AiSummaryRepository | null = null;

  constructor(
    private readonly adapter: AiAdapter,
    private readonly cache: AiSummaryCachePort,
  ) {}

  setRepository(repo: AiSummaryRepository): void {
    this.repository = repo;
  }

  /**
   * Returns the mock summary for the given period, cached for 60s in
   * Redis (key `customreport:ai:summary:<periodId>` via AiSummaryCache).
   *
   *   - period not found              → throws Error (router maps to NOT_FOUND)
   *   - period exists, no sections    → empty-state summary (no adapter call)
   *   - period exists, ≥1 sections    → adapter.generate(...) result
   */
  // TODO(AGENT-REVIEW-02): wire real LLM provider here once org selects one.
  // AgentReviewComingSoon (UI trace) shows the coming-soon badge until this stub is replaced.
  async getSummary(periodId: string): Promise<AiSummaryResult> {
    if (!this.repository) {
      throw new Error("AiSummaryService.repository not wired");
    }
    const repo = this.repository;

    return this.cache.getOrCompute(`${periodId}:v1`, async () => {
      const sections = await repo.getSectionsForPeriod(periodId);
      if (sections === null) {
        throw new Error(`Period ${periodId} not found.`);
      }
      if (sections.length === 0) {
        return {
          summary: "",
          source: "mock" as const,
          citationIds: [],
        };
      }

      const summary = await this.adapter.generate(
        "Summarise the published sections of this period.",
        {
          periodId,
          sections,
        },
      );

      return {
        summary,
        source: isMockOutput(summary) ? ("mock" as const) : ("ai" as const),
        citationIds: sections.map((s) => s.sectionId),
      };
    });
  }
}
