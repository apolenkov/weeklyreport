import type { AuthorReportSectionReadModel } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { makeReportSectionFixture } from "../../../test-utils/report-section-fixtures";
import {
  finishedSectionOf,
  formSectionOf,
  withFormSection,
  withSlideSections,
} from "./form-section";

const PRODUCT = "11111111-1111-4111-8111-111111111111";

const risk = (
  stableId: string,
  impact: string | null,
  mitigation: string | null,
) => ({
  id: stableId,
  stableId,
  projectId: PRODUCT,
  activityId: null,
  risk: "Vendor may slip",
  impact,
  mitigation,
  severity: "at-risk" as const,
  stageNames: [],
});

const decision = (stableId: string, impact: string | null) => ({
  id: stableId,
  stableId,
  productId: PRODUCT,
  activityId: null,
  text: "Choose a vendor",
  owner: "Test Lead",
  impact,
  deadline: null,
  resolvedAt: null,
  stageNames: [],
});

const FINISHED_RISK = "55555555-5555-4555-8555-555555555551";
const UNFINISHED_RISK = "55555555-5555-4555-8555-555555555552";
const FINISHED_DECISION = "66666666-6666-4666-8666-666666666661";
const UNFINISHED_DECISION = "66666666-6666-4666-8666-666666666662";

// What the author's own read returns: unfinished records carry null details.
const authorSection: AuthorReportSectionReadModel = {
  ...makeReportSectionFixture(),
  risks: [
    risk(FINISHED_RISK, "Launch moves", "Second vendor"),
    risk(UNFINISHED_RISK, null, "Second vendor"),
  ],
  decisions: [
    decision(FINISHED_DECISION, "Budget grows"),
    decision(UNFINISHED_DECISION, null),
  ],
};

describe("formSectionOf", () => {
  it("shows a missing detail as an empty field and keeps every record", () => {
    const section = formSectionOf(authorSection);

    expect(section.risks.map((row) => [row.stableId, row.impact])).toEqual([
      [FINISHED_RISK, "Launch moves"],
      [UNFINISHED_RISK, ""],
    ]);
    expect(section.risks[1]?.mitigation).toBe("Second vendor");
    expect(section.decisions.map((row) => row.impact)).toEqual([
      "Budget grows",
      "",
    ]);
  });
});

describe("finishedSectionOf", () => {
  it("leaves out unfinished risks and decisions", () => {
    const section = finishedSectionOf(authorSection);

    expect(section.risks.map((row) => row.stableId)).toEqual([FINISHED_RISK]);
    expect(section.decisions.map((row) => row.stableId)).toEqual([
      FINISHED_DECISION,
    ]);
  });
});

describe("by-period read converters", () => {
  const read = { section: authorSection, readOnly: false };

  it("gives the form every record and keeps the rest of the read", () => {
    const converted = withFormSection(read);

    expect(converted.readOnly).toBe(false);
    expect(converted.section.risks).toHaveLength(2);
  });

  it("gives slides finished records and the editor the whole section", () => {
    const converted = withSlideSections(read);

    expect(converted.section.risks).toHaveLength(1);
    expect(converted.section.decisions).toHaveLength(1);
    expect(converted.editableSection.risks).toHaveLength(2);
    expect(converted.editableSection.decisions).toHaveLength(2);
  });
});
