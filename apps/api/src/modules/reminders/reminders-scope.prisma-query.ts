import type { UserSession } from "@customreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { groupScopeFilter } from "../../lib/group-scope.js";

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

export async function queryInScopeDraftSectionId(
  prisma: PrismaService,
  session: UserSession,
  reportId: string,
  recipientEmail: string,
): Promise<string | null> {
  const section = await prisma.reportSection.findFirst({
    where: {
      reportId,
      status: "draft",
      author: { email: recipientEmail },
      AND: [groupScopeFilter(session, "reportSection")],
    },
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
    where: { reportId, AND: [groupScopeFilter(session, "reportSection")] },
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
    where: { id: leadId, ...groupScopeFilter(session, "user") },
    select: { id: true },
  });
  return lead?.id ?? null;
}

export function queryActiveRuleForDispatch(
  prisma: PrismaService,
  reportId: string,
  ruleId?: string,
): Promise<{ id: string; fireAt: Date } | null> {
  return prisma.reminderRule.findFirst({
    where: {
      reportId,
      status: "active",
      ...(ruleId ? { id: ruleId } : {}),
    },
    orderBy: { fireAt: "asc" },
    select: { id: true, fireAt: true },
  });
}

export async function queryDraftSectionsForDispatch(
  prisma: PrismaService,
  session: UserSession,
  reportId: string,
  leadId?: string,
): Promise<{ email: string; notificationOptOut: boolean }[]> {
  const sections = await prisma.reportSection.findMany({
    where: {
      reportId,
      status: "draft",
      ...(leadId ? { authorId: leadId } : {}),
      ...groupScopeFilter(session, "reportSection"),
    },
    include: {
      author: { select: { email: true, notificationOptOut: true } },
    },
  });
  return sections.map((s) => s.author);
}
