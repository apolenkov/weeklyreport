import { describe, expect, it } from "vitest";

import {
  AI_PROMPT_CORE_LIMIT,
  AI_PROMPT_EDITABLE_TAIL_SEPARATOR,
  AI_PROMPT_EFFECTIVE_PROMPT_LIMIT,
  AI_PROMPT_SLOT_CONTENT_LIMIT,
  AI_PROMPT_SLOT_KEYS,
  aiFeatureKeySchema,
  aiPromptBundleReadSchema,
  aiPromptContentsSchema,
  aiPromptDraftInputSchema,
  aiPromptRevisionInputSchema,
  aiPromptSlotReadSchema,
} from "./ai-prompt-management";

const id = "659b2767-0f86-41e2-b025-49730ca010e4";
const hash = "a".repeat(64);
const promptContents = {
  planner: "Plan the request.",
  "planner-repair": "Repair the plan.",
  "grounded-answer": "Answer from evidence.",
  "citation-repair": "Repair citations.",
};

const validBundleRead = () => ({
  id,
  featureKey: "lead-report-assistant",
  revision: 1,
  baseRevisionId: null,
  coreContractVersion: "report-assistant/v1",
  composerVersion: "composer/v1",
  servingContractVersion: "report-assistant/editor-serving/v1",
  servingStatus: "current",
  lockedCoreSnapshot: {
    planner: "Planner contract.",
    "planner-repair": "Planner repair contract.",
    "grounded-answer": "Grounded answer contract.",
    "citation-repair": "Citation repair contract.",
  },
  promptContents,
  slots: AI_PROMPT_SLOT_KEYS.map((slot) => ({
    slot,
    lockedCore: "Core contract.",
    promptContents: promptContents[slot],
    effectivePrompt: `Core contract.\n${promptContents[slot]}`,
  })),
  effectiveContentHash: hash,
  lifecycle: "active",
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
  activatedAt: "2026-08-10T00:00:00.000Z",
  supersededAt: null,
});

describe("AI prompt management contracts", () => {
  it("accepts only registered feature keys", () => {
    expect(aiFeatureKeySchema.safeParse("lead-report-assistant").success).toBe(
      true,
    );
    expect(aiFeatureKeySchema.safeParse("future-feature").success).toBe(false);
  });

  it("rejects unknown fields and locked/catalog-owned draft writes", () => {
    expect(
      aiPromptDraftInputSchema.safeParse({
        featureKey: "lead-report-assistant",
        baseRevisionId: id,
        promptContents,
        lifecycle: "draft",
      }).success,
    ).toBe(false);
    expect(
      aiPromptDraftInputSchema.safeParse({
        featureKey: "lead-report-assistant",
        baseRevisionId: id,
        promptContents,
        lockedCore: "replace the protocol",
      }).success,
    ).toBe(false);
  });

  it("keeps serving identity catalog-owned", () => {
    expect(
      aiPromptDraftInputSchema.safeParse({
        featureKey: "lead-report-assistant",
        baseRevisionId: id,
        promptContents,
        servingContractVersion: "report-assistant/editor-serving/v1",
      }).success,
    ).toBe(false);
  });

  it("requires every slot and enforces safe text limits", () => {
    expect(
      aiPromptContentsSchema.safeParse({
        ...promptContents,
        "citation-repair": undefined,
      }).success,
    ).toBe(false);
    expect(
      aiPromptContentsSchema.safeParse({
        ...promptContents,
        planner: `ok\u0000`,
      }).success,
    ).toBe(false);
    expect(
      aiPromptContentsSchema.safeParse({
        ...promptContents,
        planner: "x".repeat(12_001),
      }).success,
    ).toBe(false);
  });

  it("accepts lifecycle-shaped revision inputs without adding defaults", () => {
    expect(
      aiPromptRevisionInputSchema.safeParse({
        featureKey: "lead-report-assistant",
        revisionId: id,
      }).success,
    ).toBe(true);
    expect(
      aiPromptRevisionInputSchema.safeParse({
        featureKey: "lead-report-assistant",
      }).success,
    ).toBe(false);
  });

  it("pins the shared composition separator bytes", () => {
    expect(AI_PROMPT_EDITABLE_TAIL_SEPARATOR).toBe(
      "\n\nOperator guidance (editable tail):\n",
    );
  });

  it("accepts a composed slot at the derived effective-prompt boundary", () => {
    const lockedCore = "c".repeat(AI_PROMPT_CORE_LIMIT);
    const promptText = "e".repeat(AI_PROMPT_SLOT_CONTENT_LIMIT);
    const effectivePrompt = `${lockedCore}${AI_PROMPT_EDITABLE_TAIL_SEPARATOR}${promptText}`;
    expect(effectivePrompt).toHaveLength(AI_PROMPT_EFFECTIVE_PROMPT_LIMIT);
    const boundarySlot = {
      slot: "planner",
      lockedCore,
      promptContents: promptText,
      effectivePrompt,
    };
    expect(aiPromptSlotReadSchema.safeParse(boundarySlot).success).toBe(true);
    const baseline = validBundleRead();
    expect(
      aiPromptBundleReadSchema.safeParse({
        ...baseline,
        slots: [boundarySlot, ...baseline.slots.slice(1)],
      }).success,
    ).toBe(true);
  });

  it("rejects an effective prompt beyond the derived boundary", () => {
    expect(
      aiPromptSlotReadSchema.safeParse({
        slot: "planner",
        lockedCore: "c".repeat(AI_PROMPT_CORE_LIMIT),
        promptContents: "e".repeat(AI_PROMPT_SLOT_CONTENT_LIMIT),
        effectivePrompt: "x".repeat(AI_PROMPT_EFFECTIVE_PROMPT_LIMIT + 1),
      }).success,
    ).toBe(false);
  });

  it("rejects incomplete bundle slot reads", () => {
    const baseline = validBundleRead();
    expect(aiPromptBundleReadSchema.safeParse(baseline).success).toBe(true);

    const result = aiPromptBundleReadSchema.safeParse({
      ...baseline,
      slots: baseline.slots.slice(0, -1),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: ["slots"] }),
      );
    }
  });
});
