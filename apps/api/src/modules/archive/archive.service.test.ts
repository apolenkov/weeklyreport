import type {
  ArchiveReportDetail,
  ArchiveReportSummary,
} from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import {
  ArchiveDomainError,
  type ArchiveRepository,
  ArchiveService,
} from "./archive.service";

const reportId = "22222222-2222-4222-8222-222222222222";

const olderSummary: ArchiveReportSummary = {
  reportId: "11111111-1111-4111-8111-111111111111",
  periodStart: new Date("2026-03-30T00:00:00.000Z"),
  periodEnd: new Date("2026-04-05T23:59:59.000Z"),
  publishedAt: new Date("2026-04-05T14:00:00.000Z"),
  publishedByName: "Department Head",
  portfolioStatus: "green",
};

const latestDetail: ArchiveReportDetail = {
  summary: {
    reportId,
    periodStart: new Date("2026-04-06T00:00:00.000Z"),
    periodEnd: new Date("2026-04-12T23:59:59.000Z"),
    publishedAt: new Date("2026-04-09T14:00:00.000Z"),
    publishedByName: "Department Head",
    portfolioStatus: "yellow",
  },
  report: {
    reportId,
    periodStart: new Date("2026-04-06T00:00:00.000Z"),
    periodEnd: new Date("2026-04-12T23:59:59.000Z"),
    deadline: new Date("2026-04-10T15:00:00.000Z"),
    status: "published",
    publishedAt: new Date("2026-04-09T14:00:00.000Z"),
    publishedById: "00000000-0000-4000-8000-000000000001",
    publishedByName: "Department Head",
    portfolioOverview: {
      status: "yellow",
      totals: { green: 1, yellow: 2, red: 0 },
    },
    sections: [],
  },
};

function createRepository(): ArchiveRepository {
  return {
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async ArchiveRepository contract (no awaitable work in this in-memory stub)
    async getArchiveReport(reportIdInput: string) {
      return reportIdInput === reportId ? structuredClone(latestDetail) : null;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async ArchiveRepository contract (no awaitable work in this in-memory stub)
    async listArchiveReports() {
      return {
        items: [
          structuredClone(latestDetail.summary),
          structuredClone(olderSummary),
        ],
        nextCursor: null,
      };
    },
  };
}

describe("ArchiveService", () => {
  it("returns archive reports sorted by latest published first", async () => {
    const service = new ArchiveService(createRepository());
    const result = await service.listArchiveReports();

    expect(result.items[0]?.reportId).toBe(reportId);
    expect(result.items[1]?.reportId).toBe(olderSummary.reportId);
    expect(result.nextCursor).toBeNull();
  });

  it("returns immutable detail for a published report", async () => {
    const service = new ArchiveService(createRepository());
    const detail = await service.getArchiveReport(reportId);

    expect(detail.report.status).toBe("published");
    expect(detail.summary.portfolioStatus).toBe("yellow");
  });

  it("rejects missing archive detail lookups", async () => {
    const service = new ArchiveService(createRepository());

    await expect(
      service.getArchiveReport("99999999-9999-4999-8999-999999999999"),
    ).rejects.toBeInstanceOf(ArchiveDomainError);
  });
});

// ---------------------------------------------------------------------------
// Viewer-scoped read filter at the service layer.
// Defense-in-depth: even if a future router mis-wires the procedure, the
// service propagates a `status: 'published'` filter to the repository for
// viewer sessions. Heads / leads / admins continue to receive an empty
// filter (the repo's hardcoded floor still keeps them on published rows).
// ---------------------------------------------------------------------------

describe("viewer scoping", () => {
  function createSpyRepository(): {
    repo: ArchiveRepository;
    listSpy: ReturnType<typeof vi.fn>;
    getSpy: ReturnType<typeof vi.fn>;
  } {
    const listSpy = vi.fn(
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async ArchiveRepository contract (no awaitable work in this stub)
      async () => ({
        items: [structuredClone(latestDetail.summary)],
        nextCursor: null,
      }),
    );
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async ArchiveRepository contract (no awaitable work in this stub)
    const getSpy = vi.fn(async () => structuredClone(latestDetail));
    const repo: ArchiveRepository = {
      listArchiveReports: listSpy,
      getArchiveReport: getSpy,
    };
    return { repo, listSpy, getSpy };
  }

  it("viewer role injects status:published into listArchiveReports filter", async () => {
    const { repo, listSpy } = createSpyRepository();
    const service = new ArchiveService(repo);

    await service.listArchiveReports(undefined, "viewer");

    expect(listSpy).toHaveBeenCalledOnce();
    expect(listSpy).toHaveBeenCalledWith(
      undefined,
      { status: "published" },
      undefined,
    );
  });

  it("viewer role injects status:published into getArchiveReport filter", async () => {
    const { repo, getSpy } = createSpyRepository();
    const service = new ArchiveService(repo);

    await service.getArchiveReport(reportId, "viewer");

    expect(getSpy).toHaveBeenCalledOnce();
    expect(getSpy).toHaveBeenCalledWith(
      reportId,
      { status: "published" },
      undefined,
    );
  });

  it("viewer requesting a non-published row through repository null receives ArchiveDomainError", async () => {
    const repo: ArchiveRepository = {
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async ArchiveRepository contract (no awaitable work in this stub)
      listArchiveReports: vi.fn(async () => ({ items: [], nextCursor: null })),
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async ArchiveRepository contract (no awaitable work in this stub)
      getArchiveReport: vi.fn(async () => null),
    };
    const service = new ArchiveService(repo);

    await expect(
      service.getArchiveReport(
        "99999999-9999-4999-8999-999999999999",
        "viewer",
      ),
    ).rejects.toBeInstanceOf(ArchiveDomainError);
  });

  it("head role passes an empty filter (no status narrowing) to listArchiveReports", async () => {
    const { repo, listSpy } = createSpyRepository();
    const service = new ArchiveService(repo);

    await service.listArchiveReports(undefined, "head");

    expect(listSpy).toHaveBeenCalledOnce();
    expect(listSpy).toHaveBeenCalledWith(undefined, {}, undefined);
  });

  it("lead and admin roles also receive an empty filter (head-equivalent for archive read)", async () => {
    const { repo, listSpy } = createSpyRepository();
    const service = new ArchiveService(repo);

    await service.listArchiveReports(undefined, "lead");
    expect(listSpy).toHaveBeenLastCalledWith(undefined, {}, undefined);

    await service.listArchiveReports(undefined, "admin");
    expect(listSpy).toHaveBeenLastCalledWith(undefined, {}, undefined);
  });

  it("undefined role passes empty filter (legacy contract — repo floor still applies)", async () => {
    const { repo, listSpy } = createSpyRepository();
    const service = new ArchiveService(repo);

    await service.listArchiveReports(undefined, undefined);

    expect(listSpy).toHaveBeenCalledWith(undefined, {}, undefined);
  });
});
