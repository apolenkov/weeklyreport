import type { PrismaClient } from "@prisma/client";

import { PRODUCT_MARKETING_PORTAL } from "../advanced/seed-advanced.anchors.js";
import {
  ACTION_LOG_IDS,
  REMINDER_POLICY_IDS,
} from "../simple/seed-simple.access-and-policies.js";
import { PROJECT_ACTIVITY_IDS } from "../simple/seed-simple.activities.js";
import { STRESS_PROJECT_IDS } from "../stress/seed-stress-ids.js";
import {
  ACTIVE_REPORT_ID,
  ADMIN_USER_ID,
  LEAD_1_ID,
  LEAD_IGOR_ID,
  LEAD_MARIA_ID,
  PUBLISHED_REPORT_ID,
} from "../support/seed-constants.js";
import type { SeedProfile } from "./seed-profile-contract.js";
import { SEED_PROFILE_SCOPES } from "./seed-profile-scope.js";

const CANONICAL_ROLE_COUNT = 4;
const MARKETING_CONTRIBUTORS = [LEAD_MARIA_ID, LEAD_IGOR_ID] as const;

const requireTrue = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(`Seed journey failed: ${message}`);
};

interface MarketingContribution {
  readonly stageNames: readonly string[];
  readonly reportSection: { readonly authorId: string };
}

interface MarketingAssignment {
  readonly userId: string;
  readonly stage: { readonly name: string };
}

export function assertMarketingCrossAuthorCoverage(
  contributions: readonly MarketingContribution[],
  assignments: readonly MarketingAssignment[],
): void {
  for (const contributorId of MARKETING_CONTRIBUTORS) {
    const contentStages = new Set(
      contributions
        .filter(({ reportSection }) => reportSection.authorId === contributorId)
        .flatMap(({ stageNames }) => stageNames),
    );
    const assignedStages = new Set(
      assignments
        .filter(({ userId }) => userId === contributorId)
        .map(({ stage }) => stage.name),
    );
    requireTrue(
      contentStages.size > 0 && assignedStages.size > 0,
      "full includes both Marketing portal cross-author contributors",
    );
    requireTrue(
      contentStages.size === assignedStages.size &&
        [...contentStages].every((stage) => assignedStages.has(stage)),
      "full aligns Marketing portal cross-author rows with final stage owners",
    );
  }
}

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
  const [
    admin,
    archived,
    activities,
    reopen,
    policies,
    actionLogs,
    settings,
    marketingContributions,
    marketingAssignments,
  ] = await Promise.all([
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
    prisma.item.findMany({
      where: {
        projectId: PRODUCT_MARKETING_PORTAL,
        reportSection: {
          reportId: ACTIVE_REPORT_ID,
          authorId: { in: [...MARKETING_CONTRIBUTORS] },
        },
      },
      select: {
        stageNames: true,
        reportSection: { select: { authorId: true } },
      },
    }),
    prisma.stageAssignment.findMany({
      where: {
        projectId: PRODUCT_MARKETING_PORTAL,
        userId: { in: [...MARKETING_CONTRIBUTORS] },
      },
      select: { userId: true, stage: { select: { name: true } } },
    }),
  ]);

  requireTrue(admin?.role === "admin", "full includes admin identity");
  requireTrue(archived > 0, "full includes archived history");
  requireTrue(activities > 0, "full includes project activities");
  requireTrue(reopen > 0, "full includes a reopen request");
  requireTrue(policies > 0, "full includes policy examples");
  requireTrue(actionLogs > 0, "full includes action-log examples");
  requireTrue(settings !== null, "full includes application settings");
  assertMarketingCrossAuthorCoverage(
    marketingContributions,
    marketingAssignments,
  );
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
