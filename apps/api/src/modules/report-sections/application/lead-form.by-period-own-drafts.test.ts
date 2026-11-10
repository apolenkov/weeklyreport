// The author's own form carries their unfinished risks and decisions; every
// other read of the same section stays complete (openspec:
// lead-retained-incomplete-records, "Private draft entitlement is consistent
// across own reads").
import type { AuthorReportSectionReadModel } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import {
  AUTHOR_ID,
  createMockRepository,
  draftSection,
  forPeriod,
  HEAD_GROUP_ID,
  OTHER_USER_ID,
  PROJECT_ID,
  REPORT_ID,
} from "./__tests__/lead-form-contract-harness.js";
import { LeadFormService } from "./lead-form.service";
import { NOOP_REPORT_SECTIONS_TELEMETRY } from "./report-sections-telemetry.port.js";

const UNFINISHED_RISK_ID = "99999999-9999-4999-8999-999999999991";

// The live section as its entitled author reads it: one risk misses details.
const ownDrafts: AuthorReportSectionReadModel = {
  ...structuredClone(draftSection),
  risks: [
    ...draftSection.risks,
    {
      id: UNFINISHED_RISK_ID,
      stableId: UNFINISHED_RISK_ID,
      projectId: PROJECT_ID,
      activityId: null,
      risk: "Vendor may slip",
      impact: null,
      mitigation: null,
      severity: "at-risk",
      stageNames: ["Development"],
    },
  ],
};

function setup(
  facts: Parameters<typeof forPeriod>[2] = {},
  drafts: AuthorReportSectionReadModel | null = ownDrafts,
) {
  const read = (_reportId: string, authorId: string) =>
    forPeriod({ ...structuredClone(draftSection), authorId }, false, facts);
  const getOwnDraftSection = vi.fn().mockResolvedValue(drafts);
  const repo = createMockRepository({
    getSectionForPeriod: vi.fn().mockImplementation(read),
    getSectionForPeriodAsGroupPeer: vi.fn().mockImplementation(read),
    getUserReportingGroupId: vi.fn().mockResolvedValue(HEAD_GROUP_ID),
    getOwnDraftSection,
  });
  return {
    service: new LeadFormService(repo, NOOP_REPORT_SECTIONS_TELEMETRY),
    getOwnDraftSection,
  };
}

const riskIds = (section: AuthorReportSectionReadModel) =>
  section.risks.map((risk) => risk.id);

describe("LeadFormService — getByPeriod own unfinished drafts", () => {
  it("gives the entitled author their unfinished records", async () => {
    const { service, getOwnDraftSection } = setup();

    const result = await service.getByPeriod(REPORT_ID, AUTHOR_ID, "lead");

    expect(getOwnDraftSection).toHaveBeenCalledWith(REPORT_ID, AUTHOR_ID);
    expect(riskIds(result.section)).toContain(UNFINISHED_RISK_ID);
  });

  it("keeps the complete read for an author who lost the entitlement", async () => {
    const { service } = setup({}, null);

    const result = await service.getByPeriod(REPORT_ID, AUTHOR_ID, "viewer");

    expect(riskIds(result.section)).toEqual(riskIds(draftSection));
  });

  it("reads a published period from its snapshot without asking for drafts", async () => {
    const { service, getOwnDraftSection } = setup({
      periodStatus: "published",
    });

    const result = await service.getByPeriod(REPORT_ID, AUTHOR_ID, "lead");

    expect(getOwnDraftSection).not.toHaveBeenCalled();
    expect(riskIds(result.section)).not.toContain(UNFINISHED_RISK_ID);
  });

  it("never asks for drafts when a head reads another author's section", async () => {
    const { service, getOwnDraftSection } = setup();

    const result = await service.getByPeriod(
      REPORT_ID,
      AUTHOR_ID,
      "head",
      OTHER_USER_ID,
    );

    expect(getOwnDraftSection).not.toHaveBeenCalled();
    expect(riskIds(result.section)).not.toContain(UNFINISHED_RISK_ID);
  });
});
