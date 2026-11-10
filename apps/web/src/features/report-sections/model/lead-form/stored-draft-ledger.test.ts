import type { AuthorReportSectionReadModel } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { makeReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
import {
  deletionIntentsFor,
  storedIncompleteRecords,
} from "./stored-draft-ledger";

const PRODUCT = "11111111-1111-4111-8111-111111111111";
const FINISHED_RISK = "55555555-5555-4555-8555-555555555551";
const UNFINISHED_RISK = "55555555-5555-4555-8555-555555555552";
const UNFINISHED_DECISION = "66666666-6666-4666-8666-666666666662";

const risk = (stableId: string, impact: string | null) => ({
  id: stableId,
  stableId,
  projectId: PRODUCT,
  activityId: null,
  risk: "Vendor may slip",
  impact,
  mitigation: "Second vendor",
  severity: "at-risk" as const,
  stageNames: [],
});

const stored: AuthorReportSectionReadModel = {
  ...makeReportSectionFixture(),
  risks: [risk(FINISHED_RISK, "Launch moves"), risk(UNFINISHED_RISK, null)],
  decisions: [
    {
      id: UNFINISHED_DECISION,
      stableId: UNFINISHED_DECISION,
      productId: PRODUCT,
      activityId: null,
      text: "Choose a vendor",
      owner: "Test Lead",
      impact: null,
      deadline: null,
      resolvedAt: null,
      stageNames: [],
    },
  ],
};

describe("storedIncompleteRecords", () => {
  it("lists only the unfinished risks and decisions", () => {
    expect(storedIncompleteRecords(stored)).toEqual([
      { kind: "risk", stableId: UNFINISHED_RISK },
      { kind: "decision", stableId: UNFINISHED_DECISION },
    ]);
  });
});

describe("deletionIntentsFor", () => {
  const unfinished = storedIncompleteRecords(stored);

  it("names nothing while the save still carries every unfinished record", () => {
    expect(
      deletionIntentsFor(unfinished, {
        risks: [{ stableId: UNFINISHED_RISK }],
        decisions: [{ stableId: UNFINISHED_DECISION }],
      }),
    ).toEqual([]);
  });

  it("names the unfinished records the author removed from the form", () => {
    expect(
      deletionIntentsFor(unfinished, {
        risks: [{ stableId: FINISHED_RISK }],
        decisions: [{ stableId: UNFINISHED_DECISION }],
      }),
    ).toEqual([{ kind: "risk", stableId: UNFINISHED_RISK }]);
  });

  it("does not mistake a risk for a decision with the same identity", () => {
    expect(
      deletionIntentsFor(unfinished, {
        risks: [],
        decisions: [
          { stableId: UNFINISHED_RISK },
          { stableId: UNFINISHED_DECISION },
        ],
      }),
    ).toEqual([{ kind: "risk", stableId: UNFINISHED_RISK }]);
  });

  it("ignores rows that have no stored identity yet", () => {
    expect(deletionIntentsFor([], { risks: [{}], decisions: [{}] })).toEqual(
      [],
    );
  });
});
