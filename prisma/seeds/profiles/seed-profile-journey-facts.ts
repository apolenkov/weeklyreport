import type { PrismaClient } from "@prisma/client";

import { PUBLISHED_REPORT_ID } from "../support/seed-constants.js";
import { SEED_PROFILE_SCOPES } from "./seed-profile-scope.js";

/** Reads the demo-profile rows the journey assertions inspect, in one round trip. */
export async function loadDemoFacts(
  prisma: PrismaClient,
  scope: (typeof SEED_PROFILE_SCOPES)["demo"],
) {
  const [roles, health, sections, published, reminders, assignments, reopen] =
    await Promise.all([
      prisma.user.groupBy({
        by: ["role"],
        where: { id: { in: [...scope.userIds] } },
      }),
      prisma.projectStatus.groupBy({
        by: ["status"],
        where: {
          reportSection: { reportId: { in: [...scope.reportIds] } },
          projectId: { in: [...scope.projectIds] },
        },
      }),
      prisma.reportSection.groupBy({
        by: ["status"],
        where: { reportId: { in: [...scope.reportIds] } },
      }),
      prisma.report.findUnique({
        where: { id: PUBLISHED_REPORT_ID },
        select: { periodState: true },
      }),
      prisma.reminderRule.findMany({
        where: {
          reportId: { in: [...scope.reportIds] },
          status: "active",
        },
        select: {
          id: true,
          kind: true,
          fireAt: true,
          deadline: true,
          timezone: true,
          report: { select: { deadline: true } },
          policy: {
            select: {
              kind: true,
              offsetMinutes: true,
              timezone: true,
              active: true,
              validFrom: true,
              validUntil: true,
            },
          },
        },
      }),
      prisma.stageAssignment.findMany({
        where: { projectId: { in: [...scope.projectIds] } },
        select: { userId: true, project: { select: { leadId: true } } },
      }),
      prisma.reopenRequest.findMany({
        where: {
          status: "pending",
          reportSection: { reportId: { in: [...scope.reportIds] } },
        },
        select: {
          id: true,
          reportSection: {
            select: {
              status: true,
              report: {
                select: {
                  id: true,
                  archived: true,
                  periodState: true,
                  periodStatus: true,
                },
              },
            },
          },
        },
      }),
    ]);
  return { roles, health, sections, published, reminders, assignments, reopen };
}
