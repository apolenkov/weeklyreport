import { createHash } from "node:crypto";

import type {
  CitationRepairInput,
  GroundedAnswer,
  GroundedAnswerInput,
  PlannerInput,
  PlannerRepairInput,
  ReportLanguageModelPort,
} from "./report-assistant.ports.js";
import type {
  EmbeddedDocument,
  EmbeddingDocument,
  EmbeddingPort,
  EmbeddingVector,
} from "./report-assistant.ports.js";

export type DeterministicLanguageModelOptions = Readonly<{
  plan?: unknown;
  repairedPlan?: unknown;
  answer?: GroundedAnswer;
  repairedAnswer?: GroundedAnswer;
  failure?: Error;
}>;

const missingResponse = (operation: string): Promise<never> =>
  Promise.reject(new Error(`Missing deterministic response for ${operation}`));

const response = <T>(
  operation: string,
  value: T | undefined,
  failure: Error | undefined,
): Promise<T> => {
  if (failure) return Promise.reject(failure);
  return value === undefined
    ? missingResponse(operation)
    : Promise.resolve(value);
};

export class DeterministicReportLanguageModel implements ReportLanguageModelPort {
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

const textDigest = (text: string): Uint8Array =>
  createHash("sha256").update(text, "utf8").digest();

const reproducibleVector = (
  text: string,
  dimensions: number,
): EmbeddingVector => {
  const digest = textDigest(text);
  return Array.from({ length: dimensions }, (_, index) => {
    const byte = digest[index % HASH_BYTE_COUNT] ?? 0;
    return byte / BYTE_SCALE - 1;
  });
};

export class DeterministicEmbeddingPort implements EmbeddingPort {
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
