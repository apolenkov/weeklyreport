import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { persistCarriedRowsForSection } from "./carry-over-row-writes";

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_ID = "44444444-4444-4444-8444-444444444444";

function sectionWithCarriedItem(): ReportSectionReadModel {
  return {
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Lead",
    version: 1,
    status: "draft",
    submittedAt: null,
    projects: [],
    items: [
      {
        id: "55555555-5555-4555-8555-555555555555",
        stableId: undefined,
        projectId: PROJECT_ID,
        type: "current",
        text: "Carried item",
        tag: "feature",
        workflowStatus: "in_progress",
        carriedOver: true,
      },
    ],
    risks: [],
    decisions: [],
    activities: [],
  };
}

describe("persistCarriedRowsForSection", () => {
  it("fails before writing when a carried item has no stable lineage id", async () => {
    const createMany = vi.fn();
    const tx = {
      item: { createMany },
      decision: { findMany: vi.fn().mockResolvedValue([]) },
    };

    await expect(
      persistCarriedRowsForSection(tx as never, sectionWithCarriedItem()),
    ).rejects.toThrow(
      "Cannot persist a carried item without its stable lineage id.",
    );
    expect(createMany).not.toHaveBeenCalled();
  });
});
