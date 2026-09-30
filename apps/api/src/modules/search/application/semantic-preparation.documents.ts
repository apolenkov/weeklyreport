import { projectSectionCandidates } from "../domain/candidate-projector.js";
import type {
  ReportOccurrence,
  SearchCandidate,
} from "../domain/report-retrieval.types.js";
import {
  buildSemanticInput,
  type SemanticInput,
} from "../domain/semantic-input.js";
import type { SemanticEmbeddingScope } from "./semantic-embedding.repository.js";
import type { SemanticIndexLocator } from "./semantic-index.source-loader.js";

export type PreparationDocument = Readonly<{
  input: SemanticInput;
  locator: SemanticIndexLocator;
}>;

export const sameScope = (
  left: SemanticEmbeddingScope,
  right: SemanticEmbeddingScope,
): boolean =>
  left.embeddingScopeIdentity === right.embeddingScopeIdentity &&
  left.provider === right.provider &&
  left.model === right.model &&
  left.inputVersion === right.inputVersion &&
  left.dimensions === right.dimensions;

export const locatorFor = (
  candidate: SearchCandidate,
  input: SemanticInput,
): SemanticIndexLocator => ({
  source: candidate.context.source,
  reportId: candidate.context.reportId,
  sectionId: candidate.context.sectionId,
  occurrenceId: candidate.identity.occurrenceId,
  recordKind: input.kind,
  recordId: candidate.identity.recordId,
  expectedContentHash: input.contentHash,
});

export const semanticDocuments = (
  occurrences: readonly ReportOccurrence[],
  inputVersion: string,
): readonly PreparationDocument[] => {
  const documents = occurrences.flatMap((occurrence) =>
    occurrence.sections.flatMap((section) => {
      const scope = {
        reportId: occurrence.reportId,
        sectionId: section.reportSectionId,
        authorId: section.authorId,
        visibility: "own" as const,
        section,
      };
      return projectSectionCandidates(occurrence, scope).flatMap(
        (candidate) => {
          const input = buildSemanticInput(candidate, inputVersion);
          return input === null
            ? []
            : [{ input, locator: locatorFor(candidate, input) }];
        },
      );
    }),
  );
  const uniqueDocuments = new Map<string, PreparationDocument>();
  for (const document of documents) {
    if (!uniqueDocuments.has(document.input.contentHash)) {
      uniqueDocuments.set(document.input.contentHash, document);
    }
  }
  return Array.from(uniqueDocuments.values());
};

export const chunks = <T>(
  values: readonly T[],
  size: number,
): readonly (readonly T[])[] => {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error("Chunk size must be a positive integer");
  }
  const result: T[][] = [];
  for (const value of values) {
    const current = result.at(-1);
    if (current === undefined || current.length === size) {
      result.push([value]);
    } else {
      current.push(value);
    }
  }
  return result;
};

export const mapWithConcurrency = async <T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<readonly R[]> => {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("Concurrency must be a positive integer");
  }
  const results = Array<R>(values.length);
  // Workers share this cursor to claim each input exactly once.
  // eslint-disable-next-line no-restricted-syntax -- shared worker cursor is load-bearing
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index] as T);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, worker),
  );
  return results;
};

export const completeBatch = (
  expected: readonly PreparationDocument[],
  actual: readonly { contentHash: string; vector: readonly number[] }[],
): boolean => {
  const expectedHashes = new Set(
    expected.map(({ input }) => input.contentHash),
  );
  const actualHashes = new Set(actual.map(({ contentHash }) => contentHash));
  return (
    expectedHashes.size === actualHashes.size &&
    expectedHashes.size === actual.length &&
    [...expectedHashes].every((hash) => actualHashes.has(hash))
  );
};

export const reconcile = (
  left: readonly PreparationDocument[],
  right: readonly PreparationDocument[],
): boolean => {
  const leftHashes = new Set(left.map(({ input }) => input.contentHash));
  const rightHashes = new Set(right.map(({ input }) => input.contentHash));
  return (
    leftHashes.size === rightHashes.size &&
    [...leftHashes].every((hash) => rightHashes.has(hash))
  );
};
