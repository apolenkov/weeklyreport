import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { buildEscalationsFromReadSections } from "../published-report-snapshot";
import {
  mapPrismaToReportSection,
  type PrismaReportSectionWithRelations,
} from "../report-sections/report-sections.prisma-repository";
import { WeeklyReportPrismaRepository } from "./weekly-report.prisma-repository";

function createRepository(findFirst: ReturnType<typeof vi.fn>) {
  const prisma = {
    report: { findFirst },
  } as unknown as PrismaService;

  return new WeeklyReportPrismaRepository(prisma);
}

describe("WeeklyReportPrismaRepository.getActiveReportId", () => {
  it("prefers the latest editable period before published history", async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce({ id: "editable-report-id" });
    const repository = createRepository(findFirst);

    await expect(repository.getActiveReportId()).resolves.toBe(
      "editable-report-id",
    );

    expect(findFirst).toHaveBeenCalledOnce();
    const callArgs = findFirst.mock.calls[0]?.[0] as {
      where: { periodStatus: { in: string[] }; periodStart: { lte: Date } };
      orderBy: { periodStart: string };
      select: { id: boolean };
    };
    expect(callArgs.where.periodStatus).toEqual({ in: ["open", "reopened"] });
    expect(callArgs.where.periodStart.lte).toBeInstanceOf(Date);
    expect(callArgs.orderBy).toEqual({ periodStart: "desc" });
    expect(callArgs.select).toEqual({ id: true });
  });

  it("excludes scheduled-future periods so the current open period wins", async () => {
    // A scheduled-future period carries periodStatus="open" (the enum has no
    // "scheduled" value), so without a started-yet guard the future row would
    // win the periodStart-desc ordering. The lte(now) filter must scope the
    // query so Prisma only returns the current period.
    const currentPeriodId = "current-open-report-id";
    const findFirst = vi.fn().mockResolvedValue({ id: currentPeriodId });
    const repository = createRepository(findFirst);

    await expect(repository.getActiveReportId()).resolves.toBe(currentPeriodId);
    expect(findFirst).toHaveBeenCalledOnce();
    // The DB applies the lte(now) filter, so future rows are excluded and the
    // current (already-started) period is the only editable match.
    const callArgs = findFirst.mock.calls[0]?.[0] as {
      where: { periodStart: { lte: Date } };
    };
    expect(callArgs.where.periodStart.lte).toBeInstanceOf(Date);
  });

  it("falls back to the latest published period when no editable period exists", async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "published-report-id" });
    const repository = createRepository(findFirst);

    await expect(repository.getActiveReportId()).resolves.toBe(
      "published-report-id",
    );

    expect(findFirst).toHaveBeenCalledTimes(2);
    expect(findFirst).toHaveBeenNthCalledWith(2, {
      where: { periodStatus: "published" },
      orderBy: { periodStart: "desc" },
      select: { id: true },
    });
  });

  it("returns null when there are no editable or published periods", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = createRepository(findFirst);

    await expect(repository.getActiveReportId()).resolves.toBeNull();

    expect(findFirst).toHaveBeenCalledTimes(2);
  });
});

// Live-path parity: the live escalations are built by mapping the Prisma row
// via mapPrismaToReportSection and then running the SAME shared builder the
// published-snapshot path uses. This test drives that exact pipeline so a
// regression in either half (mapper or builder) surfaces here.
describe("live escalation pipeline (mapPrismaToReportSection -> builder)", () => {
  const REPORT_ID = "f9665336-7c74-4abc-8f4f-2fb8346d28bb";
  const SECTION_ID = "5b5df58b-b064-4a14-84b2-4ddf8ccef2cd";
  const AUTHOR_ID = "7b5b554c-7b3b-4e2e-90c3-84c2be55d453";
  const OWNED_PRODUCT = "659b2767-0f86-41e2-b025-49730ca010e4";
  const REFERENCED_PRODUCT = "2a223d8b-c4b2-473c-8a7b-15ecc52195c7";
  const STAGE_DEV = "6f99661a-cac6-4d06-bf08-2a14cced554d";
  const STAGE_TEST = "4ff69d14-ec8c-4f1c-b62b-73bee530fc7d";

  function makePrismaRow(): PrismaReportSectionWithRelations {
    return {
      id: SECTION_ID,
      reportId: REPORT_ID,
      authorId: AUTHOR_ID,
      status: "submitted",
      submittedAt: null,
      late: false,
      author: {
        id: AUTHOR_ID,
        name: "Alice Lead",
        role: "lead",
        stageAssignments: [
          {
            userId: AUTHOR_ID,
            stageId: STAGE_DEV,
            projectId: OWNED_PRODUCT,
            project: { id: OWNED_PRODUCT, name: "CRM Portal", archived: false },
            stage: { id: STAGE_DEV, name: "Development", sortOrder: 0 },
          },
          {
            userId: AUTHOR_ID,
            stageId: STAGE_TEST,
            projectId: OWNED_PRODUCT,
            project: { id: OWNED_PRODUCT, name: "CRM Portal", archived: false },
            stage: { id: STAGE_TEST, name: "Testing", sortOrder: 1 },
          },
        ],
      },
      projectStatuses: [],
      stageStatuses: [],
      items: [
        {
          id: "eeb16c80-2f85-48a0-b838-d8096981ddba",
          projectId: OWNED_PRODUCT,
          type: "current",
          text: "ETL pipeline blocked",
          tag: "infra",
          workflowStatus: "blocked",
          carriedOver: false,
          completed: null,
          priorityRank: null,
          stageNames: ["Development", "Testing"],
          project: { name: "CRM Portal" },
        },
      ],
      risks: [
        {
          id: "5b2fe575-86c3-422e-b7ed-5fe858cab7f7",
          projectId: REFERENCED_PRODUCT,
          risk: "Dependency risk",
          impact: "Medium",
          mitigation: "Coordinate",
          severity: "at-risk",
          stageNames: [],
          project: { name: "Shared Platform" },
        },
      ],
      decisions: [],
    } as unknown as PrismaReportSectionWithRelations;
  }

  it("resolves multi-stage names and referenced products on the live path", () => {
    const section = mapPrismaToReportSection(makePrismaRow());
    const escalations = buildEscalationsFromReadSections([section]);

    const blocked = escalations.find((e) => e.type === "blocked");
    expect(blocked?.stageName).toBe("Development, Testing");
    expect(blocked?.productName).toBe("CRM Portal");

    const risk = escalations.find((e) => e.type === "unresolved_risk");
    // Risk references a product the author owns no stage on; the name still
    // resolves via referencedProjects — never "Unknown".
    expect(risk?.productName).toBe("Shared Platform");
    expect(risk?.stageName).toBeNull();
  });
});
