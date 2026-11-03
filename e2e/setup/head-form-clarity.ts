import assert from "node:assert/strict";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

import { validateE2eRuntimeTarget } from "./runtime-target.js";

export const HEAD_CLARITY = {
  activityName: "E2E Head review duty",
  risk: "E2E Head Activity risk",
  detachedRisk: "E2E Head detached Activity risk",
  draftRisk: "E2E Head draft risk",
  comment: "E2E Head risk feedback",
} as const;

/** Runs only after the browser harness has reset and seeded its guarded target. */
export async function prepareHeadClarity() {
  const target = validateE2eRuntimeTarget("e2e-head-form-clarity");
  const pool = new pg.Pool({ connectionString: target.e2eDatabaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const report = await prisma.report.findFirstOrThrow({
      where: { periodState: "open", archived: false },
      include: {
        sections: { include: { author: true }, orderBy: { id: "asc" } },
      },
    });
    const [productAuthor, activityAuthor, draftAuthor] = report.sections;
    assert(productAuthor && activityAuthor && draftAuthor);
    const { activity, detached } = await createActivities(prisma);
    for (const section of [productAuthor, activityAuthor]) {
      await prisma.reportSection.update({
        where: { id: section.id },
        data: { status: "submitted", submittedAt: new Date() },
      });
      await prisma.projectActivityLead.create({
        data: { activityId: activity.id, leadId: section.authorId },
      });
      await prisma.activityStatus.create({
        data: {
          reportSectionId: section.id,
          activityId: activity.id,
          status: "yellow",
        },
      });
    }
    await prisma.stageStatus.deleteMany({
      where: { reportSectionId: activityAuthor.id },
    });
    await prisma.projectStatus.deleteMany({
      where: { reportSectionId: activityAuthor.id },
    });
    const reparent = {
      where: { reportSectionId: activityAuthor.id },
      data: { projectId: null, activityId: activity.id, stageNames: [] },
    };
    await prisma.item.updateMany(reparent);
    await prisma.risk.updateMany(reparent);
    await prisma.decision.updateMany({
      where: { reportSectionId: activityAuthor.id },
      data: { productId: null, activityId: activity.id, stageNames: [] },
    });
    const risk = await prisma.risk.create({
      data: riskData(activityAuthor.id, activity.id, HEAD_CLARITY.risk),
    });
    await prisma.risk.create({
      data: riskData(activityAuthor.id, detached.id, HEAD_CLARITY.detachedRisk),
    });
    await prisma.reportSection.update({
      where: { id: draftAuthor.id },
      data: { status: "draft", submittedAt: null },
    });
    await prisma.risk.create({
      data: riskData(draftAuthor.id, detached.id, HEAD_CLARITY.draftRisk),
    });
    return {
      reportId: report.id,
      authorId: activityAuthor.authorId,
      authorName: activityAuthor.author.name,
      sectionId: activityAuthor.id,
      version: activityAuthor.version,
      riskId: risk.id,
    };
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function createActivities(prisma: PrismaClient) {
  const group = await prisma.reportingGroup.findFirstOrThrow();
  const activity = await prisma.projectActivity.create({
    data: {
      name: HEAD_CLARITY.activityName,
      groupId: group.id,
      jiraAccounts: [],
    },
  });
  const detached = await prisma.projectActivity.create({
    data: { name: "E2E detached parent", groupId: group.id, jiraAccounts: [] },
  });
  return { activity, detached };
}

function riskData(reportSectionId: string, activityId: string, risk: string) {
  return {
    reportSectionId,
    activityId,
    risk,
    impact: "Release delayed",
    mitigation: "Escalate",
    severity: "at_risk",
  };
}
