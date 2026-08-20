import { describe, expect, it } from "vitest";

import {
  aiFeatureKeySchema,
  aiPromptBundleReadSchema,
  aiPromptContentsSchema,
  aiPromptDraftInputSchema,
  aiPromptRevisionInputSchema,
} from "./ai-prompt-management";

const id = "659b2767-0f86-41e2-b025-49730ca010e4";
const hash = "a".repeat(64);
const promptContents = {
  planner: "Plan the request.",
  "planner-repair": "Repair the plan.",
  "grounded-answer": "Answer from evidence.",
  "citation-repair": "Repair citations.",
};

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

  it("rejects incomplete bundle slot reads", () => {
    expect(
      aiPromptBundleReadSchema.safeParse({
        id,
        featureKey: "lead-report-assistant",
        revision: 1,
        baseRevisionId: null,
        coreContractVersion: "report-assistant/v1",
        composerVersion: "composer/v1",
        lockedCoreSnapshot: {},
        promptContents,
        slots: [],
        effectiveContentHash: hash,
        lifecycle: "active",
        createdAt: "2026-08-10T00:00:00.000Z",
        updatedAt: "2026-08-10T00:00:00.000Z",
        activatedAt: null,
        supersededAt: null,
      }).success,
    ).toBe(false);
  });
});
