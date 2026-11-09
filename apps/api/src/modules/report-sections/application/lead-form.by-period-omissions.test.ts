// How many unfinished risks and decisions a reader is told another author's
// section leaves out (openspec: lead-form-cross-author-scope). The number
// follows the reader's lens and never carries a draft's text or identity.
import type { RecordOmission } from "@weeklyreport/shared";
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

const UNSHARED_PROJECT_ID = "44444444-4444-4444-8444-555555555555";
const ACTIVITY_ID = "88888888-8888-4888-8888-888888888881";

// Two unfinished risks on the shared Product, one unfinished decision on the
// author's own Product and one unfinished risk on an Activity.
const OMISSION: RecordOmission = {
  version: 1,
  buckets: [
    {
      kind: "risk",
      parentKind: "product",
      parentId: PROJECT_ID,
      stageNames: ["Development"],
      count: 2,
    },
    {
      kind: "decision",
      parentKind: "product",
      parentId: UNSHARED_PROJECT_ID,
      stageNames: ["Development"],
      count: 1,
    },
    {
      kind: "risk",
      parentKind: "activity",
      parentId: ACTIVITY_ID,
      stageNames: [],
      count: 1,
    },
  ],
};

function foreignRead(recordOmission?: RecordOmission) {
  const section = {
    ...structuredClone(draftSection),
    authorId: OTHER_USER_ID,
    authorName: "Lead 2",
  };
  return { ...forPeriod(section, false), recordOmission };
}

function serviceFor(recordOmission?: RecordOmission) {
  const read = (_reportId: string, authorId: string) =>
    authorId === OTHER_USER_ID
      ? foreignRead(recordOmission)
      : { ...forPeriod(structuredClone(draftSection), false), recordOmission };
  const repo = createMockRepository({
    getSectionForPeriod: vi.fn().mockImplementation(read),
    getSectionForPeriodAsGroupPeer: vi.fn().mockImplementation(read),
    getSharedNonArchivedProductIds: vi.fn().mockResolvedValue([PROJECT_ID]),
    getUserReportingGroupId: vi.fn().mockResolvedValue(HEAD_GROUP_ID),
  });
  return new LeadFormService(repo, NOOP_REPORT_SECTIONS_TELEMETRY);
}

describe("LeadFormService — getByPeriod omitted-record counts", () => {
  it("tells a head the whole section's count, apart from its content", async () => {
    const result = await serviceFor(OMISSION).getByPeriod(
      REPORT_ID,
      AUTHOR_ID,
      "head",
      OTHER_USER_ID,
    );

    expect(result.recordOmissions).toEqual({
      risks: 3,
      decisions: 1,
      unknown: false,
    });
    // Totals only: no bucket, parent or stage key travels with the read.
    expect(JSON.stringify(result)).not.toContain(ACTIVITY_ID);
    expect(result.section).not.toHaveProperty("recordOmission");
  });

  it("tells a co-owner only the shared Product's count", async () => {
    const result = await serviceFor(OMISSION).getByPeriod(
      REPORT_ID,
      AUTHOR_ID,
      "lead",
      OTHER_USER_ID,
    );

    // The author's other Product and the Activity add nothing to the total.
    expect(result.recordOmissions).toEqual({
      risks: 2,
      decisions: 0,
      unknown: false,
    });
    expect(JSON.stringify(result)).not.toContain(UNSHARED_PROJECT_ID);
  });

  it("answers unknown, never zero, for a section frozen before counts existed", async () => {
    const result = await serviceFor().getByPeriod(
      REPORT_ID,
      AUTHOR_ID,
      "head",
      OTHER_USER_ID,
    );

    expect(result.recordOmissions).toEqual({
      risks: 0,
      decisions: 0,
      unknown: true,
    });
  });

  it("adds no count to the author's own form", async () => {
    const result = await serviceFor(OMISSION).getByPeriod(REPORT_ID, AUTHOR_ID);

    expect(result).not.toHaveProperty("recordOmissions");
  });
});
