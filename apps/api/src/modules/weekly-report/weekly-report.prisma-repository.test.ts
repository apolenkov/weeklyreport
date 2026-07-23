import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { buildEscalationsFromReadSections } from "../report-escalations";
import type { PrismaReportSectionWithRelations } from "../report-sections/infrastructure/report-sections.include";
import { mapPrismaToReportSection } from "../report-sections/infrastructure/report-sections.mappers";
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

// The where-shape of the current-editable query — the always-run unit
// counterpart to the real-Prisma integration test. Pins archived:false + the
// editable-only filter + the absence of any published fallback so the gate
// cannot be silently widened.
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
            project: {
              id: OWNED_PRODUCT,
              name: "CRM Portal",
              archived: false,
              stageAssignments: [],
              lead: { reportingGroupId: null },
            },
            stage: { id: STAGE_DEV, name: "Development", sortOrder: 0 },
          },
          {
            userId: AUTHOR_ID,
            stageId: STAGE_TEST,
            projectId: OWNED_PRODUCT,
            project: {
              id: OWNED_PRODUCT,
              name: "CRM Portal",
              archived: false,
              stageAssignments: [],
              lead: { reportingGroupId: null },
            },
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
          recordComments: [],
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
          recordComments: [],
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
          recordComments: [],
        },
      ],
      decisions: [],
      // The generated payload always carries these as real (possibly empty)
      // arrays — the mapper no longer defends against `undefined` here.
      activityStatuses: [],
      sectionReviews: [],
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

// The LIVE (not-yet-published) head/weekly portfolioOverview must floor each
// product card by the section author's own covering risks, the SAME way
// leadSections/escalations are floored — a card path that instead read raw
// `projectStatuses` could ship a green card alongside a red leadSection, a
// self-contradicting payload (owned stage status:null + own covers-all
// blocked risk). This drives the actual repository wiring (getWeeklyReport),
// so a wrong-builder regression surfaces here, not just in a pure-function
// builder test.
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
                  stageAssignments: [],
                  lead: { reportingGroupId: null },
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
              recordComments: [],
            },
          ],
          decisions: [],
          // The generated payload always carries these as real (possibly
          // empty) arrays — the mapper no longer defends against
          // `undefined` here.
          activityStatuses: [],
          sectionReviews: [],
        },
      ],
    };
  }

  // A published report row carrying a valid (parseable) snapshot, so
  // getWeeklyReport takes the snapshot render path — the branch that reads
  // nothing from the live project rows.
  function makePublishedReportRow() {
    return {
      ...makeReportRow(),
      periodStatus: "published",
      publishedSnapshot: {
        reportId: REPORT_ID,
        periodStart: "2026-04-14T00:00:00.000Z",
        periodEnd: "2026-04-18T00:00:00.000Z",
        deadline: "2026-04-17T15:00:00.000Z",
        status: "published",
        publishedAt: null,
        publishedById: null,
        publishedByName: null,
        portfolioOverview: {
          status: "green",
          totals: { green: 0, yellow: 0, red: 0 },
        },
        sections: [],
      },
      sections: [],
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

  it("dispatches leadUsers, projects, and the reminder-policy count concurrently", async () => {
    let releaseUsers: (rows: { id: string }[]) => void = () => {
      /* set below */
    };
    const usersPending = new Promise<{ id: string }[]>((resolve) => {
      releaseUsers = resolve;
    });
    const userFindMany = vi.fn().mockReturnValue(usersPending);
    const projectFindMany = vi.fn().mockResolvedValue([]);
    const reminderPolicyCount = vi.fn().mockResolvedValue(0);
    const prisma = {
      report: { findUnique: vi.fn().mockResolvedValue(makeReportRow()) },
      user: { findMany: userFindMany },
      project: { findMany: projectFindMany },
      reminderPolicy: { count: reminderPolicyCount },
    } as unknown as PrismaService;
    const repository = new WeeklyReportPrismaRepository(prisma);

    const pending = repository.getWeeklyReport(REPORT_ID);
    // Flush pending microtasks so the findUnique await resolves and the
    // Promise.all dispatch runs, without resolving the leadUsers query.
    await new Promise((resolve) => setTimeout(resolve, 0));

    // All three reads were dispatched even though leadUsers is still
    // unresolved — proving Promise.all, not a sequential await chain. The
    // reminder-policy count in particular must be part of the batch, not a
    // subsequent serial await (which would stay unreached while users pend).
    expect(userFindMany).toHaveBeenCalledOnce();
    expect(projectFindMany).toHaveBeenCalledOnce();
    expect(reminderPolicyCount).toHaveBeenCalledOnce();

    releaseUsers([{ id: AUTHOR_ID }]);
    await pending;
  });

  it("includes stageAssignments on the live path and skips the projects query entirely on the published-snapshot path", async () => {
    const projectFindManyLive = vi.fn().mockResolvedValue([]);
    const livePrisma = {
      report: { findUnique: vi.fn().mockResolvedValue(makeReportRow()) },
      user: { findMany: vi.fn().mockResolvedValue([]) },
      project: { findMany: projectFindManyLive },
      reminderPolicy: { count: vi.fn().mockResolvedValue(0) },
    } as unknown as PrismaService;
    await new WeeklyReportPrismaRepository(livePrisma).getWeeklyReport(
      REPORT_ID,
    );

    const liveInclude = projectFindManyLive.mock.calls[0]?.[0] as {
      include: { stageAssignments?: unknown; lead: unknown };
    };
    // The live (non-published) path feeds buildPortfolioOverview, so it must
    // fetch the (relatively heavy) stageAssignments join.
    expect(liveInclude.include.stageAssignments).toBe(true);

    const projectFindManyPublished = vi.fn().mockResolvedValue([]);
    const publishedPrisma = {
      report: {
        findUnique: vi.fn().mockResolvedValue(makePublishedReportRow()),
      },
      user: { findMany: vi.fn().mockResolvedValue([]) },
      project: { findMany: projectFindManyPublished },
      reminderPolicy: { count: vi.fn().mockResolvedValue(0) },
    } as unknown as PrismaService;
    await new WeeklyReportPrismaRepository(publishedPrisma).getWeeklyReport(
      REPORT_ID,
    );

    // The published-snapshot path reads nothing from the live project rows,
    // so the query must not run at all — every signal (cross-group audit,
    // portfolio, escalations) comes from the frozen snapshot.
    expect(projectFindManyPublished).not.toHaveBeenCalled();
  });
});

/**
 * `compiledHistory` is shared across roles, so the viewer-only
 * `periodStatus = "published"` History filter MUST be role-conditional. It
 * applies to BOTH the list query and the archive-count query (else the list
 * and the count disagree for the viewer), so a reopened period (legacy
 * `status="published"`, `periodStatus="reopened"`) is never shown to the
 * viewer as a gate-rejected broken link — while head and lead History stay
 * unchanged (a reopened period still listed + counted).
 */
describe("WeeklyReportPrismaRepository.getCompiledHistory", () => {
  interface QueryArg {
    where: Record<string, unknown>;
  }

  const GROUP_A = "a1111111-1111-4111-8111-111111111111";

  function createHistoryRepository(
    findMany: ReturnType<typeof vi.fn>,
    count: ReturnType<typeof vi.fn>,
  ) {
    const prisma = {
      report: { findMany, count },
    } as unknown as PrismaService;
    return new WeeklyReportPrismaRepository(prisma);
  }

  const viewerSession = {
    userId: "c3333333-3333-4333-8333-333333333333",
    role: "viewer" as const,
    viewerGroupAccess: [GROUP_A],
  };
  const headSession = {
    userId: "e5555555-5555-4555-8555-555555555555",
    role: "head" as const,
    viewerGroupAccess: [],
  };
  const leadSession = {
    userId: "d4444444-4444-4444-8444-444444444444",
    role: "lead" as const,
    reportingGroupId: GROUP_A,
    viewerGroupAccess: [],
  };

  it("applies periodStatus='published' to BOTH the list and archive-count for a viewer", async () => {
    const findMany = vi.fn((_q: QueryArg) => Promise.resolve([] as never[]));
    const count = vi.fn((_q: QueryArg) => Promise.resolve(0));
    const repository = createHistoryRepository(findMany, count);

    await repository.getCompiledHistory(viewerSession, true);

    const listWhere = findMany.mock.calls[0]?.[0].where;
    const countWhere = count.mock.calls[0]?.[0].where;
    expect(listWhere).toMatchObject({ periodStatus: "published" });
    expect(countWhere).toMatchObject({ periodStatus: "published" });
  });

  it("does NOT apply the periodStatus filter for a head (non-regression)", async () => {
    const findMany = vi.fn((_q: QueryArg) => Promise.resolve([] as never[]));
    const count = vi.fn((_q: QueryArg) => Promise.resolve(0));
    const repository = createHistoryRepository(findMany, count);

    await repository.getCompiledHistory(headSession, true);

    expect(findMany.mock.calls[0]?.[0].where).not.toHaveProperty(
      "periodStatus",
    );
    expect(count.mock.calls[0]?.[0].where).not.toHaveProperty("periodStatus");
  });

  it("does NOT apply the periodStatus filter for a lead (non-regression)", async () => {
    const findMany = vi.fn((_q: QueryArg) => Promise.resolve([] as never[]));
    const count = vi.fn((_q: QueryArg) => Promise.resolve(0));
    const repository = createHistoryRepository(findMany, count);

    await repository.getCompiledHistory(leadSession, true);

    const listWhere = findMany.mock.calls[0]?.[0].where;
    expect(listWhere).not.toHaveProperty("periodStatus");
    // Lead History scopes sections by author, unchanged.
    expect(listWhere).toMatchObject({
      sections: { some: { authorId: leadSession.userId } },
    });
  });
});

/**
 * `latestForViewer` resolves the **Status target** for the `/reports/latest`
 * redirect. The resolver MUST:
 *   - target the current editable id when that exact report has a
 *     viewer-visible section;
 *   - NOT search older editable periods — fall to the published path instead;
 *   - otherwise resolve the newest viewer-visible `published` report
 *     (`sections.some(sectionScope)`, `periodStart desc`);
 *   - return `null` when nothing qualifies.
 */
describe("WeeklyReportPrismaRepository.getVisibleReportId / getLatestPublishedVisibleId", () => {
  const GROUP_A = "a1111111-1111-4111-8111-111111111111";
  const CURRENT_ID = "b2222222-2222-4222-8222-222222222222";
  const LEAD_ID = "d4444444-4444-4444-8444-444444444444";

  function createLookupRepository(findFirst: ReturnType<typeof vi.fn>) {
    const prisma = { report: { findFirst } } as unknown as PrismaService;
    return new WeeklyReportPrismaRepository(prisma);
  }

  const viewerSession = {
    userId: "c3333333-3333-4333-8333-333333333333",
    role: "viewer" as const,
    viewerGroupAccess: [GROUP_A],
  };

  it("getVisibleReportId checks the exact id, group-scoped", async () => {
    const findFirst = vi.fn(() => Promise.resolve({ id: CURRENT_ID }));
    const repository = createLookupRepository(findFirst);

    const result = await repository.getVisibleReportId(
      CURRENT_ID,
      viewerSession,
    );

    expect(result).toBe(CURRENT_ID);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: CURRENT_ID,
          sections: {
            some: { author: { reportingGroupId: { in: [GROUP_A] } } },
          },
        },
        select: { id: true },
      }),
    );
  });

  it("getLatestPublishedVisibleId resolves the newest visible published report, group-scoped", async () => {
    const PUBLISHED_ID = "f6666666-6666-4666-8666-666666666666";
    const findFirst = vi.fn(() => Promise.resolve({ id: PUBLISHED_ID }));
    const repository = createLookupRepository(findFirst);

    const result = await repository.getLatestPublishedVisibleId(viewerSession);

    expect(result).toBe(PUBLISHED_ID);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          periodStatus: "published",
          sections: {
            some: { author: { reportingGroupId: { in: [GROUP_A] } } },
          },
        },
        orderBy: [{ periodStart: "desc" }, { id: "desc" }],
        select: { id: true },
      }),
    );
  });

  it("a viewer with no granted groups yields a zero-row section filter", async () => {
    const findFirst = vi.fn(() => Promise.resolve(null));
    const repository = createLookupRepository(findFirst);

    await repository.getLatestPublishedVisibleId({
      ...viewerSession,
      viewerGroupAccess: [],
    });

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          periodStatus: "published",
          sections: { some: { id: { in: [] } } },
        },
      }),
    );
  });

  it("a lead resolves their own authored sections, not a group filter", async () => {
    const findFirst = vi.fn(() => Promise.resolve(null));
    const repository = createLookupRepository(findFirst);

    await repository.getLatestPublishedVisibleId({
      userId: LEAD_ID,
      role: "lead" as const,
      reportingGroupId: GROUP_A,
      viewerGroupAccess: [],
    });

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          periodStatus: "published",
          sections: { some: { authorId: LEAD_ID } },
        },
      }),
    );
  });
});
