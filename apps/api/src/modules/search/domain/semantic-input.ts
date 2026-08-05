import { createHash } from "node:crypto";

import type {
  ActivityStatusCandidate,
  DecisionCandidate,
  ItemCandidate,
  RiskCandidate,
  SearchCandidate,
} from "./report-retrieval.types.js";

export type SemanticCandidateKind =
  "item" | "risk" | "decision" | "activity_status";

export type SemanticInput = Readonly<{
  contentHash: string;
  inputVersion: string;
  kind: SemanticCandidateKind;
  text: string;
}>;

const nonEmpty = (value: string): string | null => {
  const canonical = value.normalize("NFKC").replaceAll(/\s+/gu, " ").trim();
  return canonical.length > 0 ? canonical : null;
};

const canonicalText = (segments: readonly string[]): string | null => {
  const values = segments.map(nonEmpty);
  return values.some((value) => value !== null)
    ? values.map((value) => value ?? "").join("\n")
    : null;
};

const itemText = (candidate: ItemCandidate): string | null =>
  canonicalText([candidate.text]);

const riskText = (candidate: RiskCandidate): string | null =>
  canonicalText([candidate.risk, candidate.impact, candidate.mitigation]);

const decisionText = (candidate: DecisionCandidate): string | null =>
  canonicalText([candidate.text, candidate.impact]);

const activityText = (candidate: ActivityStatusCandidate): string | null =>
  candidate.note === null || nonEmpty(candidate.note) === null
    ? null
    : canonicalText([candidate.context.subject.name, candidate.note]);

const semanticText = (
  candidate: SearchCandidate,
): Readonly<{ kind: SemanticCandidateKind; text: string }> | null => {
  if (candidate.kind === "item") {
    const text = itemText(candidate);
    return text === null ? null : { kind: candidate.kind, text };
  }
  if (candidate.kind === "risk") {
    const text = riskText(candidate);
    return text === null ? null : { kind: candidate.kind, text };
  }
  if (candidate.kind === "decision") {
    const text = decisionText(candidate);
    return text === null ? null : { kind: candidate.kind, text };
  }
  if (candidate.kind === "activity_status") {
    const text = activityText(candidate);
    return text === null ? null : { kind: candidate.kind, text };
  }
  return null;
};

const hashSemanticText = (
  inputVersion: string,
  kind: string,
  text: string,
): string =>
  createHash("sha256")
    .update([inputVersion, kind, text].join("\n"), "utf8")
    .digest("hex");

export const buildSemanticInput = (
  candidate: SearchCandidate,
  inputVersion: string,
): SemanticInput | null => {
  const version = nonEmpty(inputVersion);
  const semantic = semanticText(candidate);
  if (version === null || semantic === null) return null;
  return {
    contentHash: hashSemanticText(version, semantic.kind, semantic.text),
    inputVersion: version,
    kind: semantic.kind,
    text: semantic.text,
  };
};
