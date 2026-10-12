import type { AiPromptContents } from "@weeklyreport/shared";
import {
  AI_PROMPT_CORE_LIMIT,
  AI_PROMPT_EDITABLE_TAIL_SEPARATOR,
  AI_PROMPT_SLOT_CONTENT_LIMIT,
  aiPromptSlotReadSchema,
} from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import {
  aiFeaturePromptCatalog,
  baselineReportAssistantPrompts,
  composePromptSet,
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

  it("composes immutable core before the editable tail", () => {
    const baseline = baselineReportAssistantPrompts();
    expect(baseline.featureKey).toBe(REPORT_ASSISTANT_FEATURE_KEY);
    expect(baseline.servingContractVersion).toBe(
      "report-assistant/editor-serving/v1",
    );
    expect(baseline.contentHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(baseline.slots).toHaveLength(4);
    const slot = baseline.slots[0];
    if (!slot) throw new Error("Expected a baseline prompt slot");
    expect(slot.effectivePrompt).toContain(slot.lockedCore);
    expect(slot.effectivePrompt).toContain(slot.promptContents);
    expect(slot.effectivePrompt.indexOf(slot.lockedCore)).toBe(0);
    expect(slot.effectivePrompt).toContain(
      "Operator guidance (editable tail):",
    );
    expect(slot.effectivePrompt).toBe(
      `${slot.lockedCore}${AI_PROMPT_EDITABLE_TAIL_SEPARATOR}${slot.promptContents}`,
    );
  });

  it("keeps a catalog-legal boundary composition readable by the shared schema", () => {
    const entry = aiFeaturePromptCatalog.require(REPORT_ASSISTANT_FEATURE_KEY);
    const boundaryCores = {
      ...entry.lockedCore,
      planner: "c".repeat(AI_PROMPT_CORE_LIMIT),
    };
    const editable = {
      ...entry.defaultEditableInstructions,
      planner: "e".repeat(AI_PROMPT_SLOT_CONTENT_LIMIT),
    };
    const composed = composePromptSet(
      { ...entry, lockedCore: boundaryCores },
      editable,
      boundaryCores,
    );
    const planner = composed.slots.find(({ slot }) => slot === "planner");
    expect(planner?.effectivePrompt).toHaveLength(
      AI_PROMPT_CORE_LIMIT +
        AI_PROMPT_EDITABLE_TAIL_SEPARATOR.length +
        AI_PROMPT_SLOT_CONTENT_LIMIT,
    );
    expect(
      composed.slots.every(
        (slot) => aiPromptSlotReadSchema.safeParse(slot).success,
      ),
    ).toBe(true);
  });

  it("rejects an editable slot that fails the shared contents schema", () => {
    const entry = aiFeaturePromptCatalog.require(REPORT_ASSISTANT_FEATURE_KEY);
    const editable = {
      ...entry.defaultEditableInstructions,
      planner: "",
    };
    expect(() =>
      composePromptSet(entry, editable, { ...entry.lockedCore }),
    ).toThrow("Invalid report-assistant prompt edit");
  });

  it("still rejects a serialized bundle over the shared cap", () => {
    const entry = aiFeaturePromptCatalog.require(REPORT_ASSISTANT_FEATURE_KEY);
    const editable = Object.fromEntries(
      entry.slots.map((slot) => [
        slot,
        "e".repeat(AI_PROMPT_SLOT_CONTENT_LIMIT),
      ]),
    ) as AiPromptContents;
    expect(() =>
      composePromptSet(entry, editable, { ...entry.lockedCore }),
    ).toThrow("exceed the size limit");
  });

  it("rejects a tampered locked core snapshot", () => {
    const entry = aiFeaturePromptCatalog.require(REPORT_ASSISTANT_FEATURE_KEY);
    const baseline = baselineReportAssistantPrompts();
    const snapshot = Object.fromEntries(
      baseline.slots.map(({ slot, lockedCore }) => [slot, lockedCore]),
    ) as AiPromptContents;
    const promptContents = Object.fromEntries(
      baseline.slots.map(({ slot, promptContents }) => [slot, promptContents]),
    ) as AiPromptContents;
    expect(() =>
      composePromptSet(entry, promptContents, snapshot),
    ).not.toThrow();
    snapshot.planner = `${snapshot.planner} tampered`;
    expect(() => composePromptSet(entry, promptContents, snapshot)).toThrow(
      "locked core snapshot",
    );
  });

  it("does not accept an unregistered feature", () => {
    expect(() => aiFeaturePromptCatalog.require("future-feature")).toThrow(
      "AI prompt feature is not registered",
    );
  });
});
