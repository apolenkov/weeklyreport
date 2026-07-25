// UserActionLog, AppSettings and ViewerGroupAccess are the wipe sentinels:
// they sit outside seedTestData's fixture graph, so cleanDatabase's dynamic
// table discovery is the only thing that reaches them — a regression there
// fails these tests first.

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "./prisma-test-helper";

describe("prisma-test-helper (integration)", () => {
  const prisma = createTestPrisma();

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  it("wipes UserActionLog rows (no FK — easy to miss from cleanDatabase)", async () => {
    // UserActionLog.userId is a plain String (no FK), so no seed row needed.
    await prisma.userActionLog.create({
      data: {
        userId: "a0000000-0000-4000-a000-000000000001",
        procedure: "test.probe",
        status: "success",
        correlationId: "test-corr-id",
        durationMs: 1,
      },
    });

    await cleanDatabase(prisma);

    const count = await prisma.userActionLog.count();
    expect(count).toBe(0);
  });

  it("wipes AppSettings rows (singleton table must be included in cleanDatabase)", async () => {
    await prisma.appSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton" },
      update: {},
    });

    await cleanDatabase(prisma);

    const count = await prisma.appSettings.count();
    expect(count).toBe(0);
  });

  it("wipes ViewerGroupAccess rows (join table must be included in cleanDatabase)", async () => {
    // ViewerGroupAccess requires a User and a ReportingGroup (both onDelete Cascade).
    const group = await prisma.reportingGroup.create({
      data: {
        id: "b0000000-0000-4000-a000-000000000001",
        name: "Viewer Test Group",
        description: null,
      },
    });
    const viewer = await prisma.user.create({
      data: {
        id: "b0000000-0000-4000-a000-000000000002",
        email: "viewer@test.local",
        name: "Viewer User",
        lastName: "Viewer",
        firstName: "User",
        role: "viewer",
        samlId: "viewer-test",
        reportingGroupId: group.id,
      },
    });
    await prisma.viewerGroupAccess.create({
      data: { viewerUserId: viewer.id, groupId: group.id },
    });

    await cleanDatabase(prisma);

    const count = await prisma.viewerGroupAccess.count();
    expect(count).toBe(0);
  });

  it("seedTestData succeeds on the post-TRUNCATE empty DB and FK integrity is preserved", async () => {
    const { head, lead, project, report } = await seedTestData(prisma);

    const dbReport = await prisma.report.findUniqueOrThrow({
      where: { id: report.id },
    });
    const dbSection = await prisma.reportSection.findFirst({
      where: { reportId: report.id },
    });
    const dbProject = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
    });

    // Roles are re-read from the DB — asserting on seedTestData's return
    // values would only echo the literals passed to prisma.user.create.
    const dbHead = await prisma.user.findUniqueOrThrow({
      where: { id: head.id },
    });
    const dbLead = await prisma.user.findUniqueOrThrow({
      where: { id: lead.id },
    });

    expect(dbReport.id).toBe(report.id);
    expect(dbSection?.authorId).toBe(lead.id);
    expect(dbProject.leadId).toBe(lead.id);
    expect(dbHead.role).toBe("head");
    expect(dbLead.role).toBe("lead");
  });
});
