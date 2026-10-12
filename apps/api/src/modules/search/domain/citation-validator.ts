import type { SourceCitation } from "@weeklyreport/shared";

import type { GroundedAnswer } from "../application/report-assistant.ports.js";
import type { GroundingBundle } from "./context-builder.js";
import { uniqueStrings } from "./entity-resolver.catalog.js";

export type CitationValidationResult =
  | Readonly<{ kind: "valid"; citations: readonly SourceCitation[] }>
  | Readonly<{ kind: "invalid"; unknownSourceIds: readonly string[] }>;

export type GroundedAnswerCitationValidationResult =
  | Readonly<{ kind: "valid"; citations: readonly SourceCitation[] }>
  | Readonly<{ kind: "invalid"; issues: readonly string[] }>;

export function validateCitationIds(
  sourceIds: readonly string[],
  bundle: GroundingBundle,
): CitationValidationResult {
  const sources = new Map(
    bundle.evidence.map((evidence) => [
      evidence.source.sourceId,
      evidence.source,
    ]),
  );
  const unknownSourceIds = uniqueStrings(
    sourceIds.filter((sourceId) => !sources.has(sourceId)),
  );
  return unknownSourceIds.length > 0
    ? { kind: "invalid", unknownSourceIds }
    : {
        kind: "valid",
        citations: uniqueStrings(sourceIds).flatMap((sourceId) => {
          const citation = sources.get(sourceId);
          return citation ? [citation] : [];
        }),
      };
}

const inlineSourceIds = (answerMarkdown: string): readonly string[] =>
  [...answerMarkdown.matchAll(/\[(S\d+)\]/gu)].map((match) => match[1] ?? "");

const sameSequence = (
  left: readonly string[],
  right: readonly string[],
): boolean =>
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

export function validateGroundedAnswerCitations(
  answer: GroundedAnswer,
  bundle: GroundingBundle,
): GroundedAnswerCitationValidationResult {
  const declared = [...answer.sourceIds];
  const declaredUnique = uniqueStrings(declared);
  const inline = uniqueStrings(inlineSourceIds(answer.answerMarkdown));
  const idValidation = validateCitationIds(declared, bundle);
  const inlineValidation = validateCitationIds(inline, bundle);
  const issues = [
    ...(!answer.insufficientEvidence &&
    (declaredUnique.length === 0 || inline.length === 0)
      ? ["missing_citation"]
      : []),
    ...(idValidation.kind === "invalid" ? ["unknown_source"] : []),
    ...(inlineValidation.kind === "invalid" ? ["unknown_source"] : []),
    ...(declared.length !== declaredUnique.length ||
    !sameSequence(declaredUnique, inline)
      ? ["citation_order_invalid"]
      : []),
  ];
  return issues.length > 0
    ? { kind: "invalid", issues: uniqueStrings(issues) }
    : {
        kind: "valid",
        citations: idValidation.kind === "valid" ? idValidation.citations : [],
      };
}
