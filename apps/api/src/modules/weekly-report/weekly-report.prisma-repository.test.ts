import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { buildEscalationsFromReadSections } from "../report-escalations";
import {
  mapPrismaToReportSection,
  type PrismaReportSectionWithRelations,
} from "../report-sections/infrastructure/report-sections.prisma-repository";
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

// viewer-live-status (task 0.2, fast feedback): the where-shape of the
// current-editable query — the always-run unit counterpart to the real-Prisma
// integration test. Pins archived:false + the editable-only filter + the
// absence of any published fallback so the gate cannot be silently widened.
describe("WeeklyReportPrismaRepository.getCurrentEditableId", () => {
  it("queries editable-only, non-archived, already-started periods, newest-first", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "current-editable-id" });
    const repository = createRepository(findFirst);

    await expect(repository.getCurrentEditableId()).resolves.toBe(
      "current-editable-id",
    );

    // Single query — NO published fallback (unlike getActiveReportId).
    expect(findFirst).toHaveBeenCalledOnce();
    const callArgs = findFirst.mock.calls[0]?.[0] as {
      where: {
        periodStatus: { in: string[] };
        periodStart: { lte: Date };
        archived: boolean;
      };
      orderBy: { periodStart?: string; id?: string }[];
      select: { id: boolean };
    };
    expect(callArgs.where.periodStatus).toEqual({ in: ["open", "reopened"] });
    expect(callArgs.where.periodStart.lte).toBeInstanceOf(Date);
    // The archived:false guard (mutation sentinel: dropping it would let an
    // archived-open row be mistaken for the current period).
    expect(callArgs.where.archived).toBe(false);
    // Deterministic order: periodStart desc, then id desc as a total-order
    // tiebreak so concurrent same-periodStart periods resolve to one stable id.
    expect(callArgs.orderBy).toEqual([{ periodStart: "desc" }, { id: "desc" }]);
    expect(callArgs.select).toEqual({ id: true });
  });

  it("returns null with NO published fallback when no editable period exists", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = createRepository(findFirst);

    await expect(repository.getCurrentEditableId()).resolves.toBeNull();

    // Exactly one call: a null result must NOT fall through to a published query.
    expect(findFirst).toHaveBeenCalledOnce();
  });
});

// viewer-live-status: the newest-published resolver used as the viewer's
// default-report fallback. Pins periodStatus=published + the deterministic
// periodStart/id ordering.
describe("WeeklyReportPrismaRepository.getLatestPublishedId", () => {
  it("queries the newest published report with a deterministic id tiebreak", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "published-id" });
    const repository = createRepository(findFirst);

    await expect(repository.getLatestPublishedId()).resolves.toBe(
      "published-id",
    );

    expect(findFirst).toHaveBeenCalledOnce();
    const callArgs = findFirst.mock.calls[0]?.[0] as {
      where: { periodStatus: string };
      orderBy: { periodStart?: string; id?: string }[];
      select: { id: boolean };
    };
    expect(callArgs.where.periodStatus).toBe("published");
    expect(callArgs.orderBy).toEqual([{ periodStart: "desc" }, { id: "desc" }]);
    expect(callArgs.select).toEqual({ id: true });
  });

  it("returns null when no published report exists", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = createRepository(findFirst);

    await expect(repository.getLatestPublishedId()).resolves.toBeNull();
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
      version: 1,
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
          text: "ETL pipeline work",
          tag: "infra",
          workflowStatus: "in_progress",
          carriedOver: false,
          completed: null,
          priorityRank: null,
          stageNames: ["Development", "Testing"],
          project: { name: "CRM Portal" },
        },
      ],
      risks: [
        // record-status-derived-from-risk: the blocked escalation is sourced from
        // a blocked-severity risk (multi-stage), not the item's workflowStatus.
        {
          id: "c1a1b2c3-d4e5-4f60-9a71-0b1c2d3e4f50",
          projectId: OWNED_PRODUCT,
          risk: "ETL pipeline blocked",
          impact: "High",
          mitigation: "Await fix",
          severity: "blocked",
          stageNames: ["Development", "Testing"],
          project: { name: "CRM Portal" },
        },
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

// fix-published-empty-stage-risk-floor: the LIVE (not-yet-published)
// head/weekly portfolioOverview must floor each product card by the section
// author's own covering risks, the SAME way leadSections/escalations are
// floored. Before the fix this card path read raw `projectStatuses`, so the
// bug case (owned stage status:null + own covers-all blocked risk) shipped a
// green card alongside a red leadSection — a self-contradicting payload. This
// drives the actual repository wiring (getWeeklyReport), so a wrong-builder
// regression surfaces here, not just in a pure-function builder test.
describe("WeeklyReportPrismaRepository.getWeeklyReport live portfolio floor", () => {
  const REPORT_ID = "a1111111-1111-4111-8111-111111111111";
  const SECTION_ID = "a2222222-2222-4222-8222-222222222222";
  const AUTHOR_ID = "a3333333-3333-4333-8333-333333333333";
  const OWNED_PRODUCT = "a4444444-4444-4444-8444-444444444444";
  const UNTOUCHED_PRODUCT = "a5555555-5555-4555-8555-555555555555";
  const STAGE_DEV = "a6666666-6666-4666-8666-666666666666";

  function makeReportRow() {
    return {
      id: REPORT_ID,
      periodStart: new Date("2026-04-14"),
      periodEnd: new Date("2026-04-18"),
      deadline: new Date("2026-04-17T15:00:00.000Z"),
      periodStatus: "open",
      weekLabel: "W16-2026",
      publishedSnapshot: null,
      sections: [
        {
          id: SECTION_ID,
          reportId: REPORT_ID,
          authorId: AUTHOR_ID,
          status: "submitted",
          submittedAt: null,
          late: false,
          version: 1,
          author: {
            id: AUTHOR_ID,
            name: "Alice Lead",
            role: "lead",
            stageAssignments: [
              {
                userId: AUTHOR_ID,
                stageId: STAGE_DEV,
                projectId: OWNED_PRODUCT,
                project: {
                  id: OWNED_PRODUCT,
                  name: "CRM Portal",
                  archived: false,
                },
                stage: { id: STAGE_DEV, name: "Development", sortOrder: 0 },
              },
            ],
          },
          // Owned stage carries NO submitted stage status, but a STALE green
          // ProjectStatus persists (the raw trafficLight the old card read).
          // This is the finding's exact case: the old builder emitted that
          // stale green while leadSections were floored red.
          projectStatuses: [
            {
              projectId: OWNED_PRODUCT,
              status: "green",
              project: {
                id: OWNED_PRODUCT,
                name: "CRM Portal",
                archived: false,
              },
            },
          ],
          stageStatuses: [],
          items: [],
          // ...but the author's own covers-all (empty stageNames) BLOCKED risk
          // floors the product to red.
          risks: [
            {
              id: "a7777777-7777-4777-8777-777777777777",
              projectId: OWNED_PRODUCT,
              risk: "Vendor outage",
              impact: "High",
              mitigation: "Escalate",
              severity: "blocked",
              stageNames: [],
              project: { name: "CRM Portal" },
            },
          ],
          decisions: [],
        },
      ],
    };
  }

  function createRepository() {
    const prisma = {
      report: {
        findUnique: vi.fn().mockResolvedValue(makeReportRow()),
      },
      user: { findMany: vi.fn().mockResolvedValue([{ id: AUTHOR_ID }]) },
      project: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: OWNED_PRODUCT,
            name: "CRM Portal",
            stageAssignments: [{ id: STAGE_DEV }],
            lead: { reportingGroupId: null },
          },
          // A group-owned product no lead has touched: must still get a card
          // (null status), pinning the membership the snapshot builder would
          // otherwise drop.
          {
            id: UNTOUCHED_PRODUCT,
            name: "Legacy Tool",
            stageAssignments: [],
            lead: { reportingGroupId: null },
          },
        ]),
      },
      reminderPolicy: { count: vi.fn().mockResolvedValue(0) },
    } as unknown as PrismaService;

    return new WeeklyReportPrismaRepository(prisma);
  }

  it("floors the owned product card red and keeps the untouched product card null", async () => {
    const repository = createRepository();
    const result = await repository.getWeeklyReport(REPORT_ID);

    const cards = result?.readModel.portfolioOverview ?? [];
    const owned = cards.find((c) => c.productId === OWNED_PRODUCT);
    const untouched = cards.find((c) => c.productId === UNTOUCHED_PRODUCT);

    // The card agrees with the floored leadSection in the SAME payload.
    expect(owned?.worstStatus).toBe("red");
    const leadProduct = result?.readModel.leadSections[0]?.projects.find(
      (p) => p.projectId === OWNED_PRODUCT,
    );
    expect(leadProduct?.trafficLight).toBe("red");

    // Membership: a group-owned product no lead touched still gets a card.
    expect(untouched).toBeDefined();
    expect(untouched?.worstStatus).toBeNull();
  });

  it("dispatches the leadUsers and projects queries concurrently", async () => {
    let releaseUsers: (rows: { id: string }[]) => void = () => {
      /* set below */
    };
    const usersPending = new Promise<{ id: string }[]>((resolve) => {
      releaseUsers = resolve;
    });
    const userFindMany = vi.fn().mockReturnValue(usersPending);
    const projectFindMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      report: { findUnique: vi.fn().mockResolvedValue(makeReportRow()) },
      user: { findMany: userFindMany },
      project: { findMany: projectFindMany },
      reminderPolicy: { count: vi.fn().mockResolvedValue(0) },
    } as unknown as PrismaService;
    const repository = new WeeklyReportPrismaRepository(prisma);

    const pending = repository.getWeeklyReport(REPORT_ID);
    // Flush pending microtasks so the findUnique await resolves and the
    // Promise.all dispatch runs, without resolving the leadUsers query.
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Projects were dispatched even though leadUsers is still unresolved —
    // proving Promise.all, not a sequential await chain.
    expect(userFindMany).toHaveBeenCalledOnce();
    expect(projectFindMany).toHaveBeenCalledOnce();

    releaseUsers([{ id: AUTHOR_ID }]);
    await pending;
  });
});
