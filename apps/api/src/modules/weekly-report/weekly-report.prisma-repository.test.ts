import {
  publishedReportSnapshotSchema,
  type UserSession,
} from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { makeReportSectionReadModel } from "../../test-utils/report-section-fixtures.js";
import {
  buildEscalationsFromReadSections,
  mapPrismaToReportSection,
  type PrismaReportSectionWithRelations,
} from "../report-sections/index.js";
import { WeeklyReportPrismaRepository } from "./weekly-report.prisma-repository";

const adminSession: UserSession = {
  userId: "00000000-0000-4000-8000-000000000001",
  email: "admin@example.test",
  name: "Admin",
  role: "admin",
};

function createRepository(findFirst: ReturnType<typeof vi.fn>) {
  const prisma = {
    report: { findFirst },
  } as unknown as PrismaService;

  return new WeeklyReportPrismaRepository(prisma);
}

// Unit counterpart to the real-Prisma integration test: pins archived:false +
// the editable-only filter + no published fallback, so the gate cannot be
// silently widened.
describe("WeeklyReportPrismaRepository.getCurrentEditableId", () => {
  it("queries editable-only, non-archived, already-started periods, newest-first", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "current-editable-id" });
    const repository = createRepository(findFirst);

    await expect(repository.getCurrentEditableId()).resolves.toBe(
      "current-editable-id",
    );

    // Single query — no published fallback.
    expect(findFirst).toHaveBeenCalledOnce();
    const callArgs = findFirst.mock.calls[0]?.[0] as {
      where: {
        periodStatus?: string;
        periodState?: string;
        status?: string;
        periodStart: { lte: Date };
        archived?: boolean;
        OR: readonly unknown[];
      };
      orderBy: { periodStart?: string; id?: string }[];
      select: { id: boolean };
    };
    expect(callArgs.where.OR).toEqual([
      {
        status: "draft",
        periodStatus: "open",
        periodState: "open",
        archived: false,
      },
      {
        status: "published",
        periodStatus: "reopened",
        periodState: "open",
        archived: false,
      },
    ]);
    expect(callArgs.where.periodStart.lte).toBeInstanceOf(Date);
    // Each exact lifecycle tuple carries archived:false (mutation sentinel:
    // dropping it would let an archived-open row be mistaken for current).
    expect(callArgs.where.OR).toEqual(
      expect.arrayContaining([expect.objectContaining({ archived: false })]),
    );
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

  it("rejects an unscoped interactive current read before querying", () => {
    const findFirst = vi.fn();
    const repository = createRepository(findFirst);

    expect(() =>
      repository.getCurrentEditableIdForSession(
        undefined as unknown as UserSession,
      ),
    ).toThrow("group isolation not enforced");
    expect(findFirst).not.toHaveBeenCalled();
  });
});

describe("WeeklyReportPrismaRepository scoped reads", () => {
  it("rejects a missing session before any weekly-report query", async () => {
    const findUnique = vi.fn();
    const prisma = {
      report: { findUnique },
    } as unknown as PrismaService;
    const repository = new WeeklyReportPrismaRepository(prisma);

    await expect(
      repository.getWeeklyReport(
        "f9665336-7c74-4abc-8f4f-2fb8346d28bb",
        undefined as unknown as UserSession,
      ),
    ).rejects.toThrow("group isolation not enforced");
    expect(findUnique).not.toHaveBeenCalled();
  });
});

// Live path uses the same mapper+builder as the published-snapshot path.
describe("live escalation pipeline (mapPrismaToReportSection -> builder)", () => {
  const REPORT_ID = "f9665336-7c74-4abc-8f4f-2fb8346d28bb";
  const SECTION_ID = "5b5df58b-b064-4a14-84b2-4ddf8ccef2cd";
  const AUTHOR_ID = "7b5b554c-7b3b-4e2e-90c3-84c2be55d453";
  const OWNED_PRODUCT = "659b2767-0f86-41e2-b025-49730ca010e4";
  const REFERENCED_PRODUCT = "2a223d8b-c4b2-473c-8a7b-15ecc52195c7";
  const STAGE_DEV = "6f99661a-cac6-4d06-bf08-2a14cced554d";
  const STAGE_TEST = "4ff69d14-ec8c-4f1c-b62b-73bee530fc7d";
  const PRODUCT_GROUP = "5b5b554c-7b3b-4e2e-90c3-84c2be55d453";

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
              groupProducts: [{ groupId: PRODUCT_GROUP }],
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
              groupProducts: [{ groupId: PRODUCT_GROUP }],
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
        // Blocked escalation is sourced from a blocked-severity risk, not workflowStatus.
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
          stageNames: ["Development"],
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
    expect(risk?.stageName).toBe("Development");
  });
});

// Live portfolioOverview must floor by the author's covering risks like
// leadSections — raw projectStatuses can ship green cards with red sections.
describe("WeeklyReportPrismaRepository.getWeeklyReport live portfolio floor", () => {
  const REPORT_ID = "a1111111-1111-4111-8111-111111111111";
  const SECTION_ID = "a2222222-2222-4222-8222-222222222222";
  const AUTHOR_ID = "a3333333-3333-4333-8333-333333333333";
  const OWNED_PRODUCT = "a4444444-4444-4444-8444-444444444444";
  const UNTOUCHED_PRODUCT = "a5555555-5555-4555-8555-555555555555";
  const STAGE_DEV = "a6666666-6666-4666-8666-666666666666";
  const GROUP_ID = "a7777777-7777-4777-8777-777777777777";

  function makeReportRow(reportingGroupId: string | null = null) {
    return {
      id: REPORT_ID,
      periodStart: new Date("2026-04-14"),
      periodEnd: new Date("2026-04-18"),
      deadline: new Date("2026-04-17T15:00:00.000Z"),
      status: "draft",
      periodState: "open",
      periodStatus: "open",
      archived: false,
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
            reportingGroupId,
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
                  groupProducts: [{ groupId: GROUP_ID }],
                  lead: { reportingGroupId: null },
                },
                stage: { id: STAGE_DEV, name: "Development", sortOrder: 0 },
              },
            ],
          },
          // Stale green ProjectStatus with no stage status — floor must override.
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
          // A blocked risk on the owned stage floors the product to red.
          risks: [
            {
              id: "a7777777-7777-4777-8777-777777777777",
              projectId: OWNED_PRODUCT,
              risk: "Vendor outage",
              impact: "High",
              mitigation: "Escalate",
              severity: "blocked",
              stageNames: ["Development"],
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
    const publishedAt = new Date("2026-04-18T18:00:00.000Z");
    return {
      ...makeReportRow(),
      periodStatus: "published",
      publishedAt,
      publishedSnapshot: {
        reportId: REPORT_ID,
        periodStart: "2026-04-14T00:00:00.000Z",
        periodEnd: "2026-04-18T00:00:00.000Z",
        deadline: "2026-04-17T15:00:00.000Z",
        status: "published",
        publishedAt: publishedAt.toISOString(),
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

  function createRepository(
    reportRow = makeReportRow(),
    reminderRuleFindFirst = vi.fn().mockResolvedValue(null),
  ) {
    const prisma = {
      report: {
        findUnique: vi.fn().mockResolvedValue(reportRow),
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
      reminderRule: { findFirst: reminderRuleFindFirst },
    } as unknown as PrismaService;

    return new WeeklyReportPrismaRepository(prisma);
  }

  it("floors the owned product card red and keeps the untouched product card null", async () => {
    const repository = createRepository();
    const result = await repository.getWeeklyReport(REPORT_ID, adminSession);

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

  it("does not expose manual Remind capability for an escalation-only rule", async () => {
    const deadline = makeReportRow().deadline;
    const reminderRuleFindFirst = vi.fn().mockResolvedValue({
      id: "a0000000-0000-4000-a000-000000000601",
      fireAt: new Date(deadline.getTime() - 180 * 60_000),
      timezone: "Europe/Moscow",
      policy: {
        id: "policy-escalation",
        kind: "escalation",
        offsetMinutes: -180,
        timezone: "Europe/Moscow",
        audience: "HEAD_OF_LATE",
        active: true,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
        validUntil: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    const result = await createRepository(
      makeReportRow(),
      reminderRuleFindFirst,
    ).getWeeklyReport(REPORT_ID, adminSession);

    expect(result?.readModel.activeDeadlineReminderRuleId).toBeNull();
    const ruleQuery = reminderRuleFindFirst.mock.calls[0]?.[0] as unknown as {
      where: Record<string, unknown> & { report: Record<string, unknown> };
      orderBy: Record<string, unknown>;
      select: Record<string, unknown>;
    };
    expect(ruleQuery.where).toMatchObject({
      reportId: REPORT_ID,
      kind: "deadline",
      status: "active",
    });
    expect(ruleQuery.where.report).toMatchObject({
      archived: false,
      periodState: "open",
      OR: [
        { status: "draft", periodStatus: "open" },
        { status: "published", periodStatus: "reopened" },
      ],
    });
    expect(ruleQuery).toMatchObject({
      orderBy: { version: "desc" },
      select: {
        id: true,
        fireAt: true,
        timezone: true,
        policy: true,
      },
    });
  });

  it("fails closed when a published report has no immutable snapshot", async () => {
    const repository = createRepository({
      ...makeReportRow(),
      periodStatus: "published",
    });

    await expect(
      repository.getWeeklyReport(REPORT_ID, adminSession),
    ).rejects.toThrow("Published snapshot integrity failure");
  });

  it("fails closed when a published snapshot is malformed", async () => {
    const repository = createRepository({
      ...makeReportRow(),
      periodStatus: "published",
      publishedSnapshot: {} as never,
    });

    await expect(
      repository.getWeeklyReport(REPORT_ID, adminSession),
    ).rejects.toThrow("Published snapshot integrity failure");
  });

  it("does not expose an unauthorized published report envelope", async () => {
    const findUnique = vi.fn().mockResolvedValue(makePublishedReportRow());
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = new WeeklyReportPrismaRepository({
      report: { findUnique, findFirst },
    } as unknown as PrismaService);
    const headSession: UserSession = {
      userId: "00000000-0000-4000-8000-000000000002",
      email: "head@example.test",
      name: "Head",
      role: "head",
      reportingGroupId: "00000000-0000-4000-8000-000000000099",
    };

    await expect(
      repository.getWeeklyReport(REPORT_ID, headSession),
    ).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: REPORT_ID,
        publishedSectionScopes: {
          some: {
            groupId: { in: [headSession.reportingGroupId] },
          },
        },
      },
      select: { id: true },
    });
  });

  it("fails closed when an admitted published report has no scoped snapshot sections", async () => {
    const findUnique = vi.fn().mockResolvedValue(makePublishedReportRow());
    const findFirst = vi.fn().mockResolvedValue({ id: REPORT_ID });
    const repository = new WeeklyReportPrismaRepository({
      report: { findUnique, findFirst },
    } as unknown as PrismaService);
    const headSession: UserSession = {
      userId: "00000000-0000-4000-8000-000000000002",
      email: "head@example.test",
      name: "Head",
      role: "head",
      reportingGroupId: "00000000-0000-4000-8000-000000000099",
    };

    await expect(
      repository.getWeeklyReport(REPORT_ID, headSession),
    ).rejects.toThrow("Published snapshot integrity failure");
  });

  it("fails closed when a live read races with an unauthorized republish", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce(makeReportRow())
      .mockResolvedValueOnce(makePublishedReportRow());
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = new WeeklyReportPrismaRepository({
      report: { findUnique, findFirst },
    } as unknown as PrismaService);
    const headSession: UserSession = {
      userId: "00000000-0000-4000-8000-000000000002",
      email: "head@example.test",
      name: "Head",
      role: "head",
      reportingGroupId: "00000000-0000-4000-8000-000000000099",
    };

    await expect(
      repository.getWeeklyReport(REPORT_ID, headSession),
    ).resolves.toBeNull();
    expect(findUnique).toHaveBeenCalledTimes(2);
    expect(findFirst).toHaveBeenCalledOnce();
  });

  it("requires a fresh request after an admitted republish race", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce(makeReportRow())
      .mockResolvedValueOnce(makePublishedReportRow());
    const findFirst = vi.fn().mockResolvedValue({ id: REPORT_ID });
    const repository = new WeeklyReportPrismaRepository({
      report: { findUnique, findFirst },
    } as unknown as PrismaService);
    const headSession: UserSession = {
      userId: "00000000-0000-4000-8000-000000000002",
      email: "head@example.test",
      name: "Head",
      role: "head",
      reportingGroupId: "00000000-0000-4000-8000-000000000001",
    };

    await expect(
      repository.getWeeklyReport(REPORT_ID, headSession),
    ).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledOnce();
  });

  it("batches live group metadata and stamps the section with its name", async () => {
    const report = makeReportRow(GROUP_ID);
    const groupFindMany = vi
      .fn()
      .mockResolvedValue([{ id: GROUP_ID, name: "Finance Platforms" }]);
    const prisma = {
      report: { findUnique: vi.fn().mockResolvedValue(report) },
      user: { findMany: vi.fn().mockResolvedValue([{ id: AUTHOR_ID }]) },
      project: { findMany: vi.fn().mockResolvedValue([]) },
      reminderRule: { findFirst: vi.fn().mockResolvedValue(null) },
      reportingGroup: { findMany: groupFindMany },
    } as unknown as PrismaService;

    const result = await new WeeklyReportPrismaRepository(
      prisma,
    ).getWeeklyReport(REPORT_ID, adminSession);

    expect(result?.readModel.leadSections[0]?.groupName).toBe(
      "Finance Platforms",
    );
    expect(groupFindMany).toHaveBeenCalledWith({
      where: { id: { in: [GROUP_ID] } },
      select: { id: true, name: true },
    });
  });

  it("dispatches leadUsers, projects, and the deadline-rule lookup concurrently", async () => {
    const { promise: usersPending, resolve: releaseUsers } =
      Promise.withResolvers<{ id: string }[]>();
    const userFindMany = vi.fn().mockReturnValue(usersPending);
    const projectFindMany = vi.fn().mockResolvedValue([]);
    const reminderRuleFindFirst = vi.fn().mockResolvedValue(null);
    const prisma = {
      report: { findUnique: vi.fn().mockResolvedValue(makeReportRow()) },
      user: { findMany: userFindMany },
      project: { findMany: projectFindMany },
      reminderRule: { findFirst: reminderRuleFindFirst },
    } as unknown as PrismaService;
    const repository = new WeeklyReportPrismaRepository(prisma);

    const pending = repository.getWeeklyReport(REPORT_ID, adminSession);
    // Flush pending microtasks so the findUnique await resolves and the
    // Promise.all dispatch runs, without resolving the leadUsers query.
    await new Promise((resolve) => setTimeout(resolve, 0));

    // All three reads dispatched while leadUsers is unresolved — proving
    // Promise.all, not a sequential await chain; the rule lookup must be in
    // the batch, not a later serial await.
    expect(userFindMany).toHaveBeenCalledOnce();
    expect(projectFindMany).toHaveBeenCalledOnce();
    expect(reminderRuleFindFirst).toHaveBeenCalledOnce();

    releaseUsers([{ id: AUTHOR_ID }]);
    await pending;
  });

  it("keeps the live result coherent when publication commits after lifecycle recheck", async () => {
    let publicationCommitted = false;
    const report = makeReportRow();
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce(report)
      .mockImplementationOnce(() => {
        // This is the existing lifecycle/section recheck. A concurrent
        // publisher commits immediately after it; dependency reads below
        // must still belong to the same RepeatableRead snapshot.
        publicationCommitted = true;
        return report;
      });
    const userFindMany = vi.fn().mockResolvedValue([{ id: AUTHOR_ID }]);
    const projectFindMany = vi.fn().mockResolvedValue([]);
    const reminderRuleFindFirst = vi.fn().mockResolvedValue(null);
    const tx = {
      report: { findUnique, findFirst: vi.fn() },
      user: { findMany: userFindMany },
      project: { findMany: projectFindMany },
      reminderRule: { findFirst: reminderRuleFindFirst },
      reportingGroup: { findMany: vi.fn().mockResolvedValue([]) },
      viewerGroupAccess: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const prisma = {
      ...tx,
      $transaction: vi.fn(
        (callback: (client: typeof tx) => unknown, options: unknown) => {
          expect(options).toEqual({ isolationLevel: "RepeatableRead" });
          return callback(tx);
        },
      ),
    } as unknown as PrismaService;

    const result = await new WeeklyReportPrismaRepository(
      prisma,
    ).getWeeklyReport(REPORT_ID, adminSession);

    expect(publicationCommitted).toBe(true);
    expect(result?.readModel.leadSections).toHaveLength(1);
    expect(result?.readModel.periodStatus).toBe("open");
    expect(userFindMany).toHaveBeenCalledOnce();
    expect(projectFindMany).toHaveBeenCalledOnce();
    expect(reminderRuleFindFirst).toHaveBeenCalledOnce();
  });

  it("includes stageAssignments on the live path and skips the projects query entirely on the published-snapshot path", async () => {
    const projectFindManyLive = vi.fn().mockResolvedValue([]);
    const livePrisma = {
      report: { findUnique: vi.fn().mockResolvedValue(makeReportRow()) },
      user: { findMany: vi.fn().mockResolvedValue([]) },
      project: { findMany: projectFindManyLive },
      reminderRule: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    await new WeeklyReportPrismaRepository(livePrisma).getWeeklyReport(
      REPORT_ID,
      adminSession,
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
      reminderRule: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    await new WeeklyReportPrismaRepository(publishedPrisma).getWeeklyReport(
      REPORT_ID,
      adminSession,
    );

    // The published-snapshot path reads nothing from the live project rows,
    // so the query must not run at all — every signal (cross-group audit,
    // portfolio, escalations) comes from the frozen snapshot.
    expect(projectFindManyPublished).not.toHaveBeenCalled();
    expect(publishedPrisma.report.findUnique).toHaveBeenCalledOnce();
    expect(publishedPrisma.report.findUnique).toHaveBeenCalledWith({
      where: { id: REPORT_ID },
    });
  });
});

// Status-target resolution for /reports/latest — exact editable id or newest published.
describe("WeeklyReportPrismaRepository.getVisibleReportId / getLatestPublishedVisibleId", () => {
  const GROUP_A = "a1111111-1111-4111-8111-111111111111";
  const CURRENT_ID = "b2222222-2222-4222-8222-222222222222";
  const LEAD_ID = "d4444444-4444-4444-8444-444444444444";

  function createLookupRepository(reportQueries: {
    readonly findFirst?: ReturnType<typeof vi.fn>;
  }) {
    const prisma = { report: reportQueries } as unknown as PrismaService;
    return new WeeklyReportPrismaRepository(prisma);
  }

  function publishedLookupRow(groupId = GROUP_A, authorId = LEAD_ID) {
    const publishedAt = new Date("2026-04-18T18:00:00.000Z");
    return {
      id: "f6666666-6666-4666-8666-666666666666",
      publishedSnapshot: publishedReportSnapshotSchema.parse({
        reportId: "f6666666-6666-4666-8666-666666666666",
        periodStart: new Date("2026-04-14T00:00:00.000Z"),
        periodEnd: new Date("2026-04-18T00:00:00.000Z"),
        deadline: null,
        status: "published",
        publishedAt,
        publishedById: null,
        publishedByName: "system",
        portfolioOverview: {
          status: "green",
          totals: { green: 0, yellow: 0, red: 0 },
        },
        sections: [
          {
            ...makeReportSectionReadModel({
              reportSectionId: "e5555555-5555-4555-8555-555555555555",
              reportId: "f6666666-6666-4666-8666-666666666666",
              authorId,
            }),
            groupId,
            groupName: "Frozen Group",
          },
        ],
      }),
    };
  }

  const viewerSession: UserSession = {
    userId: "c3333333-3333-4333-8333-333333333333",
    email: "viewer@example.test",
    name: "Viewer",
    role: "viewer" as const,
    viewerGroupAccess: [GROUP_A],
  };

  it("getVisibleReportId checks the exact id, group-scoped", async () => {
    const findFirst = vi.fn((_args: unknown) =>
      Promise.resolve({ id: CURRENT_ID }),
    );
    const repository = createLookupRepository({ findFirst });

    const result = await repository.getVisibleReportId(
      CURRENT_ID,
      viewerSession,
    );

    expect(result).toBe(CURRENT_ID);
    const lookupQuery = findFirst.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      select: Record<string, unknown>;
    };
    expect(lookupQuery.where).toMatchObject({
      id: CURRENT_ID,
      sections: {
        some: { author: { reportingGroupId: { in: [GROUP_A] } } },
      },
    });
    expect(lookupQuery.select).toEqual({ id: true });
  });

  it("getLatestPublishedVisibleId resolves the newest visible published report from frozen scope", async () => {
    const PUBLISHED_ID = "f6666666-6666-4666-8666-666666666666";
    const findFirst = vi.fn(() => Promise.resolve(publishedLookupRow()));
    const repository = createLookupRepository({ findFirst });

    const result = await repository.getLatestPublishedVisibleId(viewerSession);

    expect(result).toBe(PUBLISHED_ID);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          periodStatus: "published",
          archived: false,
          publishedSectionScopes: {
            some: { groupId: { in: [GROUP_A] } },
          },
        },
        orderBy: [{ periodStart: "desc" }, { id: "desc" }],
        select: { id: true, publishedSnapshot: true },
      }),
    );
  });

  it("a viewer with no granted groups rejects every frozen candidate", async () => {
    const findFirst = vi.fn(() => Promise.resolve(null));
    const repository = createLookupRepository({ findFirst });

    await expect(
      repository.getLatestPublishedVisibleId({
        ...viewerSession,
        viewerGroupAccess: [],
      }),
    ).resolves.toBeNull();

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          periodStatus: "published",
          archived: false,
          publishedSectionScopes: {
            some: { reportId: { in: [] } },
          },
        },
      }),
    );
  });

  it("a lead resolves their own frozen authored section", async () => {
    const findFirst = vi.fn(() =>
      Promise.resolve(publishedLookupRow(GROUP_A, LEAD_ID)),
    );
    const repository = createLookupRepository({ findFirst });

    await expect(
      repository.getLatestPublishedVisibleId({
        userId: LEAD_ID,
        email: "lead@example.test",
        name: "Lead",
        role: "lead" as const,
        reportingGroupId: GROUP_A,
        viewerGroupAccess: [],
      }),
    ).resolves.toBe("f6666666-6666-4666-8666-666666666666");

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          periodStatus: "published",
          archived: false,
          publishedSectionScopes: { some: { authorId: LEAD_ID } },
        },
      }),
    );
  });
});
