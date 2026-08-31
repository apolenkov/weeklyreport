import { describe, expect, it } from "vitest";

import {
  DeterministicEmbeddingPort,
  DeterministicReportLanguageModel,
} from "./report-assistant.fakes.js";

const answer = {
  answerMarkdown: "The answer is grounded.",
  sourceIds: ["S1"],
  insufficientEvidence: false,
  usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
} as const;

const plannerInput = {
  question: "What changed?",
  now: new Date("2026-08-04T12:00:00.000Z"),
  timeZone: "UTC",
} as const;

const grounding = {
  aggregates: {
    totalCount: 0,
    byKind: [],
    byPeriod: [],
    byAuthor: [],
    groups: [],
    supportingStatusFacts: [],
  },
  evidence: [],
  truncated: false,
  estimatedTokens: 0,
} as const;

describe("report assistant deterministic adapters", () => {
  it("returns separate planner and answer repair responses", async () => {
    const model = new DeterministicReportLanguageModel({
      plan: { phase: "initial" },
      repairedPlan: { phase: "repaired" },
      answer,
      repairedAnswer: { ...answer, answerMarkdown: "The repaired answer." },
    });

    await expect(model.plan(plannerInput)).resolves.toEqual({
      phase: "initial",
    });
    await expect(
      model.repairPlan({
        original: plannerInput,
        previousArguments: { phase: "invalid" },
        issues: [{ path: ["retrieval"], code: "custom" }],
      }),
    ).resolves.toEqual({ phase: "repaired" });
    await expect(
      model.answer({ question: plannerInput.question, grounding }),
    ).resolves.toEqual(answer);
    await expect(
      model.repairAnswer({
        original: { question: plannerInput.question, grounding },
        previousAnswer: answer,
        allowedSourceIds: ["S1"],
        issues: ["unknown_source"],
      }),
    ).resolves.toMatchObject({ answerMarkdown: "The repaired answer." });
  });

  it("reproduces provider failures without contacting a provider", async () => {
    const failure = new Error("provider unavailable");
    const model = new DeterministicReportLanguageModel({ failure });

    await expect(model.plan(plannerInput)).rejects.toBe(failure);
    await expect(
      model.answer({ question: plannerInput.question, grounding }),
    ).rejects.toBe(failure);
  });

  it("returns reproducible vectors for queries and documents", async () => {
    const embeddings = new DeterministicEmbeddingPort(8);
    const first = await embeddings.embedQuery("release blocker");
    const second = await embeddings.embedQuery("release blocker");
    const different = await embeddings.embedQuery("resolved decision");
    const documents = await embeddings.embedDocuments([
      { contentHash: "hash-1", text: "release blocker" },
    ]);

    expect(first).toEqual(second);
    expect(first).not.toEqual(different);
    expect(first).toHaveLength(8);
    expect(documents).toEqual([{ contentHash: "hash-1", vector: first }]);
  });
});
