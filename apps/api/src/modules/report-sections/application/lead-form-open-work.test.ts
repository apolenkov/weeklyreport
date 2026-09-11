import { describe, expect, it, vi } from "vitest";

import {
  AUTHOR_ID,
  createMockRepository,
  draftSection,
  forPeriod,
  REPORT_ID,
} from "./__tests__/lead-form-contract-harness.js";
import { LeadFormDomainError, LeadFormService } from "./lead-form.service.js";

describe("LeadFormService — getOpenWork", () => {
  it("authorizes the target through own by-period access before reading history", async () => {
    const getSectionForPeriod = vi
      .fn()
      .mockResolvedValue(forPeriod(structuredClone(draftSection), false));
    const getOpenWorkHistoryPage = vi.fn().mockResolvedValue({
      occurrences: [],
      nextCursor: "next-page",
    });
    const repository = createMockRepository({
      getSectionForPeriod,
      getOpenWorkHistoryPage,
    });

    const result = await new LeadFormService(repository).getOpenWork(
      { reportId: REPORT_ID },
      AUTHOR_ID,
    );

    expect(result).toEqual({ occurrences: [], nextCursor: "next-page" });
    expect(getSectionForPeriod).toHaveBeenCalledWith(REPORT_ID, AUTHOR_ID);
    expect(getOpenWorkHistoryPage).toHaveBeenCalledWith(REPORT_ID, AUTHOR_ID, {
      cursor: undefined,
      limit: 10,
    });
  });

  it("does not query history when the session author has no target section", async () => {
    const getOpenWorkHistoryPage = vi.fn();
    const repository = createMockRepository({ getOpenWorkHistoryPage });

    await expect(
      new LeadFormService(repository).getOpenWork(
        { reportId: REPORT_ID },
        AUTHOR_ID,
      ),
    ).rejects.toBeInstanceOf(LeadFormDomainError);
    expect(getOpenWorkHistoryPage).not.toHaveBeenCalled();
  });

  it("fails if the target disappears inside the history read", async () => {
    const repository = createMockRepository({
      getSectionForPeriod: vi
        .fn()
        .mockResolvedValue(forPeriod(structuredClone(draftSection), false)),
      getOpenWorkHistoryPage: vi.fn().mockResolvedValue(null),
    });

    await expect(
      new LeadFormService(repository).getOpenWork(
        { reportId: REPORT_ID, limit: 5 },
        AUTHOR_ID,
      ),
    ).rejects.toThrow(`Report ${REPORT_ID} not found.`);
  });
});
