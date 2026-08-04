import type { PrismaClient } from "@prisma/client";

import {
  ACTIVE_REPORT_ID,
  ADMIN_USER_ID,
  LEAD_1_ID,
  PUBLISHED_REPORT_ID,
} from "./seed-constants.js";
import type { SeedProfile } from "./seed-profile-contract.js";
import { SEED_PROFILE_SCOPES } from "./seed-profile-scope.js";
import {
  ACTION_LOG_IDS,
  REMINDER_POLICY_IDS,
} from "./seed-simple.access-and-policies.js";
import { PROJECT_ACTIVITY_IDS } from "./seed-simple.activities.js";
import { STRESS_PROJECT_IDS } from "./seed-stress-ids.js";

const CANONICAL_ROLE_COUNT = 4;

const requireTrue = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(`Seed journey failed: ${message}`);
};

async function runMinimalJourney(prisma: PrismaClient): Promise<void> {
  const active = await prisma.report.findUnique({
    where: { id: ACTIVE_REPORT_ID },
    select: {
      periodState: true,
      sections: {
        where: { authorId: LEAD_1_ID },
        select: { status: true, items: { select: { id: true } } },
      },
    },
  });
  requireTrue(active?.periodState === "open", "minimal active report is open");
  requireTrue(
    (active?.sections.length ?? 0) > 0,
    "minimal lead section exists",
  );
  const section = active?.sections[0];
  requireTrue(
    (section?.items.length ?? 0) > 0,
    "minimal section has an editable item",
  );
}

async function runDemoJourney(prisma: PrismaClient): Promise<void> {
  await runMinimalJourney(prisma);
  const scope = SEED_PROFILE_SCOPES.demo;
  const [roles, health, sections, published, reminders, assignments] =
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
      prisma.reminderRule.count({
        where: { reportId: { in: [...scope.reportIds] } },
      }),
      prisma.stageAssignment.findMany({
        where: { projectId: { in: [...scope.projectIds] } },
        select: { userId: true, project: { select: { leadId: true } } },
      }),
    ]);
  const roleSet = new Set(roles.map(({ role }) => role));
  const healthSet = new Set(health.map(({ status }) => String(status)));
  const sectionSet = new Set(sections.map(({ status }) => status));

  requireTrue(
    roleSet.size === CANONICAL_ROLE_COUNT,
    "demo exposes all four roles",
  );
  requireTrue(
    ["green", "yellow", "red"].every((status) => healthSet.has(status)),
    "demo exposes all three health states",
  );
  requireTrue(
    sectionSet.has("draft") && sectionSet.has("submitted"),
    "demo contrasts draft and submitted sections",
  );
  requireTrue(
    published?.periodState === "published",
    "demo includes a published period",
  );
  requireTrue(reminders > 0, "demo includes reminder rules");
  requireTrue(
    assignments.some(({ userId, project }) => userId !== project.leadId),
    "demo includes foreign stage ownership",
  );
}

async function runFullJourney(prisma: PrismaClient): Promise<void> {
  await runDemoJourney(prisma);
  const scope = SEED_PROFILE_SCOPES.full;
  const [admin, archived, activities, reopen, policies, actionLogs, settings] =
    await Promise.all([
      prisma.user.findUnique({ where: { id: ADMIN_USER_ID } }),
      prisma.report.count({
        where: {
          id: { in: [...scope.reportIds] },
          periodState: "archived",
        },
      }),
      prisma.projectActivity.count({
        where: { id: { in: [...PROJECT_ACTIVITY_IDS] } },
      }),
      prisma.reopenRequest.count({
        where: { reportSection: { reportId: { in: [...scope.reportIds] } } },
      }),
      prisma.reminderPolicy.count({
        where: { id: { in: [...REMINDER_POLICY_IDS] } },
      }),
      prisma.userActionLog.count({
        where: { id: { in: [...ACTION_LOG_IDS] } },
      }),
      prisma.appSettings.findUnique({ where: { id: "singleton" } }),
    ]);

  requireTrue(admin?.role === "admin", "full includes admin identity");
  requireTrue(archived > 0, "full includes archived history");
  requireTrue(activities > 0, "full includes project activities");
  requireTrue(reopen > 0, "full includes a reopen request");
  requireTrue(policies > 0, "full includes policy examples");
  requireTrue(actionLogs > 0, "full includes action-log examples");
  requireTrue(settings !== null, "full includes application settings");
}

async function runStressJourney(prisma: PrismaClient): Promise<void> {
  await runFullJourney(prisma);
  const [projects, items] = await Promise.all([
    prisma.project.count({ where: { id: { in: [...STRESS_PROJECT_IDS] } } }),
    prisma.item.count({
      where: { projectId: { in: [...STRESS_PROJECT_IDS] } },
    }),
  ]);
  requireTrue(
    projects === STRESS_PROJECT_IDS.length,
    "stress includes every deterministic volume project",
  );
  requireTrue(
    items >= STRESS_PROJECT_IDS.length,
    "stress includes query and pagination volume",
  );
}

export async function runProfileJourney(
  prisma: PrismaClient,
  profile: SeedProfile,
): Promise<void> {
  const journeys = {
    minimal: runMinimalJourney,
    demo: runDemoJourney,
    full: runFullJourney,
    stress: runStressJourney,
  } as const;
  await journeys[profile](prisma);
}
