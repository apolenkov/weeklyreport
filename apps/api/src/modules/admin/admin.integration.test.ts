import { randomUUID } from "node:crypto";

import {
  buildPublishedProjections,
  composeName,
  publishedReportSnapshotSchema,
  type ReminderPolicy,
  type ReminderQueuePayload,
} from "@customreport/shared";
import { Prisma, type PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../lib/logger";
import { AdminUserActivityAssignmentConflictError } from "../../lib/user-activity-assignment.js";
import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  createPauseGate,
  pauseBeforeTransaction,
} from "../../test-utils/paused-prisma.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  publishedSnapshotFixture,
  seedTestData,
  TEST_IDS,
} from "../../test-utils/prisma-test-helper";
import { PeriodPrismaRepository } from "../period/infrastructure/period.prisma-repository.js";
import {
  lockAllReminderPolicies,
  PolicyApplicatorService,
  RemindersPrismaRepository,
  RemindersService,
} from "../reminders/index.js";
import { WeeklyReportPrismaRepository } from "../weekly-report/weekly-report.prisma-repository.js";
import { AdminPrismaRepository } from "./admin.prisma-repository";
import { archivePeriod } from "./admin-period-lifecycle";
import {
  AdminAccessError,
  AdminPeriodNotFoundError,
  AdminPeriodStaleStateError,
  AdminSnapshotConflictError,
} from "./admin-shared.js";
import { lockRestoredReports } from "./admin-snapshot/period-locks.js";
import { lockReminderRestoreGraph } from "./admin-snapshot/reminder-locks.js";
import { PeriodAdminService } from "./period-admin.service.js";

describe("AdminPrismaRepository (integration)", () => {
  const prisma = createTestPrisma();
  const repo = new AdminPrismaRepository(prisma as never);
  // Re-seeded per test after cleanDatabase, so the binding has to be mutable.
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeEach(async () => {
    await cleanDatabase();
    testData = await seedTestData(prisma);
  });

  type PublishedSnapshotOverrides = Pick<
    Parameters<typeof publishedSnapshotFixture>[0],
    "publishedAt"
  > &
    Partial<
      Omit<
        Parameters<typeof publishedSnapshotFixture>[0],
        "reportId" | "periodStart" | "periodEnd" | "publishedAt"
      >
    >;
  const publishedSnapshot = (overrides: PublishedSnapshotOverrides) =>
    publishedSnapshotFixture({
      reportId: testData.report.id,
      periodStart: testData.report.periodStart,
      periodEnd: testData.report.periodEnd,
      ...overrides,
    });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("deletes a draft report and cascades its dependent rows", async () => {
    await repo.deleteReport(testData.report.id);

    await expect(
      prisma.report.findUnique({ where: { id: testData.report.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.reportSection.count({ where: { reportId: testData.report.id } }),
    ).resolves.toBe(0);
  });

  it("deletes carry-over lineage when the report is the source", async () => {
    const target = await prisma.report.create({
      data: {
        periodStart: new Date("2026-04-20T00:00:00.000Z"),
        periodEnd: new Date("2026-04-26T23:59:59.999Z"),
      },
    });
    const execution = await prisma.carryOverExecution.create({
      data: {
        sourceReportId: testData.report.id,
        targetReportId: target.id,
        dedupeKey: `${testData.report.id}:${target.id}`,
      },
    });
    await prisma.carryOverRecord.create({
      data: { executionId: execution.id, recordType: "item" },
    });

    await repo.deleteReport(testData.report.id);

    await expect(
      prisma.carryOverExecution.findUnique({ where: { id: execution.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.carryOverRecord.count({ where: { executionId: execution.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.report.findUnique({ where: { id: target.id } }),
    ).resolves.not.toBeNull();
  });

  it("deletes carry-over lineage when the report is the target", async () => {
    const source = await prisma.report.create({
      data: {
        periodStart: new Date("2026-03-30T00:00:00.000Z"),
        periodEnd: new Date("2026-04-05T23:59:59.999Z"),
      },
    });
    const execution = await prisma.carryOverExecution.create({
      data: {
        sourceReportId: source.id,
        targetReportId: testData.report.id,
        dedupeKey: `${source.id}:${testData.report.id}`,
      },
    });
    await prisma.carryOverRecord.create({
      data: { executionId: execution.id, recordType: "decision" },
    });

    await repo.deleteReport(testData.report.id);

    await expect(
      prisma.carryOverExecution.findUnique({ where: { id: execution.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.carryOverRecord.count({ where: { executionId: execution.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.report.findUnique({ where: { id: source.id } }),
    ).resolves.not.toBeNull();
  });

  it.each([
    [
      "published",
      {
        status: "published",
        periodStatus: "published",
        periodState: "published",
      },
    ],
    ["archived", { archived: true, periodState: "archived" }],
  ] as const)("does not delete a %s report", async (_label, data) => {
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        ...data,
        ...("status" in data
          ? {
              publishedAt: new Date("2026-04-13T15:00:00.000Z"),
              publishedSnapshot: publishedSnapshot({
                publishedAt: new Date("2026-04-13T15:00:00.000Z"),
              }),
            }
          : {}),
      },
    });

    await expect(repo.deleteReport(testData.report.id)).rejects.toBeInstanceOf(
      AdminAccessError,
    );
    await expect(
      prisma.report.findUnique({ where: { id: testData.report.id } }),
    ).resolves.not.toBeNull();
  });

  it("rejects deletion when publication wins before the guarded transaction", async () => {
    const gate = createPauseGate();
    const pausedRepo = new AdminPrismaRepository(
      pauseBeforeTransaction(prisma, gate.pause) as never,
    );
    const deletion = pausedRepo.deleteReport(testData.report.id);
    await gate.paused;

    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: "published",
        periodStatus: "published",
        periodState: "published",
        publishedAt: new Date("2026-04-13T15:00:00.000Z"),
        publishedSnapshot: publishedSnapshot({
          publishedAt: new Date("2026-04-13T15:00:00.000Z"),
        }),
      },
    });
    gate.release();

    await expect(deletion).rejects.toBeInstanceOf(AdminAccessError);
    await expect(
      prisma.report.findUnique({ where: { id: testData.report.id } }),
    ).resolves.not.toBeNull();
  });

  it.each([
    [
      "publication",
      {
        status: "published" as const,
        periodStatus: "published" as const,
        periodState: "published" as const,
        publishedAt: new Date("2026-08-07T15:00:00.000Z"),
        expectedArchived: false,
      },
    ],
    [
      "archive",
      {
        archived: true,
        periodState: "archived" as const,
        expectedArchived: true,
      },
    ],
  ] as const)(
    "rejects a manual envelope edit when %s wins the race",
    async (_label, data) => {
      const gate = createPauseGate();
      const pausedPrisma = pauseBeforeTransaction(prisma, gate.pause);
      const service = new PeriodAdminService(
        new AdminPrismaRepository(pausedPrisma as never),
        createNullLogger(),
      );
      const originalEnd = testData.report.periodEnd;
      const update = service.updatePeriodManual({
        reportId: testData.report.id,
        periodEnd: new Date("2026-08-16T23:59:59.999Z"),
      });
      await gate.paused;

      const { expectedArchived, ...lifecycleData } = data;
      await prisma.report.update({
        where: { id: testData.report.id },
        data: {
          ...lifecycleData,
          ...("status" in lifecycleData
            ? {
                publishedSnapshot: publishedSnapshot({
                  publishedAt: lifecycleData.publishedAt,
                }),
              }
            : {}),
        },
      });
      gate.release();

      await expect(update).rejects.toBeInstanceOf(AdminPeriodStaleStateError);
      await expect(
        prisma.report.findUnique({
          where: { id: testData.report.id },
          select: { periodEnd: true, periodState: true, archived: true },
        }),
      ).resolves.toMatchObject({
        periodEnd: originalEnd,
        periodState: data.periodState,
        archived: expectedArchived,
      });
    },
  );

  it("allows a weekLabel-only edit after publication", async () => {
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: "published",
        periodStatus: "published",
        periodState: "published",
        publishedAt: new Date("2026-08-07T15:00:00.000Z"),
        publishedSnapshot: publishedSnapshot({
          publishedAt: new Date("2026-08-07T15:00:00.000Z"),
        }),
      },
    });

    await expect(
      repo.updatePeriodManual({
        reportId: testData.report.id,
        expectedPeriodState: "published",
        data: { weekLabel: "Published label" },
      }),
    ).resolves.toMatchObject({
      weekLabel: "Published label",
      periodState: "published",
    });
  });

  it("allows at most one winner when two deletes race", async () => {
    const results = await Promise.allSettled([
      repo.deleteReport(testData.report.id),
      repo.deleteReport(testData.report.id),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(rejected?.reason).toBeInstanceOf(AdminPeriodNotFoundError);
  });

  it("keeps report deletion ordered after policy-first reminder recovery", async () => {
    let releaseRestore!: () => void;
    const restoreMayFinish = new Promise<void>((resolve) => {
      releaseRestore = resolve;
    });

    // Model the restore side of the interleaving: it holds every policy and
    // then the report while the delete transaction is attempting to start.
    const restore = prisma.$transaction(async (tx) => {
      await lockAllReminderPolicies(tx);
      await tx.$queryRaw`SELECT "id" FROM "Report" WHERE "id" = ${testData.report.id} FOR UPDATE`;
      await restoreMayFinish;
    });

    // Let the first transaction acquire both locks before starting the
    // opposite operation. With the canonical policy-first boundary, release
    // always lets both transactions complete; the old report-first delete
    // could deadlock against the restore's policy -> report sequence.
    await new Promise<void>((resolve) => setImmediate(resolve));
    const deletion = repo.deleteReport(testData.report.id);
    await new Promise<void>((resolve) => setImmediate(resolve));
    releaseRestore();

    await expect(restore).resolves.toBeUndefined();
    await expect(deletion).resolves.toBeUndefined();
    await expect(
      prisma.report.findUnique({ where: { id: testData.report.id } }),
    ).resolves.toBeNull();
  });

  it.each([
    ["publish", "draft"],
    ["archive", "published"],
    ["reopen", "published"],
  ] as const)(
    "serializes snapshot restore before %s without losing lifecycle or projections",
    async (operation, initialState) => {
      const reportId = testData.report.id;
      const publishedAt = new Date("2026-08-10T15:00:00.000Z");
      const snapshot = publishedSnapshot({
        publishedAt,
        publishedById: testData.head.id,
      });
      if (initialState === "published") {
        await prisma.report.update({
          where: { id: reportId },
          data: {
            status: "published",
            periodStatus: "published",
            periodState: "published",
            archived: false,
            publishedAt,
            publishedById: testData.head.id,
            publishedSnapshot: snapshot,
          },
        });
        const projections = buildPublishedProjections(
          publishedReportSnapshotSchema.parse(snapshot),
        );
        await prisma.publishedSectionScope.createMany({
          data: [...projections.sectionScopes],
        });
        await prisma.publishedSearchDocument.createMany({
          data: [...projections.searchDocuments],
        });
      }

      const periodRepository = new PeriodPrismaRepository(
        prisma as never,
        new WeeklyReportPrismaRepository(prisma as never),
      );
      // Publishing requires a submitted section; the shared fixture seeds a draft.
      await prisma.reportSection.update({
        where: { id: testData.section.id },
        data: { status: "submitted" },
      });
      const lifecycleExpected =
        operation === "archive"
          ? null
          : await periodRepository.getReportById(reportId);
      if (operation !== "archive" && !lifecycleExpected) {
        throw new Error(`fixture report ${reportId} was not found`);
      }

      const restoreGate = createPauseGate();
      const restore = prisma.$transaction(async (tx) => {
        await lockAllReminderPolicies(tx);
        await lockReminderRestoreGraph(tx, [], [], [reportId]);
        await restoreGate.pause();
        await tx.$queryRaw`
          SELECT "id" FROM "Report" WHERE "id" = ${reportId} FOR UPDATE
        `;
        await tx.report.update({
          where: { id: reportId },
          data:
            initialState === "published"
              ? {
                  status: "published",
                  periodStatus: "published",
                  periodState: "published",
                  archived: false,
                  publishedAt,
                  publishedById: testData.head.id,
                  publishedSnapshot: snapshot,
                }
              : {
                  status: "draft",
                  periodStatus: "open",
                  periodState: "open",
                  archived: false,
                  publishedAt: null,
                  publishedById: null,
                  publishedSnapshot: Prisma.JsonNull,
                },
        });
      });
      await restoreGate.paused;

      let competing: Promise<unknown>;
      if (operation === "archive") {
        competing = archivePeriod(prisma as never, reportId);
      } else {
        if (!lifecycleExpected) {
          throw new Error(`fixture report ${reportId} was not found`);
        }
        competing =
          operation === "publish"
            ? periodRepository.publishPeriod(
                reportId,
                testData.head.id,
                lifecycleExpected,
              )
            : periodRepository.reopenPeriod(reportId, lifecycleExpected);
      }
      restoreGate.release();
      await expect(restore).resolves.toBeUndefined();
      await competing;

      const finalReport = await prisma.report.findUnique({
        where: { id: reportId },
        select: {
          status: true,
          periodState: true,
          periodStatus: true,
          archived: true,
          publishedSnapshot: true,
        },
      });
      expect(finalReport).not.toBeNull();
      expect(finalReport).toMatchObject(
        operation === "publish"
          ? {
              status: "published",
              periodState: "published",
              periodStatus: "published",
              archived: false,
            }
          : operation === "archive"
            ? { periodState: "archived", archived: true }
            : {
                status: "published",
                periodState: "open",
                periodStatus: "reopened",
                archived: false,
              },
      );
      const expected = finalReport?.publishedSnapshot
        ? buildPublishedProjections(
            publishedReportSnapshotSchema.parse(finalReport.publishedSnapshot),
          )
        : { sectionScopes: [], searchDocuments: [] };
      await expect(
        prisma.publishedSectionScope.findMany({ where: { reportId } }),
      ).resolves.toEqual(expected.sectionScopes);
      await expect(
        prisma.publishedSearchDocument.findMany({ where: { reportId } }),
      ).resolves.toEqual(expected.searchDocuments);
    },
  );

  it("acquires multiple restored Report locks in one deterministic order", async () => {
    const second = await prisma.report.create({
      data: {
        periodStart: new Date("2026-08-17T00:00:00.000Z"),
        periodEnd: new Date("2026-08-23T23:59:59.999Z"),
      },
    });
    await expect(
      Promise.all([
        prisma.$transaction((tx) =>
          lockRestoredReports(tx, [second.id, testData.report.id]),
        ),
        prisma.$transaction((tx) =>
          lockRestoredReports(tx, [testData.report.id, second.id]),
        ),
      ]),
    ).resolves.toHaveLength(2);
  });

  it("lets the manual precheck and writer reuse a historical date range", async () => {
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: "published",
        periodStatus: "published",
        periodState: "published",
        publishedAt: new Date("2026-04-12T10:00:00.000Z"),
        publishedSnapshot: publishedSnapshot({
          publishedAt: new Date("2026-04-12T10:00:00.000Z"),
        }),
      },
    });

    await expect(
      repo.findOverlappingPeriod({
        periodStart: testData.report.periodStart,
        periodEnd: testData.report.periodEnd,
      }),
    ).resolves.toBeNull();
    await expect(
      repo.createPeriodManual({
        periodStart: testData.report.periodStart,
        periodEnd: testData.report.periodEnd,
        deadline: new Date("2026-04-10T15:00:00.000Z"),
        weekLabel: "Historical range reuse",
        periodState: "open",
      }),
    ).resolves.toMatchObject({ periodState: "open" });
  });

  it("getSnapshot returns users, projects, periods, and rules", async () => {
    const policyId = "a0000000-0000-4000-a000-000000000601";
    await prisma.reminderPolicy.create({
      data: {
        id: policyId,
        kind: "deadline",
        offsetMinutes: -1440,
        timezone: "Europe/Moscow",
        audience: "LEAD_WITH_DRAFT",
        active: true,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    await prisma.reminderRule.create({
      data: {
        id: TEST_IDS.reminderRule,
        policyId,
        kind: "deadline",
        fireAt: new Date("2026-04-10T00:00:00.000Z"),
        deadline: expectDefined(testData.report.deadline),
        timezone: "Europe/Moscow",
        status: "active",
        version: 1,
        reportId: testData.report.id,
      },
    });

    const snapshot = await repo.getSnapshot();

    expect(snapshot.users.length).toBeGreaterThanOrEqual(2); // head + lead
    expect(snapshot.projects.length).toBeGreaterThanOrEqual(1);
    expect(snapshot.periods.length).toBeGreaterThanOrEqual(1);
    expect(snapshot.reminderRules.length).toBeGreaterThanOrEqual(1);

    const leadUser = snapshot.users.find((u) => u.email === "lead1@test.local");
    expect(leadUser).toBeDefined();
    expect(expectDefined(leadUser).name).toBe("Test Lead 1");
    expect(expectDefined(leadUser).role).toBe("lead");

    const proj = snapshot.projects.find((p) => p.name === "Test Project 1");
    expect(proj).toBeDefined();
    expect(expectDefined(proj).leadId).toBe(testData.lead.id);
    expect(expectDefined(proj).leadName).toBe("Test Lead 1");

    const period = snapshot.periods.find((p) => p.id === testData.report.id);
    expect(period).toBeDefined();
    expect(expectDefined(period).status).toBe("draft");
  });

  it("round-trips an admin week label through fresh period restore", async () => {
    const weekLabel = "Apr 7–13 recovery";
    await prisma.report.update({
      where: { id: testData.report.id },
      data: { weekLabel },
    });
    const snapshot = await repo.getSnapshot();
    await prisma.report.delete({ where: { id: testData.report.id } });

    await repo.saveSnapshot(snapshot);

    expect(
      await prisma.report.findUniqueOrThrow({
        where: { id: testData.report.id },
      }),
    ).toMatchObject({ weekLabel });
  });

  it("saveSnapshot updates entities correctly", async () => {
    const snapshot = await repo.getSnapshot();

    // The denormalized `name` is recomputed server-side from the structured
    // parts, so setting it directly no longer persists — edit the parts.
    const updatedUsers = snapshot.users.map((u) =>
      u.id === testData.lead.id
        ? {
            ...u,
            lastName: "Updated",
            firstName: "Lead",
            middleName: "Name",
            isActive: false,
          }
        : u,
    );

    const updatedProjects = [
      ...snapshot.projects,
      {
        id: TEST_IDS.newProject,
        name: "New Admin Project",
        archived: false,
        leadId: testData.lead.id,
        leadName: "Updated Lead Name",
      },
    ];

    const updatedSnapshot = {
      ...snapshot,
      users: updatedUsers,
      projects: updatedProjects,
    };

    const saved = await repo.saveSnapshot(updatedSnapshot);

    const savedLead = saved.users.find((u) => u.id === testData.lead.id);
    expect(expectDefined(savedLead).name).toBe("Updated Lead Name");
    expect(expectDefined(savedLead).isActive).toBe(false);

    const savedProject = saved.projects.find(
      (p) => p.id === TEST_IDS.newProject,
    );
    expect(savedProject).toBeDefined();
    expect(expectDefined(savedProject).name).toBe("New Admin Project");
  });

  it("restores a deactivated user through the create branch", async () => {
    await prisma.user.update({
      where: { id: testData.head.id },
      data: { isActive: false },
    });
    const snapshot = await repo.getSnapshot();

    await prisma.user.delete({ where: { id: testData.head.id } });

    const restoredSnapshot = await repo.saveSnapshot(snapshot);
    const restoredUser = expectDefined(
      await prisma.user.findUnique({ where: { id: testData.head.id } }),
    );
    expect(restoredUser.isActive).toBe(false);
    expect(
      expectDefined(
        restoredSnapshot.users.find((user) => user.id === testData.head.id),
      ).isActive,
    ).toBe(false);
  });

  it("restores a deactivated user through the update branch", async () => {
    await prisma.user.update({
      where: { id: testData.head.id },
      data: { isActive: false },
    });
    const snapshot = await repo.getSnapshot();

    await prisma.user.update({
      where: { id: testData.head.id },
      data: { isActive: true },
    });

    await repo.saveSnapshot(snapshot);
    const restoredUser = expectDefined(
      await prisma.user.findUnique({ where: { id: testData.head.id } }),
    );
    expect(restoredUser.isActive).toBe(false);
  });

  // Inverse of the update-branch deactivation pin above: a live inactive row
  // must become active when the snapshot carries isActive: true.
  it("restores a reactivated user through the update branch", async () => {
    await prisma.user.update({
      where: { id: testData.lead.id },
      data: { isActive: false },
    });

    const snapshot = await repo.getSnapshot();
    const reactivatedUsers = snapshot.users.map((u) =>
      u.id === testData.lead.id ? { ...u, isActive: true } : u,
    );

    await repo.saveSnapshot({ ...snapshot, users: reactivatedUsers });

    const restoredUser = expectDefined(
      await prisma.user.findUnique({ where: { id: testData.lead.id } }),
    );
    expect(restoredUser.isActive).toBe(true);
  });

  // Server recomputes User.name from structured parts so clients cannot persist drift.
  it("recomputes a drifted name from the structured parts on saveSnapshot", async () => {
    const snapshot = await repo.getSnapshot();

    const driftedUsers = snapshot.users.map((u) =>
      u.id === testData.lead.id
        ? {
            ...u,
            // Deliberate mismatch: name says one thing, parts say another.
            name: "TOTALLY WRONG DISPLAY NAME",
            lastName: "Иванов",
            firstName: "Пётр",
            middleName: "Сергеевич",
          }
        : u,
    );

    const saved = await repo.saveSnapshot({ ...snapshot, users: driftedUsers });

    const savedLead = expectDefined(
      saved.users.find((u) => u.id === testData.lead.id),
    );
    const expected = composeName({
      lastName: "Иванов",
      firstName: "Пётр",
      middleName: "Сергеевич",
    });
    expect(savedLead.name).toBe(expected);
    expect(savedLead.name).not.toBe("TOTALLY WRONG DISPLAY NAME");

    // The persisted row (not just the returned snapshot) must also be reconciled.
    const dbLead = expectDefined(
      await prisma.user.findUnique({ where: { id: testData.lead.id } }),
    );
    expect(dbLead.name).toBe(expected);
  });

  // Group<->Product baseline: the backfill already maps the seeded group to
  // the seeded project, so these mutations run against a non-empty edge set.

  it("attachProductToGroup is idempotent and detach removes the edge", async () => {
    // The seed test cleanDatabase wipes GroupProduct too if the helper
    // is up to date; we explicitly cleanup edges for this scenario.
    await prisma.groupProduct.deleteMany({});
    const leadGroupId = expectDefined(testData.lead.reportingGroupId);

    const attached = await repo.attachProductToGroup({
      groupId: leadGroupId,
      productId: testData.project.id,
    });
    expect(attached.groupId).toBe(leadGroupId);
    expect(attached.productId).toBe(testData.project.id);

    // Re-attach returns the same logical row (same tuple) — idempotent.
    const reattached = await repo.attachProductToGroup({
      groupId: leadGroupId,
      productId: testData.project.id,
    });
    expect(reattached.id).toBe(attached.id);

    // listProductGroups and listGroupProducts reflect the edge.
    const groupsForProduct = await repo.listProductGroups(testData.project.id);
    expect(groupsForProduct.map((g) => g.id)).toContain(leadGroupId);

    const productsForGroup = await repo.listGroupProducts(leadGroupId);
    expect(productsForGroup.map((p) => p.id)).toContain(testData.project.id);

    // Detach is a no-op safe operation.
    await repo.detachProductFromGroup({
      groupId: leadGroupId,
      productId: testData.project.id,
    });
    await repo.detachProductFromGroup({
      groupId: leadGroupId,
      productId: testData.project.id,
    });

    const after = await repo.listProductGroups(testData.project.id);
    expect(after.map((g) => g.id)).not.toContain(leadGroupId);
  });

  it("attachProductToGroup resolves two concurrent first-attaches to one row", async () => {
    await prisma.groupProduct.deleteMany({});
    const input = {
      groupId: expectDefined(testData.lead.reportingGroupId),
      productId: testData.project.id,
    };

    const [first, second] = await Promise.all([
      repo.attachProductToGroup(input),
      repo.attachProductToGroup(input),
    ]);

    expect(second.id).toBe(first.id);
    const rows = await prisma.groupProduct.findMany({
      where: { productId: input.productId },
    });
    expect(rows).toHaveLength(1);
    expect(expectDefined(rows[0]).id).toBe(first.id);
  });

  it("listProductGroupOwnership resolves owners for many products in one call", async () => {
    await prisma.groupProduct.deleteMany({});
    const leadGroupId = expectDefined(testData.lead.reportingGroupId);
    const unownedId = randomUUID();
    await prisma.project.create({
      data: {
        id: unownedId,
        name: "Unowned integration product",
        leadId: testData.lead.id,
      },
    });

    await repo.attachProductToGroup({
      groupId: leadGroupId,
      productId: testData.project.id,
    });

    const ownership = await repo.listProductGroupOwnership([
      testData.project.id,
      unownedId,
    ]);

    // One entry per requested id, in request order; owned product carries its
    // group, unowned product carries null (never omitted).
    expect(ownership.map((row) => row.productId)).toEqual([
      testData.project.id,
      unownedId,
    ]);
    const owned = ownership.find(
      (row) => row.productId === testData.project.id,
    );
    expect(owned?.group?.id).toBe(leadGroupId);
    const unowned = ownership.find((row) => row.productId === unownedId);
    expect(unowned?.group).toBeNull();
  });

  // getSnapshot → saveSnapshot must preserve the full governed lifecycle set
  // (period-dual-state). CREATE-branch cases delete the row first.

  it("re-creates a published period with its full lifecycle, not flattened", async () => {
    const publishedAt = new Date("2026-04-12T10:00:00.000Z");
    // Promote the seeded period to a fully-published lifecycle state.
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: "published",
        periodState: "published",
        periodStatus: "published",
        archived: false,
        autoPublished: true,
        publishedAt,
        publishedById: testData.head.id,
        publishedSnapshot: publishedSnapshot({
          publishedAt,
          publishedById: testData.head.id,
          deadline: testData.report.deadline,
        }),
      },
    });

    const snapshot = await repo.getSnapshot();
    // Drop the row so the restore must re-CREATE it (the buggy branch). Its
    // section FK goes first.
    await prisma.reportSection.deleteMany({
      where: { reportId: testData.report.id },
    });
    await prisma.report.delete({ where: { id: testData.report.id } });

    // Full-snapshot restore (users included) so the publishedById FK resolves.
    await repo.saveSnapshot(snapshot);

    const restored = expectDefined(
      await prisma.report.findUnique({ where: { id: testData.report.id } }),
    );
    expect(restored.status).toBe("published");
    expect(restored.periodStatus).toBe("published"); // viewer-visible
    expect(restored.periodState).toBe("published"); // NOT the default 'open'
    expect(restored.archived).toBe(false);
    expect(restored.autoPublished).toBe(true);
    expect(restored.publishedAt?.toISOString()).toBe(publishedAt.toISOString());
    expect(restored.publishedById).toBe(testData.head.id);
  });

  it("re-creates a reopened period keeping its three distinct values", async () => {
    const reopenedAt = new Date("2026-04-20T09:00:00.000Z");
    // A reopened period is the canonical legitimately-divergent row.
    const reopened = await prisma.report.create({
      data: {
        id: TEST_IDS.targetReport,
        periodStart: new Date("2026-04-14"),
        periodEnd: new Date("2026-04-20"),
        deadline: new Date("2026-04-18"),
        status: "published",
        periodState: "open",
        periodStatus: "reopened",
        archived: false,
        publishedAt: new Date("2026-04-19T10:00:00.000Z"),
        publishedById: testData.head.id,
        reopenedAt,
        publishedSnapshot: publishedSnapshotFixture({
          reportId: TEST_IDS.targetReport,
          periodStart: "2026-04-14T00:00:00.000Z",
          periodEnd: "2026-04-20T00:00:00.000Z",
          publishedAt: "2026-04-19T10:00:00.000Z",
          publishedById: testData.head.id,
          deadline: "2026-04-18T00:00:00.000Z",
        }),
      },
    });

    const snapshot = await repo.getSnapshot();
    // No section on this row — delete it directly so the restore re-CREATEs it.
    await prisma.report.delete({ where: { id: reopened.id } });

    await repo.saveSnapshot(snapshot);

    const restored = expectDefined(
      await prisma.report.findUnique({ where: { id: reopened.id } }),
    );
    // Deriving any machine from another would flatten the row: status from
    // periodState='open' would flip status to "draft"; periodStatus would
    // default to "open", losing the reopen flavour. The restore must NOT.
    expect(restored.status).toBe("published");
    expect(restored.periodState).toBe("open");
    expect(restored.periodStatus).toBe("reopened");
    expect(restored.reopenedAt?.toISOString()).toBe(reopenedAt.toISOString());
  });

  it("repairs a divergent live period via the update branch", async () => {
    // Capture a healthy published row, then corrupt the live row before restore;
    // the update branch must overwrite the full governed set.
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: "published",
        periodState: "published",
        periodStatus: "published",
        publishedAt: new Date("2026-04-13T15:00:00.000Z"),
        publishedSnapshot: publishedSnapshot({
          publishedAt: new Date("2026-04-13T15:00:00.000Z"),
          deadline: testData.report.deadline,
        }),
      },
    });

    const snapshot = await repo.getSnapshot();

    // Corrupt the persisted lifecycle (row still exists → update branch).
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: "published",
        periodState: "open",
        periodStatus: "reopened",
        reopenedAt: new Date("2026-04-14T09:00:00.000Z"),
      },
    });

    await repo.saveSnapshot(snapshot);

    const restored = expectDefined(
      await prisma.report.findUnique({ where: { id: testData.report.id } }),
    );
    expect(restored.periodState).toBe("published");
    expect(restored.periodStatus).toBe("published");
  });

  describe("Head reporting-group consistency", () => {
    const otherGroupId = "a0000000-0000-4000-a000-000000000080";
    const otherAdminId = "a0000000-0000-4000-a000-000000000081";
    const replacementHeadId = "a0000000-0000-4000-a000-000000000082";

    async function headFixture() {
      await prisma.reportingGroup.create({
        data: { id: otherGroupId, name: "Other reporting group" },
      });
      const snapshot = await repo.getSnapshot();
      return {
        head: expectDefined(
          snapshot.users.find(({ id }) => id === testData.head.id),
        ),
        ownGroup: expectDefined(
          snapshot.groups.find(({ id }) => id === TEST_IDS.group),
        ),
        otherGroup: expectDefined(
          snapshot.groups.find(({ id }) => id === otherGroupId),
        ),
      };
    }

    async function retainAnotherAdmin() {
      await prisma.user.create({
        data: {
          id: otherAdminId,
          email: "head-policy-admin@test.local",
          samlId: "head-policy-admin",
          name: "Policy Admin",
          firstName: "Policy",
          lastName: "Admin",
          role: "admin",
          reportingGroupId: TEST_IDS.group,
        },
      });
    }

    it("rejects a foreign ordinary Head assignment without changing the group", async () => {
      const { head, ownGroup, otherGroup } = await headFixture();
      await expect(
        repo.saveReportingGroup({
          ...otherGroup,
          name: "Must roll back",
          headUserId: head.id,
        }),
      ).rejects.toBeInstanceOf(AdminUserActivityAssignmentConflictError);
      await expect(
        prisma.reportingGroup.findUnique({ where: { id: otherGroupId } }),
      ).resolves.toMatchObject({
        name: "Other reporting group",
        headUserId: null,
      });
      await repo.saveReportingGroup({ ...ownGroup, headUserId: head.id });
      await expect(
        prisma.reportingGroup.findUnique({ where: { id: TEST_IDS.group } }),
      ).resolves.toMatchObject({ headUserId: head.id });
    });

    it("rejects an ordinary Head transfer while the old heading remains", async () => {
      const { head, ownGroup } = await headFixture();
      await repo.saveReportingGroup({ ...ownGroup, headUserId: head.id });
      await expect(
        repo.upsertUser({ ...head, reportingGroupId: otherGroupId }),
      ).rejects.toBeInstanceOf(AdminUserActivityAssignmentConflictError);
      await expect(
        prisma.user.findUnique({ where: { id: head.id } }),
      ).resolves.toMatchObject({
        role: "head",
        reportingGroupId: TEST_IDS.group,
      });
      await expect(
        prisma.reportingGroup.findUnique({ where: { id: TEST_IDS.group } }),
      ).resolves.toMatchObject({ headUserId: head.id });
    });

    it("allows Admin cross-group and multiple headings while their membership changes", async () => {
      const { head, ownGroup, otherGroup } = await headFixture();
      await repo.upsertUser({ ...head, role: "admin" });
      await repo.saveReportingGroup({ ...ownGroup, headUserId: head.id });
      await repo.saveReportingGroup({ ...otherGroup, headUserId: head.id });
      await repo.upsertUser({
        ...head,
        role: "admin",
        reportingGroupId: otherGroupId,
      });
      await expect(
        prisma.user.findUnique({ where: { id: head.id } }),
      ).resolves.toMatchObject({
        role: "admin",
        reportingGroupId: otherGroupId,
      });
      await expect(
        prisma.reportingGroup.count({ where: { headUserId: head.id } }),
      ).resolves.toBe(2);
    });

    it("checks the second retained heading during an ordinary Admin-to-Head transition", async () => {
      const { head, ownGroup, otherGroup } = await headFixture();
      await retainAnotherAdmin();
      await repo.upsertUser({ ...head, role: "admin" });
      await repo.saveReportingGroup({ ...ownGroup, headUserId: head.id });
      await repo.saveReportingGroup({ ...otherGroup, headUserId: head.id });
      await expect(
        repo.upsertUser({ ...head, role: "head" }),
      ).rejects.toBeInstanceOf(AdminUserActivityAssignmentConflictError);
      await expect(
        prisma.user.findUnique({ where: { id: head.id } }),
      ).resolves.toMatchObject({
        role: "admin",
        reportingGroupId: TEST_IDS.group,
      });
      await expect(
        prisma.reportingGroup.count({ where: { headUserId: head.id } }),
      ).resolves.toBe(2);
    });

    it.each(["clear", "reassign"] as const)(
      "atomically moves a restored Head while the old pointer is %s",
      async (oldPointer) => {
        const { head, ownGroup } = await headFixture();
        await repo.saveReportingGroup({ ...ownGroup, headUserId: head.id });
        if (oldPointer === "reassign") {
          await prisma.user.create({
            data: {
              id: replacementHeadId,
              email: "head-policy-replacement@test.local",
              samlId: "head-policy-replacement",
              name: "Replacement Head",
              firstName: "Replacement",
              lastName: "Head",
              role: "head",
              reportingGroupId: TEST_IDS.group,
            },
          });
        }
        const snapshot = await repo.getSnapshot();
        await repo.saveSnapshot({
          ...snapshot,
          users: snapshot.users.map((user) =>
            user.id === head.id
              ? { ...user, reportingGroupId: otherGroupId }
              : user,
          ),
          groups: snapshot.groups.map((group) => ({
            ...group,
            headUserId:
              group.id === TEST_IDS.group
                ? oldPointer === "clear"
                  ? null
                  : replacementHeadId
                : group.id === otherGroupId
                  ? head.id
                  : group.headUserId,
          })),
        });
        await expect(
          prisma.user.findUnique({ where: { id: head.id } }),
        ).resolves.toMatchObject({
          role: "head",
          reportingGroupId: otherGroupId,
        });
        await expect(
          prisma.reportingGroup.findUnique({ where: { id: TEST_IDS.group } }),
        ).resolves.toMatchObject({
          headUserId: oldPointer === "clear" ? null : replacementHeadId,
        });
        await expect(
          prisma.reportingGroup.findUnique({ where: { id: otherGroupId } }),
        ).resolves.toMatchObject({ headUserId: head.id });
      },
    );

    it("rejects a retained foreign live heading omitted from an additive restore before writes", async () => {
      const { head, ownGroup, otherGroup } = await headFixture();
      await retainAnotherAdmin();
      await repo.upsertUser({ ...head, role: "admin" });
      await repo.saveReportingGroup({ ...ownGroup, headUserId: head.id });
      await repo.saveReportingGroup({ ...otherGroup, headUserId: head.id });
      const before = await repo.getSnapshot();
      await expect(
        repo.saveSnapshot({
          ...before,
          users: before.users.map((user) =>
            user.id === head.id ? { ...user, role: "head" } : user,
          ),
          groups: before.groups
            .filter(({ id }) => id !== otherGroupId)
            .map((group) => ({ ...group, name: "Must not write" })),
        }),
      ).rejects.toBeInstanceOf(AdminSnapshotConflictError);
      await expect(repo.getSnapshot()).resolves.toEqual(before);
    });

    it("preserves inactive matching Head pointers during ordinary assignment and restore", async () => {
      const { head, ownGroup } = await headFixture();
      await prisma.user.update({
        where: { id: head.id },
        data: { isActive: false },
      });
      await repo.saveReportingGroup({ ...ownGroup, headUserId: head.id });
      const snapshot = await repo.getSnapshot();
      await repo.saveSnapshot(snapshot);
      await expect(
        prisma.user.findUnique({ where: { id: head.id } }),
      ).resolves.toMatchObject({
        isActive: false,
        reportingGroupId: TEST_IDS.group,
      });
      await expect(
        prisma.reportingGroup.findUnique({ where: { id: TEST_IDS.group } }),
      ).resolves.toMatchObject({ headUserId: head.id });
    });

    it("restores Admin cross-group and multiple headings", async () => {
      const { head } = await headFixture();
      const snapshot = await repo.getSnapshot();
      await repo.saveSnapshot({
        ...snapshot,
        users: snapshot.users.map((user) =>
          user.id === head.id ? { ...user, role: "admin" } : user,
        ),
        groups: snapshot.groups.map((group) => ({
          ...group,
          headUserId: head.id,
        })),
      });
      await expect(
        prisma.reportingGroup.count({ where: { headUserId: head.id } }),
      ).resolves.toBe(2);
      await expect(
        prisma.user.findUnique({ where: { id: head.id } }),
      ).resolves.toMatchObject({
        role: "admin",
        reportingGroupId: TEST_IDS.group,
      });
    });

    it.each(["assignment", "transfer"] as const)(
      "serializes %s first against the other Head membership writer",
      async (firstWriter) => {
        const { head, ownGroup } = await headFixture();
        const gate = createPauseGate();
        const holderPid = Promise.withResolvers<number>();
        const waiterPid = Promise.withResolvers<number>();

        function observedClient(
          pid: ReturnType<typeof Promise.withResolvers<number>>,
          pauseAfterLock: boolean,
        ): PrismaClient {
          const transaction = prisma.$transaction.bind(prisma);
          return new Proxy(prisma, {
            get(target, property): unknown {
              if (property !== "$transaction")
                return Reflect.get(target, property, target) as unknown;
              return async <T>(
                callback: (tx: Prisma.TransactionClient) => Promise<T>,
                options?: {
                  isolationLevel?: Prisma.TransactionIsolationLevel;
                  maxWait?: number;
                  timeout?: number;
                },
              ) =>
                transaction(
                  async (tx) => {
                    const [row] = await tx.$queryRaw<
                      { pid: number }[]
                    >`SELECT pg_backend_pid() AS pid`;
                    pid.resolve(expectDefined(row).pid);
                    let paused = false;
                    const observedTx = new Proxy(tx, {
                      get(txTarget, txProperty): unknown {
                        if (txProperty !== "$queryRaw")
                          return Reflect.get(
                            txTarget,
                            txProperty,
                            txTarget,
                          ) as unknown;
                        return async (...args: unknown[]) => {
                          const result: unknown = await Reflect.apply(
                            txTarget.$queryRaw,
                            txTarget,
                            args,
                          );
                          if (
                            pauseAfterLock &&
                            !paused &&
                            args.includes(head.id)
                          ) {
                            paused = true;
                            await gate.pause();
                          }
                          return result;
                        };
                      },
                    });
                    return callback(observedTx);
                  },
                  { ...options, timeout: 10_000 },
                );
            },
          });
        }

        const firstRepo = new AdminPrismaRepository(
          observedClient(holderPid, true) as never,
        );
        const secondRepo = new AdminPrismaRepository(
          observedClient(waiterPid, false) as never,
        );
        const assign = async (writer: AdminPrismaRepository) => {
          await writer.saveReportingGroup({ ...ownGroup, headUserId: head.id });
        };
        const transfer = async (writer: AdminPrismaRepository) => {
          await writer.upsertUser({ ...head, reportingGroupId: otherGroupId });
        };
        const first =
          firstWriter === "assignment"
            ? assign(firstRepo)
            : transfer(firstRepo);
        const firstOutcome = first.then(
          () => ({ error: null }),
          (error: unknown) => ({ error }),
        );
        let second: Promise<void> | undefined;
        let blockedByHolder = false;
        try {
          await Promise.race([
            gate.paused,
            firstOutcome.then(({ error }) => {
              if (error !== null) throw error;
              throw new Error(
                "First writer finished before its User lock was observed.",
              );
            }),
          ]);
          second =
            firstWriter === "assignment"
              ? transfer(secondRepo)
              : assign(secondRepo);
          const secondOutcome = second.then(
            () => ({ error: null }),
            (error: unknown) => ({ error }),
          );
          const holder = await holderPid.promise;
          const waiter = await waiterPid.promise;
          expect(holder).not.toBe(waiter);
          await vi.waitFor(
            async () => {
              const [row] = await prisma.$queryRaw<{ blocked: boolean }[]>`
              SELECT ${holder}::int = ANY(pg_blocking_pids(${waiter}::int)) AS blocked
            `;
              expect(expectDefined(row).blocked).toBe(true);
              blockedByHolder = true;
            },
            { timeout: 2000, interval: 10 },
          );
          gate.release();
          expect((await firstOutcome).error).toBeNull();
          expect((await secondOutcome).error).toBeInstanceOf(
            AdminUserActivityAssignmentConflictError,
          );
        } finally {
          gate.release();
          await Promise.allSettled([first, ...(second ? [second] : [])]);
        }
        expect(blockedByHolder).toBe(true);
        await expect(
          prisma.user.findUnique({ where: { id: head.id } }),
        ).resolves.toMatchObject({
          reportingGroupId:
            firstWriter === "assignment" ? TEST_IDS.group : otherGroupId,
        });
        await expect(
          prisma.reportingGroup.findUnique({ where: { id: TEST_IDS.group } }),
        ).resolves.toMatchObject({
          headUserId: firstWriter === "assignment" ? head.id : null,
        });
      },
    );
  });

  // headUserId is applied in a second pass after users exist (groups upsert first).

  it("restores a group's headUserId from the snapshot", async () => {
    const snapshot = await repo.getSnapshot();
    // Point the seeded group at the head user (a valid head candidate).
    const groups = snapshot.groups.map((g) =>
      g.id === TEST_IDS.group ? { ...g, headUserId: testData.head.id } : g,
    );

    await repo.saveSnapshot({ ...snapshot, groups });

    const restored = await repo.getSnapshot();
    const group = expectDefined(
      restored.groups.find((g) => g.id === TEST_IDS.group),
    );
    expect(group.headUserId).toBe(testData.head.id);
  });

  it("clears a previously-headed group's headUserId to null on restore", async () => {
    // Seed a head on the live group first.
    await prisma.reportingGroup.update({
      where: { id: TEST_IDS.group },
      data: { headUserId: testData.head.id },
    });

    const snapshot = await repo.getSnapshot();
    const groups = snapshot.groups.map((g) =>
      g.id === TEST_IDS.group ? { ...g, headUserId: null } : g,
    );

    await repo.saveSnapshot({ ...snapshot, groups });

    const restored = await repo.getSnapshot();
    const group = expectDefined(
      restored.groups.find((g) => g.id === TEST_IDS.group),
    );
    expect(group.headUserId).toBeNull();
  });

  it("applies a changed headUserId into an existing DB on restore", async () => {
    // Start with the head user leading the group, in the live DB.
    await prisma.reportingGroup.update({
      where: { id: TEST_IDS.group },
      data: { headUserId: testData.head.id },
    });

    // Add a second eligible head rather than promoting the product lead. A
    // lead role is required by the product ownership graph, so promoting the
    // existing project lead would intentionally make the final graph invalid.
    const alternateHeadId = "a0000000-0000-4000-a000-000000000098";
    await prisma.user.create({
      data: {
        id: alternateHeadId,
        email: "alternate-head@test.local",
        name: "Alternate Head",
        lastName: "Alternate",
        firstName: "Head",
        role: "head",
        samlId: "alternate-head-test",
        reportingGroupId: TEST_IDS.group,
      },
    });

    const snapshot = await repo.getSnapshot();
    const groups = snapshot.groups.map((g) =>
      g.id === TEST_IDS.group ? { ...g, headUserId: alternateHeadId } : g,
    );

    await repo.saveSnapshot({ ...snapshot, groups });

    const restored = await repo.getSnapshot();
    const group = expectDefined(
      restored.groups.find((g) => g.id === TEST_IDS.group),
    );
    expect(group.headUserId).toBe(alternateHeadId);
  });

  // Restore must carry rule.policyId so derived rules stay attached to policies.
  it("preserves a reminder rule's policyId through a getSnapshot -> saveSnapshot restore", async () => {
    const policyId = "d1111111-1111-4111-8111-111111111111";
    const ruleId = "d2222222-2222-4222-8222-222222222222";

    await prisma.reminderPolicy.create({
      data: {
        id: policyId,
        kind: "deadline",
        offsetMinutes: -1440,
        timezone: "Europe/Moscow",
        audience: "LEAD_WITH_DRAFT",
        active: true,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    await prisma.reminderRule.create({
      data: {
        id: ruleId,
        policyId,
        kind: "deadline",
        fireAt: new Date("2026-04-10T00:00:00.000Z"),
        deadline: expectDefined(testData.report.deadline),
        timezone: "Europe/Moscow",
        status: "active",
        version: 1,
        reportId: testData.report.id,
      },
    });

    const snapshot = await repo.getSnapshot();
    // Drop both so a fresh-DB restore must re-create policy before the rule FK.
    await prisma.reminderRule.delete({ where: { id: ruleId } });
    await prisma.reminderPolicy.delete({ where: { id: policyId } });

    await repo.saveSnapshot(snapshot);

    const restored = expectDefined(
      await prisma.reminderRule.findUnique({ where: { id: ruleId } }),
    );
    expect(restored.policyId).toBe(policyId);
    const restoredPolicy = expectDefined(
      await prisma.reminderPolicy.findUnique({ where: { id: policyId } }),
    );
    expect(restoredPolicy.audience).toBe("LEAD_WITH_DRAFT");

    // UPDATE branch: point the live row at another valid policy, then confirm
    // restore re-attaches the snapshot policy without an orphan state.
    const otherPolicyId = "d1111111-1111-4111-8111-111111111112";
    await prisma.reminderPolicy.create({
      data: {
        id: otherPolicyId,
        kind: "deadline",
        offsetMinutes: -720,
        timezone: "Europe/Moscow",
        audience: "LEAD_WITH_DRAFT",
        active: true,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    await prisma.reminderRule.update({
      where: { id: ruleId },
      data: { policyId: otherPolicyId },
    });
    await repo.saveSnapshot(snapshot);
    const reRestored = expectDefined(
      await prisma.reminderRule.findUnique({ where: { id: ruleId } }),
    );
    expect(reRestored.policyId).toBe(policyId);
  });

  it("restores sent and queued reminder executions without rescheduling or payload drift", async () => {
    const policyId = "d6666666-6666-4666-8666-666666666666";
    const ruleId = "d7777777-7777-4777-8777-777777777777";
    const sentExecutionId = "d8888888-8888-4888-8888-888888888888";
    const queuedExecutionId = "d9999999-9999-4999-8999-999999999999";
    const fireAt = new Date("2026-04-11T09:00:00.000Z");
    const sentAt = new Date("2026-04-11T09:01:00.000Z");
    const sentCreatedAt = new Date("2026-04-11T08:58:00.000Z");
    const sentUpdatedAt = new Date("2026-04-11T09:01:00.000Z");
    const queuedCreatedAt = new Date("2026-04-11T08:59:00.000Z");
    const queuedUpdatedAt = new Date("2026-04-11T08:59:30.000Z");
    const reportDeadline = expectDefined(testData.report.deadline);
    const payload: ReminderQueuePayload = {
      contractVersion: 1,
      kind: "deadline",
      cycleDate: "2026-04-11",
      leadName: "Test Lead 1",
      reportPeriod: "2026-04-06 → 2026-04-12",
      deadlineIso: reportDeadline.toISOString(),
      sectionUrl: `https://example.test/lead/report/${testData.report.id}`,
      organization: {
        shortName: "PEO",
        fullName: "Product Engineering & Operations",
      },
    };
    const sentRecipient = "sent@test.local";
    const queuedRecipient = "queued@test.local";
    const dedupeKey = (recipientEmail: string) =>
      `${ruleId}:deadline:2026-04-11:${recipientEmail}`;

    await prisma.reminderPolicy.create({
      data: {
        id: policyId,
        kind: "deadline",
        offsetMinutes: 540,
        timezone: "Europe/Moscow",
        audience: "LEAD_WITH_DRAFT",
        active: true,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    await prisma.reminderRule.create({
      data: {
        id: ruleId,
        reportId: testData.report.id,
        policyId,
        kind: "deadline",
        fireAt,
        deadline: reportDeadline,
        timezone: "Europe/Moscow",
        status: "active",
        version: 1,
      },
    });
    await prisma.reminderExecution.createMany({
      data: [
        {
          id: sentExecutionId,
          ruleId,
          recipientEmail: sentRecipient,
          dedupeKey: dedupeKey(sentRecipient),
          status: "sent",
          sentAt,
          error: null,
          queuePayload: payload,
          createdAt: sentCreatedAt,
          updatedAt: sentUpdatedAt,
        },
        {
          id: queuedExecutionId,
          ruleId,
          recipientEmail: queuedRecipient,
          dedupeKey: dedupeKey(queuedRecipient),
          status: "pending",
          sentAt: null,
          error: null,
          queuePayload: payload,
          createdAt: queuedCreatedAt,
          updatedAt: queuedUpdatedAt,
        },
      ],
    });

    const snapshot = await repo.getSnapshot();
    await prisma.reminderRule.delete({ where: { id: ruleId } });
    expect(await prisma.reminderExecution.count({ where: { ruleId } })).toBe(0);

    await repo.saveSnapshot(snapshot);

    const [restoredSent, restoredQueued] = await Promise.all([
      prisma.reminderExecution.findUniqueOrThrow({
        where: { id: sentExecutionId },
      }),
      prisma.reminderExecution.findUniqueOrThrow({
        where: { id: queuedExecutionId },
      }),
    ]);
    expect(restoredSent).toMatchObject({
      ruleId,
      recipientEmail: sentRecipient,
      dedupeKey: dedupeKey(sentRecipient),
      status: "sent",
      sentAt,
      error: null,
      queuePayload: payload,
      createdAt: sentCreatedAt,
      updatedAt: sentUpdatedAt,
    });
    expect(restoredQueued).toMatchObject({
      ruleId,
      recipientEmail: queuedRecipient,
      dedupeKey: dedupeKey(queuedRecipient),
      status: "pending",
      sentAt: null,
      error: null,
      queuePayload: payload,
      createdAt: queuedCreatedAt,
      updatedAt: queuedUpdatedAt,
    });

    const enqueued: unknown[] = [];
    const reminders = new RemindersService(
      new RemindersPrismaRepository(prisma as never),
      createNullLogger(),
      {
        enqueue: (...args: unknown[]) => {
          enqueued.push(args);
          return Promise.resolve();
        },
      },
    );
    const duplicate = await reminders.requestReminderExecution(
      ruleId,
      sentRecipient,
      {
        kind: payload.kind,
        cycleDate: payload.cycleDate,
        leadName: payload.leadName,
        reportPeriod: payload.reportPeriod,
        deadlineIso: payload.deadlineIso,
        sectionUrl: payload.sectionUrl,
        organization: payload.organization,
      },
    );
    expect(duplicate).toMatchObject({ id: sentExecutionId, status: "sent" });
    expect(enqueued).toHaveLength(0);

    // A timestamp alone is not authority to unclaim an in-flight delivery:
    // sending -> queued could duplicate SMTP after restore.
    const liveSendingUpdatedAt = new Date("2026-04-11T09:00:00.000Z");
    await prisma.reminderExecution.update({
      where: { id: queuedExecutionId },
      data: { status: "sending", updatedAt: liveSendingUpdatedAt },
    });
    const newerQueuedSnapshot = {
      ...snapshot,
      reminderExecutions: snapshot.reminderExecutions.map((execution) =>
        execution.id === queuedExecutionId
          ? {
              ...execution,
              updatedAt: new Date("2026-04-11T09:01:00.000Z"),
            }
          : execution,
      ),
    };
    await expect(repo.saveSnapshot(newerQueuedSnapshot)).rejects.toBeInstanceOf(
      AdminSnapshotConflictError,
    );
    expect(
      await prisma.reminderExecution.findUniqueOrThrow({
        where: { id: queuedExecutionId },
      }),
    ).toMatchObject({ status: "sending", updatedAt: liveSendingUpdatedAt });

    const nextFireAt = new Date("2026-04-12T09:00:00.000Z");
    const incompatibleRuleSnapshot = {
      ...snapshot,
      reminderRules: snapshot.reminderRules.map((rule) =>
        rule.id === ruleId ? { ...rule, fireAt: nextFireAt } : rule,
      ),
      // Keep the deliberately incompatible rule internally coherent with the
      // supplied snapshot policy; the live retained execution is what must
      // produce AdminSnapshotConflictError, not schema-level rejection.
      policies: snapshot.policies.map((policy) =>
        policy.id === policyId ? { ...policy, offsetMinutes: 1980 } : policy,
      ),
      reminderExecutions: snapshot.reminderExecutions.map((execution) =>
        execution.ruleId === ruleId
          ? {
              ...execution,
              scheduledFor: nextFireAt,
              dedupeKey: `${ruleId}:deadline:2026-04-12:${execution.recipientEmail}`,
              queuePayload: {
                ...execution.queuePayload,
                cycleDate: "2026-04-12" as const,
              },
            }
          : execution,
      ),
    };
    await expect(
      repo.saveSnapshot(incompatibleRuleSnapshot),
    ).rejects.toBeInstanceOf(AdminSnapshotConflictError);
    expect(
      await prisma.reminderRule.findUniqueOrThrow({ where: { id: ruleId } }),
    ).toMatchObject({ fireAt });

    // The live worker advances the row after the old queued snapshot was
    // captured. Reapplying that stale snapshot must retain the terminal row.
    const liveQueuedSentAt = new Date("2026-04-11T09:02:00.000Z");
    const liveQueuedUpdatedAt = new Date("2026-04-11T09:03:00.000Z");
    await prisma.reminderExecution.update({
      where: { id: queuedExecutionId },
      data: {
        status: "sent",
        sentAt: liveQueuedSentAt,
        updatedAt: liveQueuedUpdatedAt,
      },
    });
    await repo.saveSnapshot(snapshot);
    expect(
      await prisma.reminderExecution.findUniqueOrThrow({
        where: { id: queuedExecutionId },
      }),
    ).toMatchObject({
      status: "sent",
      sentAt: liveQueuedSentAt,
      updatedAt: liveQueuedUpdatedAt,
    });
    const staleDuplicate = await reminders.requestReminderExecution(
      ruleId,
      queuedRecipient,
      {
        kind: payload.kind,
        cycleDate: payload.cycleDate,
        leadName: payload.leadName,
        reportPeriod: payload.reportPeriod,
        deadlineIso: payload.deadlineIso,
        sectionUrl: payload.sectionUrl,
        organization: payload.organization,
      },
    );
    expect(staleDuplicate).toMatchObject({
      id: queuedExecutionId,
      status: "sent",
    });
    expect(enqueued).toHaveLength(0);

    await prisma.reminderExecution.update({
      where: { id: queuedExecutionId },
      data: {
        queuePayload: { ...payload, leadName: "Conflicting Live Lead" },
      },
    });
    await expect(repo.saveSnapshot(snapshot)).rejects.toBeInstanceOf(
      AdminSnapshotConflictError,
    );
  });

  it("round-trips a sent execution after the report schedule and policy kind change", async () => {
    const policyId = "d6666666-6666-4666-8666-666666666667";
    const historicalRuleId = "d7777777-7777-4777-8777-777777777778";
    const currentRuleId = "d7777777-7777-4777-8777-777777777779";
    const executionId = "d8888888-8888-4888-8888-888888888889";
    const historicalDeadline = expectDefined(testData.report.deadline);
    const currentDeadline = new Date("2026-04-12T12:00:00.000Z");
    const recipientEmail = "historical@test.local";
    const payload: ReminderQueuePayload = {
      contractVersion: 1,
      kind: "deadline",
      cycleDate: "2026-04-11",
      leadName: "Historical Lead",
      reportPeriod: "2026-04-07 → 2026-04-13",
      deadlineIso: historicalDeadline.toISOString(),
      sectionUrl: `https://example.test/lead/report/${testData.report.id}`,
      organization: {
        shortName: "PEO",
        fullName: "Product Engineering & Operations",
      },
    };

    await prisma.reminderPolicy.create({
      data: {
        id: policyId,
        kind: "deadline",
        offsetMinutes: 0,
        timezone: "Europe/Moscow",
        audience: "LEAD_WITH_DRAFT",
        active: true,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    await prisma.reminderRule.create({
      data: {
        id: historicalRuleId,
        reportId: testData.report.id,
        policyId,
        kind: "deadline",
        fireAt: historicalDeadline,
        deadline: historicalDeadline,
        timezone: "Europe/Moscow",
        status: "active",
        version: 1,
      },
    });
    await prisma.reminderExecution.create({
      data: {
        id: executionId,
        ruleId: historicalRuleId,
        recipientEmail,
        dedupeKey: `${historicalRuleId}:deadline:2026-04-11:${recipientEmail}`,
        status: "sent",
        sentAt: new Date("2026-04-11T00:01:00.000Z"),
        error: null,
        queuePayload: payload,
        createdAt: new Date("2026-04-10T23:59:00.000Z"),
        updatedAt: new Date("2026-04-11T00:01:00.000Z"),
      },
    });

    await prisma.reminderRule.update({
      where: { id: historicalRuleId },
      data: { status: "paused" },
    });
    await prisma.report.update({
      where: { id: testData.report.id },
      data: { deadline: currentDeadline },
    });
    await prisma.reminderPolicy.update({
      where: { id: policyId },
      data: { kind: "escalation", audience: "HEAD_OF_LATE" },
    });
    await prisma.reminderRule.create({
      data: {
        id: currentRuleId,
        reportId: testData.report.id,
        policyId,
        kind: "escalation",
        fireAt: currentDeadline,
        deadline: currentDeadline,
        timezone: "Europe/Moscow",
        status: "active",
        version: 2,
      },
    });

    const snapshot = await repo.getSnapshot();
    await prisma.reminderPolicy.delete({ where: { id: policyId } });
    await repo.saveSnapshot(snapshot);

    const [restoredHistoricalRule, restoredCurrentRule, restoredExecution] =
      await Promise.all([
        prisma.reminderRule.findUniqueOrThrow({
          where: { id: historicalRuleId },
        }),
        prisma.reminderRule.findUniqueOrThrow({ where: { id: currentRuleId } }),
        prisma.reminderExecution.findUniqueOrThrow({
          where: { id: executionId },
        }),
      ]);
    expect(restoredHistoricalRule).toMatchObject({
      kind: "deadline",
      deadline: historicalDeadline,
      fireAt: historicalDeadline,
      status: "paused",
      version: 1,
    });
    expect(restoredCurrentRule).toMatchObject({
      kind: "escalation",
      deadline: currentDeadline,
      fireAt: currentDeadline,
      status: "active",
      version: 2,
    });
    expect(restoredExecution).toMatchObject({
      ruleId: historicalRuleId,
      status: "sent",
      queuePayload: payload,
    });
  });

  // Post-commit applicator must not re-materialize an inactive policy's pair.
  it("fresh-DB restore keeps an inactive policy's rule paused", async () => {
    const policyId = "d3333333-3333-4333-8333-333333333333";
    const ruleId = "d4444444-4444-4444-8444-444444444444";
    const periodId = "d5555555-5555-4555-8555-555555555555";

    await prisma.report.create({
      data: {
        id: periodId,
        periodStart: new Date("2026-03-02"),
        periodEnd: new Date("2026-03-08"),
        deadline: new Date("2026-03-06T15:00:00.000Z"),
        status: "draft",
      },
    });
    await prisma.reminderPolicy.create({
      data: {
        id: policyId,
        kind: "deadline",
        offsetMinutes: -1440,
        timezone: "Europe/Moscow",
        audience: "LEAD_WITH_DRAFT",
        active: false,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    await prisma.reminderRule.create({
      data: {
        id: ruleId,
        policyId,
        kind: "deadline",
        fireAt: new Date("2026-03-05T15:00:00.000Z"),
        deadline: new Date("2026-03-06T15:00:00.000Z"),
        timezone: "Europe/Moscow",
        status: "paused",
        version: 1,
        reportId: periodId,
      },
    });

    const applicatorRepo = new AdminPrismaRepository(
      prisma as never,
      new PolicyApplicatorService(prisma as never),
    );
    const snapshot = await applicatorRepo.getSnapshot();
    // Fresh-DB path: everything the snapshot carries is absent pre-restore,
    // so the period counts as newly created and the applicator runs.
    await prisma.reminderRule.delete({ where: { id: ruleId } });
    await prisma.reminderPolicy.delete({ where: { id: policyId } });
    await prisma.report.delete({ where: { id: periodId } });

    await applicatorRepo.saveSnapshot(snapshot);

    const restored = expectDefined(
      await prisma.reminderRule.findUnique({ where: { id: ruleId } }),
    );
    expect(restored.status).toBe("paused");
    expect(restored.fireAt).toEqual(new Date("2026-03-05T15:00:00.000Z"));
    // And no duplicate derived rule was materialized for the same pair.
    const pairRules = await prisma.reminderRule.findMany({
      where: { reportId: periodId, policyId },
    });
    expect(pairRules).toHaveLength(1);
  });

  it("restoring an inactive policy pauses a retained rule omitted from the snapshot", async () => {
    const policyId = "d3333333-3333-4333-8333-333333333334";
    const ruleId = "d4444444-4444-4444-8444-444444444445";
    await prisma.reminderPolicy.create({
      data: {
        id: policyId,
        kind: "deadline",
        offsetMinutes: -1440,
        timezone: "Europe/Moscow",
        audience: "LEAD_WITH_DRAFT",
        active: true,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    await prisma.reminderRule.create({
      data: {
        id: ruleId,
        policyId,
        kind: "deadline",
        fireAt: new Date("2026-04-10T00:00:00.000Z"),
        deadline: expectDefined(testData.report.deadline),
        timezone: "Europe/Moscow",
        status: "active",
        version: 1,
        reportId: testData.report.id,
      },
    });
    const snapshot = await repo.getSnapshot();

    await repo.saveSnapshot({
      ...snapshot,
      policies: snapshot.policies.map((policy) =>
        policy.id === policyId ? { ...policy, active: false } : policy,
      ),
      reminderRules: snapshot.reminderRules.filter(
        (rule) => rule.id !== ruleId,
      ),
    });

    expect(
      await prisma.reminderRule.findUniqueOrThrow({ where: { id: ruleId } }),
    ).toMatchObject({ status: "paused", policyId });
  });

  it("attachProductToGroup rejects moving a product from another group", async () => {
    await prisma.groupProduct.deleteMany({});
    const leadGroupId = expectDefined(testData.lead.reportingGroupId);
    const otherGroup = await prisma.reportingGroup.create({
      data: {
        id: "a0000000-0000-4000-a000-000000000301",
        name: "Other Group",
        description: null,
      },
    });

    await repo.attachProductToGroup({
      groupId: leadGroupId,
      productId: testData.project.id,
    });

    await expect(
      repo.attachProductToGroup({
        groupId: otherGroup.id,
        productId: testData.project.id,
      }),
    ).rejects.toThrow(/already attached to Test Group/);

    const groups = await repo.listProductGroups(testData.project.id);
    expect(groups.map((g) => g.id)).toEqual([testData.lead.reportingGroupId]);
  });

  // Policy active cascades to derived rules; pause toggle lives on the policy only.
  describe("reminder policy active flag cascades to derived rule status", () => {
    const policyId = "c1111111-1111-4111-8111-111111111111";
    const ruleId = "c2222222-2222-4222-8222-222222222222";

    const buildPolicy = (active: boolean): ReminderPolicy => ({
      id: policyId,
      kind: "deadline",
      offsetMinutes: -1440,
      timezone: "Europe/Moscow",
      audience: "lead-with-draft",
      active,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validUntil: null,
    });

    const seedActiveRule = async () => {
      // Seed the derived row directly so the policy writer does not create a
      // second version during setup; the test targets the false -> true
      // cascade itself.
      await repo.saveReminderPolicy(buildPolicy(false));
      await prisma.reminderRule.create({
        data: {
          id: ruleId,
          policyId,
          kind: "deadline",
          fireAt: new Date("2026-04-11T09:00:00.000Z"),
          deadline: expectDefined(testData.report.deadline),
          timezone: "Europe/Moscow",
          status: "active",
          version: 1,
          reportId: testData.report.id,
        },
      });
    };

    const ruleStatus = async () =>
      (await prisma.reminderRule.findUniqueOrThrow({ where: { id: ruleId } }))
        .status;

    it("saveReminderPolicy(active:false) parks derived rules as paused, and re-activating resumes them", async () => {
      // The fixture uses an April 2026 schedule; freeze the policy writer's
      // clock before that schedule so this test exercises activation rather
      // than the production rule that elapsed reminders stay paused.
      vi.useFakeTimers({
        toFake: ["Date"],
        now: new Date("2026-04-01T00:00:00.000Z"),
      });
      try {
        await seedActiveRule();
        expect(await ruleStatus()).toBe("active");

        await repo.saveReminderPolicy(buildPolicy(false));
        expect(await ruleStatus()).toBe("paused");

        await repo.saveReminderPolicy(buildPolicy(true));
        expect(await ruleStatus()).toBe("active");
      } finally {
        vi.useRealTimers();
      }
    });

    it("deleteReminderPolicy hard-deletes the policy, its rules, and their executions", async () => {
      await seedActiveRule();
      // Seed an execution on the rule so the documented cascade (executions
      // follow their rule on delete) is actually exercised.
      const executionId = "c3333333-3333-4333-8333-333333333333";
      await prisma.reminderExecution.create({
        data: {
          id: executionId,
          ruleId,
          recipientEmail: "lead@test.local",
          dedupeKey: `dk-${ruleId}`,
          status: "sent",
          sentAt: new Date("2026-04-11T09:01:00.000Z"),
          error: null,
          queuePayload: { kind: "deadline" },
        },
      });

      await repo.deleteReminderPolicy(policyId);

      expect(
        await prisma.reminderPolicy.findUnique({ where: { id: policyId } }),
      ).toBeNull();
      expect(
        await prisma.reminderRule.findUnique({ where: { id: ruleId } }),
      ).toBeNull();
      expect(
        await prisma.reminderExecution.findUnique({
          where: { id: executionId },
        }),
      ).toBeNull();
    });
  });
});
