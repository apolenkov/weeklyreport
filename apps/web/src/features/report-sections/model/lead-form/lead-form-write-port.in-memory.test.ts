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
  it("records lifecycle commands and exposes configured submit pending state", async () => {
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

  it("records configured outcome commands and fails loudly without handlers", async () => {
    const outcome = {
      section: { ...section, version: 2 },
      stableId: "55555555-5555-4555-8555-555555555555",
      replayed: false,
    };
    const configured = new InMemoryLeadFormWriteAdapter({
      saveDraft: () => Promise.resolve(section),
      submit: () => Promise.resolve(section),
      resolvePlan: () => Promise.resolve(outcome),
      restorePlan: () => Promise.resolve({ ...outcome, replayed: true }),
    });
    const resolveInput = {
      reportSectionId: section.reportSectionId,
      version: 1,
      commandId: "66666666-6666-4666-8666-666666666666",
      source: {
        kind: "prior" as const,
        reportId: section.reportId,
        recordId: "77777777-7777-4777-8777-777777777777",
      },
      outcome: "done" as const,
      stageNames: [],
    };
    await expect(configured.resolvePlan(resolveInput)).resolves.toEqual(
      outcome,
    );
    expect(configured.calls.resolvePlan).toEqual([resolveInput]);

    const unsupported = new InMemoryLeadFormWriteAdapter({
      saveDraft: () => Promise.resolve(section),
      submit: () => Promise.resolve(section),
    });
    await expect(unsupported.resolvePlan(resolveInput)).rejects.toThrow(
      "In-memory resolvePlan handler is not configured",
    );
  });
});
