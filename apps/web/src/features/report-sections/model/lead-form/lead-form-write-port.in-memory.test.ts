import { describe, expect, it } from "vitest";

import { makeReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
import { LeadFormWriteError } from "./lead-form-write-port";
import { InMemoryLeadFormWriteAdapter } from "./lead-form-write-port.in-memory";

const section = makeReportSectionFixture({
  reportSectionId: "11111111-1111-4111-8111-111111111111",
  reportId: "22222222-2222-4222-8222-222222222222",
  authorId: "33333333-3333-4333-8333-333333333333",
  authorName: "Test Lead",
});

describe("InMemoryLeadFormWriteAdapter", () => {
  it("records every command and exposes configured pending state", async () => {
    const adapter = new InMemoryLeadFormWriteAdapter(
      {
        saveDraft: () => Promise.resolve(section),
        submit: () => Promise.resolve(section),
      },
      { submit: true },
    );

    await adapter.revoke({ reportSectionId: section.reportSectionId });
    await adapter.requestReopen({
      reportSectionId: section.reportSectionId,
      reason: "Please reopen",
    });
    await adapter.fillFrom({
      targetSectionId: section.reportSectionId,
      sourceSectionId: "44444444-4444-4444-8444-444444444444",
      version: 3,
    });

    expect(adapter.pending.submit).toBe(true);
    expect(adapter.calls.revoke).toHaveLength(1);
    expect(adapter.calls.requestReopen).toHaveLength(1);
    expect(adapter.calls.fillFrom).toHaveLength(1);
  });

  it.each(["conflict", "error"] as const)(
    "propagates a normalized %s result",
    async (kind) => {
      const failure = new LeadFormWriteError(kind, "failed");
      const adapter = new InMemoryLeadFormWriteAdapter({
        saveDraft: () => Promise.reject(failure),
        submit: () => Promise.resolve(section),
      });

      await expect(
        adapter.saveDraft({
          reportSectionId: section.reportSectionId,
          version: 1,
          status: "draft",
          projectStatuses: [],
          stageStatuses: [],
          activityStatuses: [],
          items: [],
          risks: [],
          decisions: [],
        }),
      ).rejects.toBe(failure);
      expect(adapter.calls.saveDraft).toHaveLength(1);
    },
  );
});
