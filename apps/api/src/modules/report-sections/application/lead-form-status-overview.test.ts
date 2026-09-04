import { describe, expect, it, vi } from "vitest";

import {
  AUTHOR_ID,
  createMockRepository,
  draftSection,
  forPeriod,
  OTHER_USER_ID,
  PROJECT_ID,
  REPORT_ID,
} from "./__tests__/lead-form-contract-harness.js";
import { LeadFormAccessError, LeadFormService } from "./lead-form.service.js";

const PERIOD = {
  reportId: REPORT_ID,
  periodStart: new Date("2026-08-24T00:00:00.000Z"),
  periodEnd: new Date("2026-08-30T23:59:59.999Z"),
};

describe("LeadFormService — getStatusOverview", () => {
  it("returns the authorized selected section with no-predecessor state", async () => {
    const getStatusOverviewPeriods = vi.fn().mockResolvedValue({
      current: PERIOD,
      predecessor: {
        availability: "unavailable",
        reason: "no_predecessor",
      },
    });
    const repo = createMockRepository({
      getSectionForPeriod: vi
        .fn()
        .mockResolvedValue(forPeriod(structuredClone(draftSection), false)),
      getStatusOverviewPeriods,
    });

    const result = await new LeadFormService(repo).getStatusOverview(
      REPORT_ID,
      AUTHOR_ID,
      "lead",
    );

    expect(result.current.section).toEqual(draftSection);
    expect(result.predecessor).toEqual({
      availability: "unavailable",
      reason: "no_predecessor",
    });
    expect(getStatusOverviewPeriods).toHaveBeenCalledWith(
      REPORT_ID,
      AUTHOR_ID,
      AUTHOR_ID,
      "lead",
    );
  });

  it("does not read a predecessor when selected cross-author access is denied", async () => {
    const getStatusOverviewPeriods = vi.fn();
    const repo = createMockRepository({
      getSectionForPeriod: vi
        .fn()
        .mockResolvedValue(forPeriod(structuredClone(draftSection), false)),
      getSharedNonArchivedProductIds: vi.fn().mockResolvedValue([]),
      getStatusOverviewPeriods,
    });

    await expect(
      new LeadFormService(repo).getStatusOverview(
        REPORT_ID,
        AUTHOR_ID,
        "lead",
        OTHER_USER_ID,
      ),
    ).rejects.toBeInstanceOf(LeadFormAccessError);
    expect(getStatusOverviewPeriods).not.toHaveBeenCalled();
  });

  it("passes the resolved foreign author only after selected access succeeds", async () => {
    const foreign = {
      ...structuredClone(draftSection),
      authorId: OTHER_USER_ID,
      authorName: "Lead Two",
    };
    const getStatusOverviewPeriods = vi.fn().mockResolvedValue({
      current: PERIOD,
      predecessor: {
        availability: "unavailable",
        reason: "section_unavailable",
        reportId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        periodStart: new Date("2026-08-17T00:00:00.000Z"),
        periodEnd: new Date("2026-08-23T23:59:59.999Z"),
      },
    });
    const repo = createMockRepository({
      getSectionForPeriod: vi
        .fn()
        .mockImplementation((_reportId: string, authorId: string) =>
          Promise.resolve(
            forPeriod(
              authorId === OTHER_USER_ID
                ? foreign
                : structuredClone(draftSection),
              false,
            ),
          ),
        ),
      getSharedNonArchivedProductIds: vi.fn().mockResolvedValue([PROJECT_ID]),
      getStatusOverviewPeriods,
    });

    await new LeadFormService(repo).getStatusOverview(
      REPORT_ID,
      AUTHOR_ID,
      "lead",
      OTHER_USER_ID,
    );

    expect(getStatusOverviewPeriods).toHaveBeenCalledWith(
      REPORT_ID,
      OTHER_USER_ID,
      AUTHOR_ID,
      "lead",
    );
  });
});
