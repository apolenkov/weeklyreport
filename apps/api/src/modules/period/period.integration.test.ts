import { describe, expect, it, vi } from "vitest";

import type { UserSession } from "@customreport/shared";

import {
  PeriodAccessError,
  PeriodService,
  type PeriodRepository,
} from "./period.service";

/* ------------------------------------------------------------------ */
/*  Fixed test UUIDs                                                   */
/* ------------------------------------------------------------------ */

const reportId = "aaaa1111-1111-4111-8111-111111111111";

const headSession: UserSession = {
  userId: "00000000-0000-4000-8000-000000000001",
  email: "head@customreport.local",
  name: "Department Head",
  role: "head",
  activeReportId: reportId,
  activeReportSectionId: null,
};

// Lead session reserved for future authorization-level tests
// const leadSession: UserSession = { ... };

/* ------------------------------------------------------------------ */
/*  Mock repository                                                    */
/* ------------------------------------------------------------------ */

function createSpyRepository(
  reports: Map<
    string,
    {
      id: string;
      status: string;
      periodStatus: string;
      publishedAt: Date | null;
    }
  >,
): PeriodRepository & {
  publishPeriod: ReturnType<typeof vi.fn>;
  reopenPeriod: ReturnType<typeof vi.fn>;
} {
  const publishFn = vi.fn(async (id: string) => {
    const r = reports.get(id);
    if (r) {
      r.periodStatus = "published";
      r.publishedAt = new Date();
    }
  });

  const reopenFn = vi.fn(async (id: string) => {
    const r = reports.get(id);
    if (r) {
      r.periodStatus = "reopened";
    }
  });

  return {
    async getReportById(id: string) {
      const r = reports.get(id);
      return r ? structuredClone(r) : null;
    },
    publishPeriod: publishFn,
    reopenPeriod: reopenFn,
  };
}

/* ------------------------------------------------------------------ */
/*  Integration-level tests — complementary to period.service.test.ts  */
/* ------------------------------------------------------------------ */

describe("PeriodService — integration (publish lifecycle)", () => {
  it("publish sets periodStatus to published and records timestamp", async () => {
    const reports = new Map([
      [
        reportId,
        {
          id: reportId,
          status: "draft",
          periodStatus: "open",
          publishedAt: null,
        },
      ],
    ]);
    const repo = createSpyRepository(reports);
    const service = new PeriodService(repo);

    const result = await service.publishPeriod(reportId, headSession);

    expect(result.success).toBe(true);
    expect(result.reportId).toBe(reportId);
    // The spy mutated the in-memory record
    const record = reports.get(reportId);
    expect(record?.periodStatus).toBe("published");
    expect(record?.publishedAt).toBeInstanceOf(Date);
  });

  it("publish fails with PeriodAccessError if already published", async () => {
    const reports = new Map([
      [
        reportId,
        {
          id: reportId,
          status: "published",
          periodStatus: "published",
          publishedAt: new Date(),
        },
      ],
    ]);
    const service = new PeriodService(createSpyRepository(reports));

    await expect(
      service.publishPeriod(reportId, headSession),
    ).rejects.toBeInstanceOf(PeriodAccessError);
  });

  it("reopen resets periodStatus from published to reopened", async () => {
    const reports = new Map([
      [
        reportId,
        {
          id: reportId,
          status: "published",
          periodStatus: "published",
          publishedAt: new Date(),
        },
      ],
    ]);
    const repo = createSpyRepository(reports);
    const service = new PeriodService(repo);

    const result = await service.reopenPeriod(reportId);

    expect(result.success).toBe(true);
    expect(reports.get(reportId)?.periodStatus).toBe("reopened");
  });

  it("reopen fails with PeriodAccessError if not published", async () => {
    const reports = new Map([
      [
        reportId,
        {
          id: reportId,
          status: "draft",
          periodStatus: "open",
          publishedAt: null,
        },
      ],
    ]);
    const service = new PeriodService(createSpyRepository(reports));

    await expect(service.reopenPeriod(reportId)).rejects.toBeInstanceOf(
      PeriodAccessError,
    );
  });

  it("publish after reopen succeeds (reopened -> published)", async () => {
    const reports = new Map([
      [
        reportId,
        {
          id: reportId,
          status: "draft",
          periodStatus: "open",
          publishedAt: null,
        },
      ],
    ]);
    const service = new PeriodService(createSpyRepository(reports));

    // Publish -> Reopen -> Re-publish
    await service.publishPeriod(reportId, headSession);
    await service.reopenPeriod(reportId);
    const result = await service.publishPeriod(reportId, headSession);

    expect(result.success).toBe(true);
  });

  it("publish with missing report throws generic Error (not PeriodAccessError)", async () => {
    const service = new PeriodService(createSpyRepository(new Map()));

    const error = await service
      .publishPeriod(reportId, headSession)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(PeriodAccessError);
  });

  it("reopen with missing report throws generic Error", async () => {
    const service = new PeriodService(createSpyRepository(new Map()));

    const error = await service.reopenPeriod(reportId).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(PeriodAccessError);
  });

  it("publish records the userId via repository call", async () => {
    const reports = new Map([
      [
        reportId,
        {
          id: reportId,
          status: "draft",
          periodStatus: "open",
          publishedAt: null,
        },
      ],
    ]);
    const repo = createSpyRepository(reports);
    const service = new PeriodService(repo);

    await service.publishPeriod(reportId, headSession);

    expect(repo.publishPeriod).toHaveBeenCalledWith(
      reportId,
      headSession.userId,
    );
  });
});
