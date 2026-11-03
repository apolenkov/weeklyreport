// @vitest-environment jsdom
// @vitest-environment jsdom
import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "vitest";

import {
  buildAccordionModel,
  resolveTerminalNotice,
} from "./weekly-report-page-helpers";
import {
  ACTIVITY_A,
  AUTHOR_A,
  baseReport,
  PRODUCT_A,
  REPORT_ID,
  SECTION_A,
} from "./weekly-report-page-helpers.test-support";

describe("resolveTerminalNotice — failure classes stay distinct — 1", () => {
  it("returns null for a healthy active period", () => {
    expect(
      resolveTerminalNotice({
        isError: false,
        error: null,
        data: { status: "active" },
      }),
    ).toBeNull();
  });
});
describe("resolveTerminalNotice — failure classes stay distinct — 2", () => {
  it("surfaces a transient failure instead of 'no active period'", () => {
    const notice = resolveTerminalNotice({
      isError: true,
      error: new Error("boom"),
      data: undefined,
    });
    expect(notice?.title).toBe("Report could not be loaded");
  });
});
describe("resolveTerminalNotice — failure classes stay distinct — 3", () => {
  it("renders 'no active period' only when data genuinely says so", () => {
    const notice = resolveTerminalNotice({
      isError: false,
      error: null,
      data: { status: "no-period" },
    });
    expect(notice?.title).toBe("No active reporting period");
  });
});
describe("buildAccordionModel — draftCount includes activity-only drafts — 4", () => {
  it("keeps a lone empty submitted reviewable section out of the empty-period screen", () => {
    const report = baseReport({
      leadSections: [
        {
          reportSectionId: SECTION_A,
          authorId: AUTHOR_A,
          authorName: "Alice",
          status: "submitted",
          canReview: true,
          activities: [],
        },
      ],
    });
    const accordion = buildAccordionModel({
      reportData: report,
      scope: "lead",
      submittedOnly: true,
      fullProducts: [],
      fullLeadGroups: [],
    });
    expect(accordion.hasAnyContent).toBe(true);
    expect(accordion.leadGroups.map((group) => group.id)).toEqual([AUTHOR_A]);
  });
});
describe("buildAccordionModel — draftCount includes activity-only drafts — 5", () => {
  it("keeps Activity-only and empty submitted reviewable author regions", () => {
    const report = baseReport({
      leadSections: [
        {
          reportSectionId: SECTION_A,
          authorId: AUTHOR_A,
          authorName: "Alice",
          status: "submitted",
          canReview: true,
          activities: [],
        },
        {
          reportSectionId: "second",
          authorId: "bob",
          authorName: "Bob",
          status: "submitted",
          activities: [],
          items: [
            {
              id: "saved",
              activityId: ACTIVITY_A,
              type: "current",
              text: "Detached record",
              workflowStatus: "paused",
              tag: "delivery",
              carriedOver: false,
            },
          ],
        },
      ],
    });
    const accordion = buildAccordionModel({
      reportData: report,
      scope: "lead",
      submittedOnly: true,
      fullProducts: [],
      fullLeadGroups: [],
    });
    expect(accordion.leadGroups.map((group) => group.id)).toEqual([
      AUTHOR_A,
      "bob",
    ]);
    expect(accordion.hasAnyContent).toBe(true);
  });
});
describe("buildAccordionModel — draftCount includes activity-only drafts — 6", () => {
  it("counts a draft section whose only content is a touched activity, with no draft product content", () => {
    const report = baseReport({
      portfolioOverview: [],
      leadSections: [
        {
          reportSectionId: SECTION_A,
          reportId: REPORT_ID,
          authorId: AUTHOR_A,
          authorName: "Alice",
          version: 1,
          status: "draft",
          submittedAt: null,
          projects: [],
          items: [],
          risks: [],
          decisions: [],
          activities: [
            {
              activityId: ACTIVITY_A,
              activityName: "Jira triage duty",
              status: "red",
              derivedStatus: "red",
              linkedProducts: [],
              note: null,
            },
          ],
        },
      ],
    });

    const accordion = buildAccordionModel({
      reportData: report,
      scope: "product",
      submittedOnly: true,
      fullProducts: [],
      fullLeadGroups: [],
    });

    expect(accordion.draftCount).toBe(1);
  });
});
describe("buildAccordionModel — draftCount includes activity-only drafts — 7", () => {
  it("does not count a draft section with neither product nor activity content", () => {
    const report = baseReport({
      portfolioOverview: [],
      leadSections: [
        {
          reportSectionId: SECTION_A,
          reportId: REPORT_ID,
          authorId: AUTHOR_A,
          authorName: "Alice",
          version: 1,
          status: "draft",
          submittedAt: null,
          projects: [],
          items: [],
          risks: [],
          decisions: [],
          activities: [
            {
              activityId: ACTIVITY_A,
              activityName: "Jira triage duty",
              // Seeded-but-untouched: green with no note and no owned records
              // is not evidence of lead input.
              status: "green",
              derivedStatus: "green",
              linkedProducts: [],
              note: null,
            },
          ],
        },
      ],
    });

    const accordion = buildAccordionModel({
      reportData: report,
      scope: "product",
      submittedOnly: true,
      fullProducts: [],
      fullLeadGroups: [],
    });

    expect(accordion.draftCount).toBe(0);
  });
});
describe("buildAccordionModel — draftCount includes activity-only drafts — 8", () => {
  it("still counts a draft section with draft product content and no activities", () => {
    const report = baseReport({
      portfolioOverview: [
        {
          productId: PRODUCT_A,
          productName: "Product Alpha",
          worstStatus: "green",
          stageCount: 1,
          leadNames: ["Alice"],
          leadIds: ["5ccd4f78-2a3d-58e4-889a-e9ad6be0b941"],
        },
      ],
      leadSections: [
        {
          reportSectionId: SECTION_A,
          reportId: REPORT_ID,
          authorId: AUTHOR_A,
          authorName: "Alice",
          version: 1,
          status: "draft",
          submittedAt: null,
          projects: [
            {
              projectId: PRODUCT_A,
              projectName: "Product Alpha",
              trafficLight: "green",
            },
          ],
          items: [
            {
              id: "item-1",
              projectId: PRODUCT_A,
              type: "current",
              text: "Draft work",
              tag: "Dev",
              workflowStatus: "in_progress",
              stageNames: ["Development"],
              carriedOver: false,
            },
          ],
          risks: [],
          decisions: [],
          activities: [],
        },
      ],
    });

    const accordion = buildAccordionModel({
      reportData: report,
      scope: "product",
      submittedOnly: true,
      fullProducts: [],
      fullLeadGroups: [],
    });

    expect(accordion.draftCount).toBe(1);
  });
});
describe("terminal notice — missing healthy data is not no-period — 9", () => {
  it("leaves pending/healthy absence to the page loading gate", () => {
    expect(
      resolveTerminalNotice({ isError: false, error: null, data: undefined }),
    ).toBeNull();
  });
});
describe("terminal notice — missing healthy data is not no-period — 10", () => {
  it("retains invalid-link precedence without data", () => {
    const error = TRPCClientError.from({
      error: {
        message: "Invalid link",
        code: -32_004,
        data: { httpStatus: 404, code: "NOT_FOUND" },
      },
    });
    expect(
      resolveTerminalNotice({ isError: true, error, data: undefined })?.title,
    ).toBe("Report not found");
  });
});
