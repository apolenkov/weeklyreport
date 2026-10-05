import {
  computeReminderFireAt,
  reminderPolicyAppliesTo,
} from "@customreport/shared";
import {
  type PrismaClient,
  type ReminderRuleKind,
  type Report,
  type ReportSectionStatus,
} from "@prisma/client";

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
  LEAD_OLGA_ID,
} from "../support/seed-constants.js";
import type { SeedProfile } from "./seed-profile-contract.js";
import { loadDemoFacts } from "./seed-profile-journey-facts.js";
import { SEED_PROFILE_SCOPES } from "./seed-profile-scope.js";

const CANONICAL_ROLE_COUNT = 4;

const requireTrue = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(`Seed journey failed: ${message}`);
};

interface ActiveReminderRuleJourneyRow {
  readonly id: string;
  readonly kind: ReminderRuleKind;
  readonly fireAt: Date;
  readonly deadline: Date;
  readonly timezone: string;
  readonly report: { readonly deadline: Date | null };
  readonly policy: {
    readonly kind: ReminderRuleKind;
    readonly offsetMinutes: number;
    readonly timezone: string;
    readonly active: boolean;
    readonly validFrom: Date;
    readonly validUntil: Date | null;
  };
}

interface PendingReopenRequestJourneyRow {
  readonly id: string;
  readonly reportSection: {
    readonly status: ReportSectionStatus;
    readonly report: Pick<
      Report,
      "id" | "archived" | "periodState" | "periodStatus"
    >;
  };
}

export function assertActiveReminderRuleIntegrity(
  rules: readonly ActiveReminderRuleJourneyRow[],
): void {
  requireTrue(rules.length > 0, "demo includes active reminder rules");
  const problems = rules.flatMap((rule) => {
    const reportDeadline = rule.report.deadline;
    if (!reportDeadline) return [`${rule.id}: report deadline is absent`];
    const expectedFireAt = computeReminderFireAt(
      reportDeadline,
      rule.policy.offsetMinutes,
    );
    const valid =
      rule.kind === rule.policy.kind &&
      rule.timezone === rule.policy.timezone &&
      rule.deadline.getTime() === reportDeadline.getTime() &&
      rule.fireAt.getTime() === expectedFireAt.getTime() &&
      reminderPolicyAppliesTo(rule.policy, reportDeadline);
    return valid
      ? []
      : [`${rule.id}: schedule does not match report and policy`];
  });
  requireTrue(
    problems.length === 0,
    `demo reminder integrity failed: ${problems.join("; ")}`,
  );
}

export function assertPendingReopenRequestIntegrity(
  requests: readonly PendingReopenRequestJourneyRow[],
): void {
  requireTrue(
    requests.length === 1,
    "demo includes exactly one actionable pending reopen request",
  );
  const invalidIds = requests
    .filter(
      ({ reportSection }) =>
        reportSection.status !== "submitted" ||
        reportSection.report.id !== ACTIVE_REPORT_ID ||
        reportSection.report.periodState !== "open" ||
        reportSection.report.periodStatus !== "open" ||
        reportSection.report.archived,
    )
    .map(({ id }) => id);
  requireTrue(
    invalidIds.length === 0,
    `demo pending reopen request is not actionable: ${invalidIds.join(", ")}`,
  );
}

async function runMinimalJourney(
  prisma: PrismaClient,
  leadId = LEAD_1_ID,
  profileLabel = "minimal",
): Promise<void> {
  const active = await prisma.report.findUnique({
    where: { id: ACTIVE_REPORT_ID },
    select: {
      periodState: true,
      sections: {
        where: { authorId: leadId },
        select: { status: true, items: { select: { id: true } } },
      },
    },
  });
  const message = (value: string): string => `${profileLabel} ${value}`;
  requireTrue(active?.periodState === "open", message("active report is open"));
  requireTrue(
    (active?.sections.length ?? 0) > 0,
    message("lead section exists"),
  );
  const section = active?.sections[0];
  requireTrue(section?.status === "draft", message("lead section is draft"));
  requireTrue((section?.items.length ?? 0) > 0, message("draft has an item"));
}

async function runDemoJourney(
  prisma: PrismaClient,
  draftLeadId: string = LEAD_1_ID,
  profileLabel = "minimal",
): Promise<void> {
  await runMinimalJourney(prisma, draftLeadId, profileLabel);
  const scope = SEED_PROFILE_SCOPES.demo;
  const { roles, health, sections, published, reminders, assignments, reopen } =
    await loadDemoFacts(prisma, scope);
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
  assertActiveReminderRuleIntegrity(reminders);
  assertPendingReopenRequestIntegrity(reopen);
  requireTrue(
    assignments.some(({ userId, project }) => userId !== project.leadId),
    "demo includes foreign stage ownership",
  );
}

async function runFullJourney(prisma: PrismaClient): Promise<void> {
  await runDemoJourney(prisma, LEAD_OLGA_ID, "full");
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
  requireTrue(reopen === 1, "full includes exactly one reopen request");
  requireTrue(policies > 0, "full includes policy examples");
  requireTrue(
    actionLogs === ACTION_LOG_IDS.length,
    "full includes every profile-owned action-log example",
  );
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
