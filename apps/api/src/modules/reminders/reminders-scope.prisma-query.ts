import {
  computeReminderFireAt,
  reminderPolicyAppliesTo,
  type UserSession,
} from "@customreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { groupScopeFilter } from "../../lib/group-scope.js";
import { editableReminderReportWhere } from "./reminders-editable-report.prisma.js";

// Changing a predicate here changes who is authorized (fail-closed scope).

export function queryRuleReportId(
  prisma: PrismaService,
  ruleId: string,
): Promise<string | null> {
  return prisma.reminderRule
    .findUnique({ where: { id: ruleId }, select: { reportId: true } })
    .then((rule) => rule?.reportId ?? null);
}

// Scope fragment filters on author — AND avoids clobbering a sibling author predicate.
export async function queryInScopeSectionId(
  prisma: PrismaService,
  session: UserSession,
  reportId: string,
): Promise<string | null> {
  const section = await prisma.reportSection.findFirst({
    where: { reportId, AND: [groupScopeFilter(session, "reportSection")] },
    select: { id: true },
  });
  return section?.id ?? null;
}

export async function queryInScopeSectionAuthorEmails(
  prisma: PrismaService,
  session: UserSession,
  reportId: string,
): Promise<string[]> {
  const sections = await prisma.reportSection.findMany({
    where: {
      reportId,
      AND: [
        groupScopeFilter(session, "reportSection"),
        { author: { isActive: true } },
      ],
    },
    select: { author: { select: { email: true } } },
  });
  return sections.map((s) => s.author.email);
}

export async function queryInScopeLeadId(
  prisma: PrismaService,
  session: UserSession,
  leadId: string,
): Promise<string | null> {
  const lead = await prisma.user.findFirst({
    where: {
      id: leadId,
      isActive: true,
      AND: [groupScopeFilter(session, "user")],
    },
    select: { id: true },
  });
  return lead?.id ?? null;
}

export function queryActiveRuleForDispatch(
  prisma: PrismaService,
  reportId: string,
  ruleId: string,
): Promise<{ id: string; fireAt: Date; deadline: Date } | null> {
  return prisma.reminderRule
    .findFirst({
      where: {
        reportId,
        id: ruleId,
        kind: "deadline",
        status: "active",
        policy: { active: true },
        // Manual and automated dispatch share the exact editable lifecycle.
        report: editableReminderReportWhere,
      },
      select: {
        id: true,
        kind: true,
        fireAt: true,
        deadline: true,
        timezone: true,
        report: { select: { deadline: true } },
        policy: true,
      },
    })
    .then((rule) => {
      if (rule === null) return null;
      if (rule.report.deadline === null) return null;
      const reportDeadline = rule.report.deadline;
      if (
        rule.deadline.getTime() !== reportDeadline.getTime() ||
        rule.kind !== rule.policy.kind ||
        rule.timezone !== rule.policy.timezone ||
        !reminderPolicyAppliesTo(rule.policy, reportDeadline) ||
        rule.fireAt.getTime() !==
          computeReminderFireAt(
            reportDeadline,
            rule.policy.offsetMinutes,
          ).getTime()
      ) {
        return null;
      }
      return { id: rule.id, fireAt: rule.fireAt, deadline: rule.deadline };
    });
}

export async function queryDraftSectionsForDispatch(
  prisma: PrismaService,
  session: UserSession,
  reportId: string,
  leadId?: string,
): Promise<{ email: string; name: string; notificationOptOut: boolean }[]> {
  const sections = await prisma.reportSection.findMany({
    where: {
      reportId,
      status: "draft",
      report: editableReminderReportWhere,
      ...(leadId ? { authorId: leadId } : {}),
      AND: [
        groupScopeFilter(session, "reportSection"),
        { author: { isActive: true } },
      ],
    },
    include: {
      author: { select: { email: true, name: true, notificationOptOut: true } },
    },
  });
  return sections.map((s) => s.author);
}
