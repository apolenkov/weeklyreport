import { beforeEach, describe, expect, it } from "vitest";

import { metricsRegistry } from "../../../infrastructure/metrics/metrics.registry.js";
import { ReportAssistantPrometheusTelemetry } from "./report-assistant-prometheus-telemetry.adapter.js";

describe("ReportAssistantPrometheusTelemetry", () => {
  beforeEach(() => {
    metricsRegistry.resetMetrics();
  });

  it("records bounded outcome, cache, repair, candidate, and usage metrics", async () => {
    const telemetry = new ReportAssistantPrometheusTelemetry();

    telemetry.record({
      outcome: "ok",
      latencyMs: 250,
      model: "mistral-medium-3-5",
      trace: {
        mode: "semantic_ranked",
        candidateCount: 12,
        evidenceCount: 5,
        cacheHitCount: 10,
        cacheMissCount: 2,
        readThrough: true,
        plannerRepairCount: 1,
        citationRepairCount: 1,
        usage: { promptTokens: 100, completionTokens: 40, totalTokens: 140 },
      },
    });

    const text = await metricsRegistry.metrics();

    expect(text).toContain(
      'customreport_assistant_requests_total{mode="semantic_ranked",outcome="ok",model="mistral-medium-3-5"} 1',
    );
    expect(text).toContain(
      'customreport_assistant_cache_events_total{mode="semantic_ranked",result="hit"} 10',
    );
    expect(text).toContain(
      'customreport_assistant_repairs_total{model="mistral-medium-3-5",kind="planner"} 1',
    );
    expect(text).toContain(
      'customreport_assistant_tokens_total{model="mistral-medium-3-5",kind="total"} 140',
    );
    expect(text).toContain(
      'customreport_assistant_candidate_count_count{mode="semantic_ranked",stage="retrieved"} 1',
    );
  });

  it("does not expose report content or identity-shaped labels", async () => {
    const telemetry = new ReportAssistantPrometheusTelemetry();

    telemetry.record({
      outcome: "no_results",
      latencyMs: 4,
      model: "mistral-medium-3-5",
      trace: {
        mode: "structured",
        candidateCount: 0,
        evidenceCount: 0,
        cacheHitCount: 0,
        cacheMissCount: 0,
        readThrough: false,
        plannerRepairCount: 0,
        citationRepairCount: 0,
        usage: null,
      },
    });

    const text = await metricsRegistry.metrics();

    expect(text).not.toContain("What changed?");
    expect(text).not.toMatch(
      /(?:question|reportId|sectionId|authorId|authorName|subjectName|answerMarkdown|prompt|embedding|recordId)=/i,
    );
  });
});
