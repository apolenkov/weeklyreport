import type { PeriodStatus, Role } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { makeWeeklyReportFixture } from "../../../test-utils/report-section-fixtures";
import {
  buildReviewModel,
  distinctReviewGroups,
  isReviewEnabled,
} from "./report-review-model";

const GROUP_A = "11111111-1111-4111-8111-111111111111";
const GROUP_B = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const SECTION_A = "44444444-4444-4444-8444-444444444441";
const SECTION_B = "44444444-4444-4444-8444-444444444442";
const SECTION_C = "44444444-4444-4444-8444-444444444443";

describe("isReviewEnabled", () => {
  it.each([
    [null, "open", false],
    ["lead", "open", false],
    ["viewer", "open", true],
    ["head", "published", false],
    ["admin", "reopened", true],
  ] as const)(
    "gates role=%s periodStatus=%s",
    (role: Role | null, periodStatus: PeriodStatus, expected: boolean) => {
      expect(isReviewEnabled(role, periodStatus)).toBe(expected);
    },
  );
});

describe("distinctReviewGroups", () => {
  it("drops missing ids and keeps the first occurrence order", () => {
    const report = makeWeeklyReportFixture({
      leadSections: [
        { groupId: GROUP_A, groupName: "Core Development" },
        { groupId: null },
        { groupId: GROUP_B, groupName: "Finance Platforms" },
        { groupId: GROUP_A, groupName: "Core Development" },
      ],
    });

    expect(distinctReviewGroups(report.leadSections)).toEqual([
      { groupId: GROUP_A, label: "Core Development" },
      { groupId: GROUP_B, label: "Finance Platforms" },
    ]);
  });

  it("rejects missing or conflicting labels", () => {
    const missing = makeWeeklyReportFixture({
      leadSections: [{ groupId: GROUP_A }],
    });
    expect(() => distinctReviewGroups(missing.leadSections)).toThrow(
      /has no label/u,
    );

    const conflicting = makeWeeklyReportFixture({
      leadSections: [
        { groupId: GROUP_A, groupName: "Core Development" },
        { groupId: GROUP_A, groupName: "Finance Platforms" },
      ],
    });
    expect(() => distinctReviewGroups(conflicting.leadSections)).toThrow(
      /conflicting labels/u,
    );
  });
});

describe("buildReviewModel", () => {
  it("returns an empty model when the live review surface is disabled", () => {
    const report = makeWeeklyReportFixture({
      leadSections: [{ groupId: GROUP_A, groupName: "Core Development" }],
    });
    const onMutated = vi.fn();

    expect(
      buildReviewModel(report, {
        currentRole: "lead",
        periodStatus: "open",
        currentUserId: USER_ID,
        onMutated,
      }),
    ).toEqual({
      context: undefined,
      groups: [],
      sections: [],
      isHeadOrAdmin: false,
    });
  });

  it("maps reviewer context, deduplicated groups, and section rows", () => {
    const report = makeWeeklyReportFixture({
      leadSections: [
        {
          reportSectionId: SECTION_A,
          groupId: GROUP_A,
          groupName: "Core Development",
          status: "submitted",
          canReview: true,
        },
        {
          reportSectionId: SECTION_B,
          groupId: GROUP_A,
          groupName: "Core Development",
          status: "draft",
          canReview: false,
        },
        {
          reportSectionId: SECTION_C,
          groupId: GROUP_B,
          groupName: "Finance Platforms",
          status: "submitted",
          canReview: true,
        },
      ],
    });
    const onMutated = vi.fn();
    const model = buildReviewModel(report, {
      currentRole: "admin",
      periodStatus: "open",
      currentUserId: USER_ID,
      onMutated,
    });

    expect(model.context).toEqual({
      currentUserId: USER_ID,
      isAdmin: true,
      onMutated,
    });
    expect(model.groups).toEqual([
      { groupId: GROUP_A, label: "Core Development" },
      { groupId: GROUP_B, label: "Finance Platforms" },
    ]);
    expect(
      model.sections.map((section) => ({
        reportSectionId: section.reportSectionId,
        status: section.status,
        canReview: section.canReview,
        groupId: section.groupId,
      })),
    ).toEqual([
      {
        reportSectionId: SECTION_A,
        status: "submitted",
        canReview: true,
        groupId: GROUP_A,
      },
      {
        reportSectionId: SECTION_B,
        status: "draft",
        canReview: false,
        groupId: GROUP_A,
      },
      {
        reportSectionId: SECTION_C,
        status: "submitted",
        canReview: true,
        groupId: GROUP_B,
      },
    ]);
    expect(model.isHeadOrAdmin).toBe(true);
  });
});
