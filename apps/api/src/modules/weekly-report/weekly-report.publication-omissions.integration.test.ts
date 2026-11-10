// The publication confirmation counts unfinished records across every group,
// because a publication freezes them all, while the report notice stays inside
// the reader's own scope (openspec: lead-incomplete-record-drafts, "Publication
// confirmation covers every group").
import type { UserSession } from "@weeklyreport/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper";
import { WeeklyReportPrismaRepository } from "./weekly-report.prisma-repository";

describe("weekly report publication omission totals (integration)", () => {
  const prisma = createTestPrisma();
  const repo = new WeeklyReportPrismaRepository(
    prisma as unknown as PrismaService,
  );

  const GROUP_A = "b0000000-0000-4000-a000-0000000000a1";
  const GROUP_B = "b0000000-0000-4000-a000-0000000000a2";
  const LEAD_A = "b0000000-0000-4000-a000-0000000000c1";
  const LEAD_B = "b0000000-0000-4000-a000-0000000000c2";
  const PROJECT_A = "b0000000-0000-4000-a000-0000000000d1";
  const PROJECT_B = "b0000000-0000-4000-a000-0000000000d2";
  const REPORT = "b0000000-0000-4000-a000-0000000000e1";

  const session = (
    role: UserSession["role"],
    over: Partial<UserSession> = {},
  ): UserSession => ({
    userId: "00000000-0000-4000-a000-0000000000f1",
    email: "reader@example.test",
    name: "Reader",
    role,
    ...over,
  });

  const lead = (id: string, tag: string, reportingGroupId: string) => ({
    id,
    email: `lead-${tag}@test.local`,
    name: `Lead ${tag}`,
    lastName: "Lead",
    firstName: tag,
    role: "lead" as const,
    samlId: `publication-omissions-lead-${tag}`,
    reportingGroupId,
  });

  const read = async (reader: UserSession) =>
    expectDefined(await repo.getWeeklyReport(REPORT, reader)).readModel;

  beforeEach(async () => {
    await cleanDatabase();
    await prisma.reportingGroup.createMany({
      data: [
        { id: GROUP_A, name: "Group A" },
        { id: GROUP_B, name: "Group B" },
      ],
    });
    await prisma.user.createMany({
      data: [lead(LEAD_A, "a", GROUP_A), lead(LEAD_B, "b", GROUP_B)],
    });
    await prisma.project.createMany({
      data: [
        { id: PROJECT_A, name: "Product A", leadId: LEAD_A },
        { id: PROJECT_B, name: "Product B", leadId: LEAD_B },
      ],
    });
    await prisma.groupProduct.createMany({
      data: [
        { groupId: GROUP_A, productId: PROJECT_A },
        { groupId: GROUP_B, productId: PROJECT_B },
      ],
    });
    await prisma.report.create({
      data: {
        id: REPORT,
        periodStart: new Date("2026-05-04"),
        periodEnd: new Date("2026-05-10"),
        deadline: new Date("2026-05-08T15:00:00.000Z"),
        status: "draft",
        periodStatus: "open",
      },
    });
    for (const [authorId, projectId] of [
      [LEAD_A, PROJECT_A],
      [LEAD_B, PROJECT_B],
    ] as const) {
      const section = await prisma.reportSection.create({
        data: { reportId: REPORT, authorId, status: "draft" },
      });
      const record = {
        reportSectionId: section.id,
        stageNames: ["Development"],
      };
      await prisma.risk.createMany({
        data: [
          {
            ...record,
            projectId,
            risk: "Unfinished",
            impact: null,
            mitigation: null,
            severity: "at-risk",
          },
          {
            ...record,
            projectId,
            risk: "Finished",
            impact: "Date slips",
            mitigation: "Second vendor",
            severity: "at-risk",
          },
        ],
      });
    }
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("tells a Head every group's total for publishing, their own group's for reading", async () => {
    const model = await read(session("head", { reportingGroupId: GROUP_A }));

    expect(model.leadSections).toHaveLength(1);
    expect(model.recordOmissions).toEqual({
      risks: 1,
      decisions: 0,
      unknown: false,
    });
    expect(model.publicationOmissions).toEqual({
      risks: 2,
      decisions: 0,
      unknown: false,
    });
  });

  it("gives a reader who cannot publish no publication total", async () => {
    const model = await read(
      session("viewer", { viewerGroupAccess: [GROUP_A] }),
    );

    expect(model.recordOmissions.risks).toBe(1);
    expect(model).not.toHaveProperty("publicationOmissions");
  });
});
