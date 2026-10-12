import type {
  ArchiveReportDetail,
  ArchiveReportSummary,
  ReportSectionReadModel,
} from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import {
  ArchiveDomainError,
  type ArchiveRepository,
  type ArchiveScopeSession,
  ArchiveService,
} from "./archive.service";

const reportId = "22222222-2222-4222-8222-222222222222";

const adminSession: ArchiveScopeSession = {
  role: "admin",
  viewerGroupAccess: [],
};
const viewerSession: ArchiveScopeSession = {
  role: "viewer",
  viewerGroupAccess: [],
};
const headSession: ArchiveScopeSession = {
  role: "head",
  reportingGroupId: "group-1",
  viewerGroupAccess: [],
};

function makeSection(
  reportSectionId: string,
  authorId: string,
  authorName: string,
): ReportSectionReadModel {
  return {
    reportSectionId,
    reportId,
    authorId,
    authorName,
    authorRole: "lead",
    version: 1,
    status: "submitted",
    submittedAt: new Date("2026-04-09T10:00:00.000Z"),
    late: false,
    projects: [],
    referencedProjects: [],
    items: [],
    risks: [],
    decisions: [],
    activities: [],
    reviews: [],
  };
}

const zuluSection = makeSection(
  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "33333333-3333-4333-8333-333333333334",
  "Zulu Lead",
);
const alphaSection = makeSection(
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "33333333-3333-4333-8333-333333333333",
  "Alpha Lead",
);

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
    sections: [zuluSection, alphaSection],
  },
};

function createRepository(
  overrides: Partial<ArchiveRepository> = {},
): ArchiveRepository {
  return {
    getArchiveReport(reportIdInput: string) {
      return Promise.resolve(
        reportIdInput === reportId
          ? { detail: structuredClone(latestDetail), totalSectionCount: 2 }
          : { detail: null, totalSectionCount: 0 },
      );
    },
    listArchiveReports() {
      return Promise.resolve({
        items: [
          structuredClone(olderSummary),
          structuredClone(latestDetail.summary),
        ],
        nextCursor: null,
      });
    },
    ...overrides,
  };
}

describe("ArchiveService", () => {
  it("preserves the repository's archive report order", async () => {
    const service = new ArchiveService(createRepository());
    const result = await service.listArchiveReports(undefined, adminSession);

    expect(result.items.map((item) => item.reportId)).toEqual([
      olderSummary.reportId,
      reportId,
    ]);
    expect(result.nextCursor).toBeNull();
  });

  it("sorts detail sections without mutating the repository result", async () => {
    const repository = createRepository({
      getArchiveReport: vi.fn().mockResolvedValue({
        detail: latestDetail,
        totalSectionCount: 2,
      }),
    });
    const service = new ArchiveService(repository);
    const { detail } = await service.getArchiveReport(reportId, adminSession);

    expect(detail.report.sections.map(({ authorName }) => authorName)).toEqual([
      "Alpha Lead",
      "Zulu Lead",
    ]);
    expect(
      latestDetail.report.sections.map(({ authorName }) => authorName),
    ).toEqual(["Zulu Lead", "Alpha Lead"]);
  });

  it("rejects missing archive detail lookups", async () => {
    const service = new ArchiveService(createRepository());

    await expect(
      service.getArchiveReport(
        "99999999-9999-4999-8999-999999999999",
        adminSession,
      ),
    ).rejects.toBeInstanceOf(ArchiveDomainError);
  });

  // Fail-closed: an absent authz context is a hard error, never a permissive
  // no-scope read. The parameter is mandatory at the type level; this pins the
  // runtime guard that backs it.
  it.each([
    {
      method: "list",
      call: (s: ArchiveService) =>
        s.listArchiveReports(
          undefined,
          undefined as unknown as ArchiveScopeSession,
        ),
    },
    {
      method: "detail",
      call: (s: ArchiveService) =>
        s.getArchiveReport(
          reportId,
          undefined as unknown as ArchiveScopeSession,
        ),
    },
  ] as const)(
    "$method rejects an absent authorization session",
    async ({ call }) => {
      const service = new ArchiveService(createRepository());
      await expect(call(service)).rejects.toThrow(
        "group isolation not enforced",
      );
    },
  );
});

// Service must pass status:published for viewers even if a router mis-wires.
describe("viewer scoping", () => {
  function createSpyRepository(): {
    repo: ArchiveRepository;
    listSpy: ReturnType<typeof vi.fn>;
    getSpy: ReturnType<typeof vi.fn>;
  } {
    const listSpy = vi.fn(() =>
      Promise.resolve({
        items: [structuredClone(latestDetail.summary)],
        nextCursor: null,
      }),
    );
    const getSpy = vi.fn(() =>
      Promise.resolve({
        detail: structuredClone(latestDetail),
        totalSectionCount: 2,
      }),
    );
    const repo: ArchiveRepository = {
      listArchiveReports: listSpy,
      getArchiveReport: getSpy,
    };
    return { repo, listSpy, getSpy };
  }

  it("viewer session injects status:published into listArchiveReports filter", async () => {
    const { repo, listSpy } = createSpyRepository();
    const service = new ArchiveService(repo);

    await service.listArchiveReports(undefined, viewerSession);

    expect(listSpy).toHaveBeenCalledOnce();
    expect(listSpy).toHaveBeenCalledWith(
      undefined,
      { status: "published" },
      viewerSession,
    );
  });

  it("viewer session injects status:published into getArchiveReport filter", async () => {
    const { repo, getSpy } = createSpyRepository();
    const service = new ArchiveService(repo);

    await service.getArchiveReport(reportId, viewerSession);

    expect(getSpy).toHaveBeenCalledOnce();
    expect(getSpy).toHaveBeenCalledWith(
      reportId,
      { status: "published" },
      viewerSession,
    );
  });

  it("viewer requesting a non-published row through repository null receives ArchiveDomainError", async () => {
    const repo: ArchiveRepository = {
      listArchiveReports: vi.fn(() =>
        Promise.resolve({ items: [], nextCursor: null }),
      ),
      getArchiveReport: vi.fn(() =>
        Promise.resolve({ detail: null, totalSectionCount: 0 }),
      ),
    };
    const service = new ArchiveService(repo);

    await expect(
      service.getArchiveReport(
        "99999999-9999-4999-8999-999999999999",
        viewerSession,
      ),
    ).rejects.toBeInstanceOf(ArchiveDomainError);
  });

  it("head session passes an empty filter (no status narrowing) to listArchiveReports", async () => {
    const { repo, listSpy } = createSpyRepository();
    const service = new ArchiveService(repo);

    await service.listArchiveReports(undefined, headSession);

    expect(listSpy).toHaveBeenCalledOnce();
    expect(listSpy).toHaveBeenCalledWith(undefined, {}, headSession);
  });

  it("lead and admin sessions also receive an empty filter (head-equivalent for archive read)", async () => {
    const { repo, listSpy } = createSpyRepository();
    const service = new ArchiveService(repo);
    const leadSession: ArchiveScopeSession = {
      role: "lead",
      reportingGroupId: "group-1",
      viewerGroupAccess: [],
    };

    await service.listArchiveReports(undefined, leadSession);
    expect(listSpy).toHaveBeenLastCalledWith(undefined, {}, leadSession);

    await service.listArchiveReports(undefined, adminSession);
    expect(listSpy).toHaveBeenLastCalledWith(undefined, {}, adminSession);
  });
});
