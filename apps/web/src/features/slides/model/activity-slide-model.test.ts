import type { ActivityLiveRow } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { buildActivitySlideModel } from "./activity-slide-model";

const baseRow: ActivityLiveRow = {
  reportId: "report-1",
  reportSectionId: "section-1",
  leadId: "lead-1",
  leadName: "Alex Lead",
  email: "alex@example.com",
  status: "draft",
  itemCount: 1,
  riskCount: 0,
  decisionCount: 0,
  priorityCount: 1,
  lastEditAt: null,
  submittedAt: null,
};

describe("buildActivitySlideModel", () => {
  it("uses the canonical tone ladder for a complete activity row", () => {
    const slide = buildActivitySlideModel(baseRow);

    expect(slide.tone).toBe("ready");
    expect(slide.atRiskCount).toBe(0);
  });

  it("keeps atRiskCount as a real risk count", () => {
    const slide = buildActivitySlideModel({ ...baseRow, riskCount: 3 });

    expect(slide.tone).toBe("warning");
    expect(slide.atRiskCount).toBe(3);
  });
});
