import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import type {
  CitationRepairInput,
  EmbeddedDocument,
  EmbeddingDocument,
  EmbeddingPort,
  EmbeddingVector,
  GroundedAnswer,
  GroundedAnswerInput,
  PlannerInput,
  PlannerRepairInput,
  ReportLanguageModelPort,
} from "./report-assistant.ports.js";

type DeterministicLanguageModelOptions = Readonly<{
  plan?: unknown;
  repairedPlan?: unknown;
  answer?: GroundedAnswer;
  repairedAnswer?: GroundedAnswer;
  failure?: Error;
}>;

const response = <T>(
  operation: string,
  value: T | undefined,
  failure: Error | undefined,
): Promise<T> => {
  if (failure) return Promise.reject(failure);
  return value === undefined
    ? Promise.reject(
        new Error(`Missing deterministic response for ${operation}`),
      )
    : Promise.resolve(value);
};

class DeterministicReportLanguageModel implements ReportLanguageModelPort {
  constructor(private readonly options: DeterministicLanguageModelOptions) {}

  plan(_input: PlannerInput): Promise<unknown> {
    return response("plan", this.options.plan, this.options.failure);
  }

  repairPlan(_input: PlannerRepairInput): Promise<unknown> {
    return response(
      "repairPlan",
      this.options.repairedPlan,
      this.options.failure,
    );
  }

  answer(_input: GroundedAnswerInput): Promise<GroundedAnswer> {
    return response("answer", this.options.answer, this.options.failure);
  }

  repairAnswer(_input: CitationRepairInput): Promise<GroundedAnswer> {
    return response(
      "repairAnswer",
      this.options.repairedAnswer,
      this.options.failure,
    );
  }
}

const HASH_BYTE_COUNT = 32;
const BYTE_SCALE = 127.5;

const reproducibleVector = (
  text: string,
  dimensions: number,
): EmbeddingVector => {
  const digest = createHash("sha256").update(text, "utf8").digest();
  return Array.from({ length: dimensions }, (_, index) => {
    const byte = digest[index % HASH_BYTE_COUNT] ?? 0;
    return byte / BYTE_SCALE - 1;
  });
};

class DeterministicEmbeddingPort implements EmbeddingPort {
  constructor(private readonly dimensions: number) {
    if (!Number.isInteger(dimensions) || dimensions < 1) {
      throw new Error("Deterministic embedding dimensions must be positive");
    }
  }

  embedQuery(text: string): Promise<EmbeddingVector> {
    return Promise.resolve(reproducibleVector(text, this.dimensions));
  }

  embedDocuments(
    documents: readonly EmbeddingDocument[],
  ): Promise<readonly EmbeddedDocument[]> {
    return Promise.resolve(
      documents.map(({ contentHash, text }) => ({
        contentHash,
        vector: reproducibleVector(text, this.dimensions),
      })),
    );
  }
}

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
