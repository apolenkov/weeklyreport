import { describe, expect, it } from "vitest";

import { createDemoSection } from "../../../test-utils/fixtures";
import { makeReportSectionFixture } from "../../../test-utils/report-section-fixtures";
import { buildHeadActivityRecords } from "./head-activity-records";

const ACTIVITY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("buildHeadActivityRecords", () => {
  it("preserves weekly presentation, outcomes and comments separately for two contributors", () => {
    const section = makeReportSectionFixture({
      canReview: true,
      activities: [
        {
          activityId: ACTIVITY_ID,
          activityName: "Catalogue name",
          titleOverride: "Weekly title",
          status: "green",
          note: "Saved note",
        },
      ],
      items: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          activityId: ACTIVITY_ID,
          type: "next",
          text: "Next work",
          tag: "delivery",
          workflowStatus: "planned",
          carriedOver: false,
          nextStepText: "Commitment",
          outcomeHistory: [],
          comments: [],
        },
      ],
    });
    const other = {
      ...section,
      reportSectionId: "other-section",
      authorId: "other-author",
      authorName: "Other Lead",
      canReview: false,
    };
    const cards = buildHeadActivityRecords([section, other]);
    expect(cards).toHaveLength(2);
    expect(new Set(cards.map(({ key }) => key)).size).toBe(2);
    expect(
      cards.every(
        ({ activityName, note }) =>
          activityName === "Weekly title" && note === "Saved note",
      ),
    ).toBe(true);
    expect(
      cards.find(({ authorId }) => authorId === section.authorId)?.nextItems[0],
    ).toBe(section.items[0]);
    expect(
      cards.find(({ authorId }) => authorId === other.authorId)?.canReview,
    ).toBe(false);
    expect(cards[0]?.nextItems[0]).toMatchObject({
      comments: [],
      outcomeHistory: [],
      nextStepText: "Commitment",
    });
  });
  it("retains typed authorized records and section identity without product duplication", () => {
    const section = makeReportSectionFixture({
      ...createDemoSection(),
      canReview: true,
      activities: [
        {
          activityId: ACTIVITY_ID,
          activityName: "Duty",
          status: "green",
          note: "Weekly note",
          linkedProducts: [
            { productId: "p1", productName: "One" },
            { productId: "p2", productName: "Two" },
          ],
        },
      ],
      items: [
        {
          id: "11111111-1111-4111-8111-111111111112",
          activityId: ACTIVITY_ID,
          type: "current",
          text: "Work",
          tag: "delivery",
          workflowStatus: "paused",
          carriedOver: false,
          priorityRank: 1,
          nextStepText: "Follow up",
        },
      ],
      risks: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          activityId: ACTIVITY_ID,
          risk: "Problem",
          severity: "blocked",
          impact: "Delay",
          mitigation: "Escalate",
          stageNames: [],
        },
      ],
      decisions: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          activityId: ACTIVITY_ID,
          text: "Decision",
          owner: "Owner",
          impact: "Effect",
          stageNames: [],
        },
      ],
    });
    const cards = buildHeadActivityRecords([section]);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      reportSectionId: section.reportSectionId,
      authorId: section.authorId,
      tone: "on-track",
      note: "Weekly note",
      linkedProducts: ["One", "Two"],
      currentItems: [
        {
          id: section.items[0]?.id,
          workflowStatus: "paused",
          priorityRank: 1,
          nextStepText: "Follow up",
        },
      ],
      risks: [
        {
          risk: "Problem",
          severity: "blocked",
          impact: "Delay",
          mitigation: "Escalate",
        },
      ],
      decisions: [{ text: "Decision" }],
      canReview: true,
    });
    expect(cards[0]?.currentItems[0]).toBe(section.items[0]);
    expect(section.activities[0]?.status).toBe("green");
  });

  it("keeps unavailable parent records separate for each author, excluding product records", () => {
    const first = makeReportSectionFixture({
      ...createDemoSection(),
      activities: [],
      items: [
        {
          id: "11111111-1111-4111-8111-111111111112",
          activityId: ACTIVITY_ID,
          type: "next",
          text: "Saved",
          tag: "delivery",
          workflowStatus: "planned",
          carriedOver: false,
        },
      ],
      risks: [],
      decisions: [],
    });
    const second = {
      ...first,
      authorId: "other",
      reportSectionId: "other-section",
    };
    const cards = buildHeadActivityRecords([first, second]);
    expect(cards).toHaveLength(2);
    expect(new Set(cards.map((card) => card.key)).size).toBe(2);
    expect(
      cards.every(
        (card) =>
          card.tone === null &&
          card.activityName === "Activity details unavailable",
      ),
    ).toBe(true);
    expect(cards[0]?.nextItems[0]?.id).toBe(first.items[0]?.id);
    expect(buildHeadActivityRecords([createDemoSection()])).toEqual([]);
  });
});
