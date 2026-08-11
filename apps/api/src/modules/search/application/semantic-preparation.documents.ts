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
  left.provider === right.provider &&
  left.model === right.model &&
  left.inputVersion === right.inputVersion &&
  left.dimensions === right.dimensions;

const locatorFor = (
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
  return [
    ...documents
      .reduce<ReadonlyMap<string, PreparationDocument>>(
        (current, document) =>
          current.has(document.input.contentHash)
            ? current
            : new Map(current).set(document.input.contentHash, document),
        new Map<string, PreparationDocument>(),
      )
      .values(),
  ];
};

export const chunks = <T>(
  values: readonly T[],
  size: number,
): readonly (readonly T[])[] =>
  values.reduce<readonly (readonly T[])[]>(
    (result, value, index) =>
      index % size === 0
        ? [...result, [value]]
        : [...result.slice(0, -1), [...(result.at(-1) ?? []), value]],
    [],
  );

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
