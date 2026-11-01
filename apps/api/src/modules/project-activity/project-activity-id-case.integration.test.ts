// Real-DB coverage that project-activity commands accept uppercase reference
// ids from the wire and store them in their canonical lowercase form. The
// schema folds case once; this proves the folded ids reach the database.
import type { UserSession } from "@weeklyreport/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { createAppRouter } from "../../infrastructure/trpc/trpc.router.js";
import { createNullLogger } from "../../lib/logger.js";
import { createNullAuditLogger } from "../../test-utils/audit-logger.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper.js";
import { createStubAppRouterDeps } from "../../test-utils/stub-app-router-deps.js";
import { ProjectActivityService } from "./index.js";
import { ProjectActivityPrismaRepository } from "./project-activity.prisma-repository.js";

const prisma = createTestPrisma();

const groupId = "b0000000-0000-4000-a000-000000000001";
const leadA = "b0000000-0000-4000-a000-000000000002";
const leadB = "b0000000-0000-4000-a000-000000000003";
const productId = "b0000000-0000-4000-a000-000000000004";
const reportId = "b0000000-0000-4000-a000-000000000005";
const activityId = "b0000000-0000-4000-a000-000000000006";
const adminId = "b0000000-0000-4000-a000-0000000000ad";

const upper = (value: string): string => value.toUpperCase();

const adminSession: UserSession = {
  userId: adminId,
  email: "admin@test.local",
  name: "Test Admin",
  role: "admin",
  activeReportId: null,
  activeReportSectionId: null,
};

function adminCaller() {
  const projectActivityService = new ProjectActivityService(
    new ProjectActivityPrismaRepository(prisma as unknown as PrismaService),
  );
  return createAppRouter(
    createStubAppRouterDeps({ prisma, projectActivityService }),
  ).createCaller({
    session: adminSession,
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
}

describe("project activity commands canonicalize uppercase ids (integration)", () => {
  beforeEach(async () => {
    await cleanDatabase();
    await prisma.reportingGroup.create({
      data: { id: groupId, name: "Software Development" },
    });
    await prisma.user.createMany({
      data: [
        {
          id: leadA,
          email: "lead-a@test.local",
          name: "Lead A",
          lastName: "Lead",
          firstName: "A",
          role: "lead",
          samlId: "pa-lead-a",
          reportingGroupId: groupId,
        },
        {
          id: leadB,
          email: "lead-b@test.local",
          name: "Lead B",
          lastName: "Lead",
          firstName: "B",
          role: "lead",
          samlId: "pa-lead-b",
          reportingGroupId: groupId,
        },
      ],
    });
    await prisma.project.create({
      data: { id: productId, name: "CRM Portal", leadId: leadA },
    });
    await prisma.groupProduct.create({
      data: { groupId, productId },
    });
    await prisma.report.create({
      data: {
        id: reportId,
        periodStart: new Date("2026-06-29T00:00:00.000Z"),
        periodEnd: new Date("2026-07-05T00:00:00.000Z"),
        deadline: new Date("2026-07-03T15:00:00.000Z"),
        status: "draft",
        periodStatus: "open",
        periodState: "open",
      },
    });
    await prisma.projectActivity.create({
      data: {
        id: activityId,
        name: "Jira triage duty",
        groupId,
        activityProducts: { create: [{ productId }] },
        jiraAccounts: ["OPS"],
      },
    });
    await prisma.projectActivityLead.createMany({
      data: [
        { activityId, leadId: leadA },
        { activityId, leadId: leadB },
      ],
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("update stores the lowercase group and product ids under an uppercase request", async () => {
    const response = await adminCaller().projectActivity.update({
      id: upper(activityId),
      name: "Renamed triage duty",
      groupId: upper(groupId),
      linkedProductIds: [upper(productId)],
      jiraAccounts: ["OPS"],
    });

    expect(response.id).toBe(activityId);
    expect(response.groupId).toBe(groupId);
    const row = await prisma.projectActivity.findUnique({
      where: { id: activityId },
      include: { activityProducts: true },
    });
    expect(row).toMatchObject({ name: "Renamed triage duty", groupId });
    expect(row?.activityProducts.map((link) => link.productId)).toEqual([
      productId,
    ]);
  });

  it("archive sets the archived flag on the lowercase row", async () => {
    await adminCaller().projectActivity.archive({
      id: upper(activityId),
      archived: true,
    });

    await expect(
      prisma.projectActivity.findUnique({ where: { id: activityId } }),
    ).resolves.toMatchObject({ archived: true });
  });

  it("detach then attach with uppercase ids leaves exactly one lowercase lead edge", async () => {
    const caller = adminCaller();

    await caller.projectActivity.detachLead({
      activityId: upper(activityId),
      leadId: upper(leadA),
    });
    await expect(
      prisma.projectActivityLead.findMany({
        where: { activityId, leadId: leadA },
      }),
    ).resolves.toHaveLength(0);

    await caller.projectActivity.attachLead({
      activityId: upper(activityId),
      leadId: upper(leadA),
    });

    await expect(
      prisma.projectActivityLead.findMany({
        where: { activityId, leadId: leadA },
      }),
    ).resolves.toHaveLength(1);
    await expect(
      prisma.projectActivityLead.findMany({
        where: { activityId: upper(activityId), leadId: upper(leadA) },
      }),
    ).resolves.toHaveLength(0);
  });

  it("create stores the group and linked products in lowercase", async () => {
    const created = await adminCaller().projectActivity.create({
      name: "Weekend on-call",
      groupId: upper(groupId),
      linkedProductIds: [upper(productId)],
      jiraAccounts: [],
    });

    expect(created.groupId).toBe(groupId);
    const row = await prisma.projectActivity.findUnique({
      where: { id: created.id },
      include: { activityProducts: true },
    });
    expect(row).toMatchObject({ name: "Weekend on-call", groupId });
    expect(row?.activityProducts.map((link) => link.productId)).toEqual([
      productId,
    ]);
  });
});
