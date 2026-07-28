import { describe, expect, it, vi } from "vitest";

import { customreportReopenRequestsTotal } from "../../../infrastructure/metrics/metrics.registry.js";
import { ReportSectionsPrometheusTelemetry } from "../infrastructure/report-sections-prometheus-telemetry.adapter.js";
import {
  AUTHOR_ID,
  createMockRepository,
  OTHER_USER_ID,
  reopenContext,
  SECTION_ID,
} from "./__tests__/lead-form-contract-harness.js";
import {
  computeReopenEligibility,
  LeadFormAccessError,
  LeadFormDomainError,
  LeadFormService,
  ReopenRequestError,
} from "./lead-form.service";

// ---------------------------------------------------------------------------
// computeReopenEligibility — the single source of truth
// ---------------------------------------------------------------------------

describe("computeReopenEligibility", () => {
  it("allows a submitted section on an open period with no pending request", () => {
    expect(
      computeReopenEligibility({
        sectionStatus: "submitted",
        periodStatus: "open",
        archived: false,
        hasPendingReopen: false,
      }),
    ).toEqual({ canRequestReopen: true, reason: null });
  });

  it("allows a reopened period", () => {
    expect(
      computeReopenEligibility({
        sectionStatus: "submitted",
        periodStatus: "reopened",
        archived: false,
        hasPendingReopen: false,
      }).canRequestReopen,
    ).toBe(true);
  });

  it("blocks a non-submitted section", () => {
    expect(
      computeReopenEligibility({
        sectionStatus: "draft",
        periodStatus: "open",
        archived: false,
        hasPendingReopen: false,
      }),
    ).toEqual({ canRequestReopen: false, reason: "not_submitted" });
  });

  it("blocks an archived report before checking periodStatus", () => {
    expect(
      computeReopenEligibility({
        sectionStatus: "submitted",
        periodStatus: "published",
        archived: true,
        hasPendingReopen: false,
      }),
    ).toEqual({ canRequestReopen: false, reason: "period_archived" });
  });

  it("blocks a published period", () => {
    expect(
      computeReopenEligibility({
        sectionStatus: "submitted",
        periodStatus: "published",
        archived: false,
        hasPendingReopen: false,
      }),
    ).toEqual({ canRequestReopen: false, reason: "period_closed" });
  });

  it("blocks when a pending request already exists", () => {
    expect(
      computeReopenEligibility({
        sectionStatus: "submitted",
        periodStatus: "open",
        archived: false,
        hasPendingReopen: true,
      }),
    ).toEqual({ canRequestReopen: false, reason: "pending_request_exists" });
  });
});

// ---------------------------------------------------------------------------
// requestReopen — period-lifecycle guard
// ---------------------------------------------------------------------------

describe("LeadFormService — requestReopen", () => {
  it("succeeds for a submitted section by the author on an open period", async () => {
    const repo = createMockRepository({
      getSectionReopenContext: vi.fn().mockResolvedValue(reopenContext()),
    });
    const service = new LeadFormService(repo);

    const result = await service.requestReopen(
      SECTION_ID,
      AUTHOR_ID,
      "Need to fix a typo",
    );

    expect(result).toEqual({ success: true });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    expect(repo.createReopenRequest).toHaveBeenCalledWith(
      SECTION_ID,
      AUTHOR_ID,
      "Need to fix a typo",
    );
  });

  it("succeeds on a reopened period", async () => {
    const repo = createMockRepository({
      getSectionReopenContext: vi
        .fn()
        .mockResolvedValue(reopenContext({ periodStatus: "reopened" })),
    });
    const service = new LeadFormService(repo);

    await expect(service.requestReopen(SECTION_ID, AUTHOR_ID)).resolves.toEqual(
      { success: true },
    );
  });

  it("rejects a published period with a BAD_REQUEST-mapped domain error", async () => {
    const repo = createMockRepository({
      getSectionReopenContext: vi
        .fn()
        .mockResolvedValue(reopenContext({ periodStatus: "published" })),
    });
    const service = new LeadFormService(repo);

    await expect(service.requestReopen(SECTION_ID, AUTHOR_ID)).rejects.toThrow(
      ReopenRequestError,
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
    expect(repo.createReopenRequest).not.toHaveBeenCalled();
  });

  it("rejects an archived period", async () => {
    const repo = createMockRepository({
      getSectionReopenContext: vi
        .fn()
        .mockResolvedValue(
          reopenContext({ periodStatus: "published", archived: true }),
        ),
    });
    const service = new LeadFormService(repo);

    await expect(service.requestReopen(SECTION_ID, AUTHOR_ID)).rejects.toThrow(
      ReopenRequestError,
    );
  });

  it("rejects when a pending request already exists", async () => {
    const repo = createMockRepository({
      getSectionReopenContext: vi
        .fn()
        .mockResolvedValue(reopenContext({ hasPendingReopen: true })),
    });
    const service = new LeadFormService(repo);

    await expect(service.requestReopen(SECTION_ID, AUTHOR_ID)).rejects.toThrow(
      ReopenRequestError,
    );
  });

  it("rejects a non-submitted section", async () => {
    const repo = createMockRepository({
      getSectionReopenContext: vi
        .fn()
        .mockResolvedValue(reopenContext({ sectionStatus: "draft" })),
    });
    const service = new LeadFormService(repo);

    await expect(service.requestReopen(SECTION_ID, AUTHOR_ID)).rejects.toThrow(
      ReopenRequestError,
    );
  });

  it("rejects when the caller is not the section author (FORBIDDEN)", async () => {
    const repo = createMockRepository({
      getSectionReopenContext: vi.fn().mockResolvedValue(reopenContext()),
    });
    const service = new LeadFormService(repo);

    await expect(
      service.requestReopen(SECTION_ID, OTHER_USER_ID),
    ).rejects.toThrow(LeadFormAccessError);
  });

  it("rejects when the section does not exist (NOT_FOUND)", async () => {
    const repo = createMockRepository();
    const service = new LeadFormService(repo);

    await expect(service.requestReopen(SECTION_ID, AUTHOR_ID)).rejects.toThrow(
      LeadFormDomainError,
    );
  });

  // The reopen-funnel counter's `requested` slice increments only on success.
  it('increments customreport_reopen_requests_total{state="requested"} on success', async () => {
    const repo = createMockRepository({
      getSectionReopenContext: vi.fn().mockResolvedValue(reopenContext()),
    });
    const service = new LeadFormService(
      repo,
      new ReportSectionsPrometheusTelemetry(),
    );

    const before = await getCounterValue(customreportReopenRequestsTotal, {
      state: "requested",
    });

    await service.requestReopen(SECTION_ID, AUTHOR_ID, "typo");

    expect(
      await getCounterValue(customreportReopenRequestsTotal, {
        state: "requested",
      }),
    ).toBe(before + 1);
  });

  it("does not increment the counter when the lifecycle guard rejects", async () => {
    const repo = createMockRepository({
      getSectionReopenContext: vi
        .fn()
        .mockResolvedValue(reopenContext({ periodStatus: "published" })),
    });
    const service = new LeadFormService(repo);

    const before = await getCounterValue(customreportReopenRequestsTotal, {
      state: "requested",
    });

    await expect(
      service.requestReopen(SECTION_ID, AUTHOR_ID),
    ).rejects.toThrow();

    expect(
      await getCounterValue(customreportReopenRequestsTotal, {
        state: "requested",
      }),
    ).toBe(before);
  });
});

async function getCounterValue(
  counter: {
    get(): Promise<{
      values: { value: number; labels: Record<string, unknown> }[];
    }>;
  },
  labels: Record<string, string>,
): Promise<number> {
  const snapshot = await counter.get();
  const match = snapshot.values.find((entry) =>
    Object.entries(labels).every(([k, v]) => String(entry.labels[k]) === v),
  );
  return match?.value ?? 0;
}
