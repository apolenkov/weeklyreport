import { describe, expect, it } from "vitest";

import {
  validateCitationIds,
  validateGroundedAnswerCitations,
} from "./citation-validator.js";
import type { GroundingBundle } from "./context-builder.js";

const bundle = {
  aggregates: {
    totalCount: 0,
    byKind: [],
    byPeriod: [],
    byAuthor: [],
    groups: [],
    supportingStatusFacts: [],
  },
  evidence: [
    {
      source: {
        sourceId: "S1",
        reportId: "22222222-2222-4222-8222-222222222222",
        periodLabel: "Week 31",
        authorName: "Lead",
        subjectName: "Portal",
        recordKind: "item",
      },
      candidate: {},
      role: "primary",
      estimatedTokens: 1,
    },
    {
      source: {
        sourceId: "S2",
        reportId: "22222222-2222-4222-8222-222222222222",
        periodLabel: "Week 30",
        authorName: "Lead",
        subjectName: "Portal",
        recordKind: "risk",
      },
      candidate: {},
      role: "primary",
      estimatedTokens: 1,
    },
  ],
  truncated: false,
  estimatedTokens: 2,
} as unknown as GroundingBundle;

const answer = (
  answerMarkdown: string,
  sourceIds: readonly string[],
  insufficientEvidence = false,
) => ({
  answerMarkdown,
  sourceIds,
  insufficientEvidence,
  usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
});

describe("grounded answer citation validation", () => {
  it("accepts only unique declared IDs matching inline first-use order", () => {
    expect(
      validateGroundedAnswerCitations(
        answer("Facts [S2][S1]", ["S2", "S1"]),
        bundle,
      ),
    ).toMatchObject({
      kind: "valid",
      citations: [{ sourceId: "S2" }, { sourceId: "S1" }],
    });
  });

  it("rejects unknown, duplicate, and mismatched citations for repair", () => {
    expect(
      validateGroundedAnswerCitations(answer("Facts [S9]", ["S9"]), bundle),
    ).toEqual({ kind: "invalid", issues: ["unknown_source"] });
    expect(
      validateGroundedAnswerCitations(
        answer("Facts [S1]", ["S1", "S1"]),
        bundle,
      ),
    ).toEqual({ kind: "invalid", issues: ["citation_order_invalid"] });
    expect(
      validateGroundedAnswerCitations(answer("Facts [S1]", ["S2"]), bundle),
    ).toEqual({ kind: "invalid", issues: ["citation_order_invalid"] });
  });

  it("rejects a confident answer without citations", () => {
    expect(
      validateGroundedAnswerCitations(
        answer("Unsupported confidence", []),
        bundle,
      ),
    ).toEqual({ kind: "invalid", issues: ["missing_citation"] });
  });

  it("allows an insufficient-evidence answer without citations", () => {
    expect(
      validateGroundedAnswerCitations(
        answer("Insufficient evidence", [], true),
        bundle,
      ),
    ).toEqual({ kind: "valid", citations: [] });
  });

  it("keeps the existing source-ID validator behavior", () => {
    expect(validateCitationIds(["S1", "S9"], bundle)).toEqual({
      kind: "invalid",
      unknownSourceIds: ["S9"],
    });
  });
});
