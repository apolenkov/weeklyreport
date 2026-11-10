import { describe, expect, it } from "vitest";

import { makeReportSectionFixture } from "../../../test-utils/report-section-fixtures";
import { sectionToDraftPayload } from "./lead-section-draft-payload";
import {
  buildLeadSubmitPayload,
  unfinishedDraftRecords,
} from "./lead-submit-payload";

const PRODUCT = "11111111-1111-4111-8111-111111111111";
const RISK = "55555555-5555-4555-8555-555555555555";
const DECISION = "66666666-6666-4666-8666-666666666666";

function draftWith(riskImpact: string, decisionImpact: string) {
  return sectionToDraftPayload(
    makeReportSectionFixture({
      authorName: "Test Lead",
      risks: [
        {
          id: RISK,
          stableId: RISK,
          projectId: PRODUCT,
          activityId: null,
          risk: "Vendor may slip",
          impact: riskImpact,
          mitigation: "Second vendor",
          severity: "at-risk",
          stageNames: [],
        },
      ],
      decisions: [
        {
          id: DECISION,
          stableId: DECISION,
          productId: PRODUCT,
          activityId: null,
          text: "Choose a vendor",
          owner: "Test Lead",
          impact: decisionImpact,
          deadline: null,
          resolvedAt: null,
          stageNames: [],
        },
      ],
    }),
  );
}

describe("unfinishedDraftRecords", () => {
  it("names every saved risk and decision that still misses a detail", () => {
    expect(unfinishedDraftRecords(draftWith("", ""))).toEqual([
      {
        kind: "risk",
        key: RISK,
        label:
          'Finish the risk "Vendor may slip": add its impact and mitigation.',
      },
      {
        kind: "decision",
        key: DECISION,
        label: 'Finish the decision "Choose a vendor": add its impact.',
      },
    ]);
  });

  it("is empty once every detail is written", () => {
    expect(unfinishedDraftRecords(draftWith("Launch moves", "Budget"))).toEqual(
      [],
    );
  });
});

describe("buildLeadSubmitPayload", () => {
  it("submits finished records with their details as text", () => {
    const payload = buildLeadSubmitPayload(
      draftWith("Launch moves", "Budget"),
      4,
    );

    expect(payload.version).toBe(4);
    expect(payload.confirmed).toBe(true);
    expect(payload.risks.map((row) => row.impact)).toEqual(["Launch moves"]);
    expect(payload.decisions.map((row) => row.impact)).toEqual(["Budget"]);
  });

  it("never carries an unfinished record into a submission", () => {
    const payload = buildLeadSubmitPayload(draftWith("", ""), 4);

    expect(payload.risks).toEqual([]);
    expect(payload.decisions).toEqual([]);
  });
});
