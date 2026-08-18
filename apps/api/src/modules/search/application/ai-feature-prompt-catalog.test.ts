import { describe, expect, it } from "vitest";

import {
  aiFeaturePromptCatalog,
  baselineReportAssistantPrompts,
  REPORT_ASSISTANT_FEATURE_KEY,
} from "./ai-feature-prompt-catalog.js";

describe("AI feature prompt catalog", () => {
  it("registers only the first code-owned feature and all four slots", () => {
    const entries = aiFeaturePromptCatalog.list();
    expect(entries.map(({ featureKey }) => featureKey)).toEqual([
      REPORT_ASSISTANT_FEATURE_KEY,
    ]);
    expect(entries[0]?.slots).toEqual([
      "planner",
      "planner-repair",
      "grounded-answer",
      "citation-repair",
    ]);
  });

  it("uses each versioned slot as the complete runtime prompt", () => {
    const baseline = baselineReportAssistantPrompts();
    expect(baseline.featureKey).toBe(REPORT_ASSISTANT_FEATURE_KEY);
    expect(baseline.servingContractVersion).toBe(
      "report-assistant/editor-serving/v1",
    );
    expect(baseline.contentHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(baseline.slots).toHaveLength(4);
    expect(baseline.slots[0]?.effectivePrompt).toBe(
      baseline.slots[0]?.promptContents,
    );
  });

  it("does not accept an unregistered feature", () => {
    expect(() => aiFeaturePromptCatalog.require("future-feature")).toThrow(
      "AI prompt feature is not registered",
    );
  });
});
