import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { listPeriodsByState } from "./admin-period.queries";

const LEAD_ONE = "11111111-1111-4111-8111-111111111111";
const LEAD_TWO = "22222222-2222-4222-8222-222222222222";
const LEAD_THREE = "33333333-3333-4333-8333-333333333333";
const INACTIVE_AUTHOR = "44444444-4444-4444-8444-444444444444";
const PERIOD_ONE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PERIOD_TWO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PERIOD_THREE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OUTSIDE_PERIOD = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function periodRow(id: string, periodStart: string, periodStatus: string) {
  return {
    id,
    periodStart: new Date(periodStart),
    periodEnd: new Date(periodStart),
    deadline: null,
    publishedAt: null,
    periodState: "open",
    periodStatus,
    archived: false,
    autoPublished: false,
    autoArchived: false,
    weekLabel: null,
  };
}

function fakePrisma(
  periods: ReturnType<typeof periodRow>[],
  sections: { reportId: string; authorId: string; status: string }[],
) {
  return {
    report: {
      findMany: vi
        .fn()
        .mockResolvedValueOnce(periods)
        .mockResolvedValueOnce([]),
    },
    user: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: LEAD_ONE },
          { id: LEAD_TWO },
          { id: LEAD_THREE },
        ]),
    },
    reportSection: {
      findMany: vi.fn().mockResolvedValue(sections),
    },
  } as unknown as PrismaService;
}

describe("listPeriodsByState progress", () => {
  it("counts each open period's own sections against the active leads", async () => {
    const periods = [
      periodRow(PERIOD_ONE, "2026-10-19T00:00:00.000Z", "open"),
      periodRow(PERIOD_TWO, "2026-10-12T00:00:00.000Z", "reopened"),
      periodRow(PERIOD_THREE, "2026-10-05T00:00:00.000Z", "open"),
    ];
    const prisma = fakePrisma(periods, [
      { reportId: PERIOD_ONE, authorId: LEAD_ONE, status: "submitted" },
      { reportId: PERIOD_ONE, authorId: LEAD_ONE, status: "submitted" },
      { reportId: PERIOD_ONE, authorId: LEAD_TWO, status: "draft" },
      { reportId: PERIOD_ONE, authorId: INACTIVE_AUTHOR, status: "submitted" },
      { reportId: PERIOD_TWO, authorId: LEAD_TWO, status: "submitted" },
      { reportId: PERIOD_TWO, authorId: LEAD_THREE, status: "submitted" },
      { reportId: OUTSIDE_PERIOD, authorId: LEAD_ONE, status: "submitted" },
    ]);

    const rows = await listPeriodsByState(prisma, {
      states: ["open"],
      limit: 10,
    });

    expect(
      rows.map(({ id, submittedCount, totalCount }) => ({
        id,
        submittedCount,
        totalCount,
      })),
    ).toEqual([
      { id: PERIOD_ONE, submittedCount: 1, totalCount: 3 },
      { id: PERIOD_TWO, submittedCount: 2, totalCount: 3 },
      { id: PERIOD_THREE, submittedCount: 0, totalCount: 3 },
    ]);
  });

  it("does not rescan the section list once per period", async () => {
    const periods = [
      periodRow(PERIOD_ONE, "2026-10-19T00:00:00.000Z", "open"),
      periodRow(PERIOD_TWO, "2026-10-12T00:00:00.000Z", "open"),
      periodRow(PERIOD_THREE, "2026-10-05T00:00:00.000Z", "open"),
    ];
    const sections = [
      { reportId: PERIOD_ONE, authorId: LEAD_ONE, status: "submitted" },
      { reportId: PERIOD_TWO, authorId: LEAD_TWO, status: "draft" },
      { reportId: PERIOD_THREE, authorId: LEAD_THREE, status: "submitted" },
    ];
    const filterSpy = vi.spyOn(sections, "filter");
    const prisma = fakePrisma(periods, sections);

    await listPeriodsByState(prisma, { states: ["open"], limit: 10 });

    expect(filterSpy).not.toHaveBeenCalled();
  });
});
