import type { DraftSaveInput } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { makeReportSectionReadModel } from "../../../test-utils/report-section-fixtures.js";
import { mergeSection } from "./report-section-merge";

// TASK-503.108: U+2060 alone passed the earlier write rule (and still passes
// the SSO display-name check); the current text write rule rejects it. The
// merge stamps the stored author name as the decision owner and must keep it.
const LEGACY = "⁠";
const ACTIVITY_ID = "10000000-0000-4000-8000-000000000005";
const NOW = new Date("2026-06-03T12:00:00.000Z");

describe("mergeSection over a stored author name the write rule now rejects", () => {
  it("keeps the stored name as the decision owner exactly", () => {
    const section = makeReportSectionReadModel({ authorName: LEGACY });
    const input: DraftSaveInput = {
      reportSectionId: section.reportSectionId,
      version: section.version,
      status: "draft",
      projectStatuses: [],
      stageStatuses: [],
      activityStatuses: [],
      items: [],
      risks: [],
      decisions: [
        {
          text: "Visible decision",
          owner: "Ignored on merge",
          impact: "Visible impact",
          productId: null,
          activityId: ACTIVITY_ID,
          stageNames: [],
        },
      ],
    };

    const merged = mergeSection(section, input, "draft", NOW);

    expect(merged.decisions.map((decision) => decision.owner)).toEqual([
      LEGACY,
    ]);
  });
});
