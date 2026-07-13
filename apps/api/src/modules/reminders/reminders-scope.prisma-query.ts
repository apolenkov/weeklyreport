import type { UserSession } from "@customreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { groupScopeFilter } from "../../lib/group-scope.js";

/**
 * Verbatim query transplants backing `RemindersService`'s scope-assertion
 * methods and `dispatchPendingReminders`, split out of
 * `RemindersPrismaRepository` to keep that file cohesive. Every function
 * mirrors the where-clause a reminders authorization check evaluated before
 * this module existed; changing a predicate here changes who is authorized.
 */

/** A reminder rule's report id, or null when the rule is missing or reportless. */
export function queryRuleReportId(
  prisma: PrismaService,
  ruleId: string,
): Promise<string | null> {
  return prisma.reminderRule
    .findUnique({ where: { id: ruleId }, select: { reportId: true } })
    .then((rule) => rule?.reportId ?? null);
}

/**
 * Id of an in-scope `ReportSection` on `reportId`, or null when none exists.
 * The scope fragment filters on `author`, so it is applied via `AND` to avoid
 * clobbering any sibling `author` predicate a caller adds later.
 */
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

/**
 * Id of an in-scope DRAFT `ReportSection` on `reportId` authored by
 * `recipientEmail`, or null when none exists.
 */
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

/** Author emails of every in-scope `ReportSection` on `reportId`. */
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

/** Id of an in-scope `User` row for `leadId`, or null when out of reach. */
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

/**
 * The newest active reminder rule for `reportId`, optionally narrowed to
 * `ruleId`. Only the fields `dispatchPendingReminders` reads are selected.
 */
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

/**
 * Draft sections on `reportId`, scoped to the caller's group and optionally
 * narrowed to one lead's authored section — the dispatch candidate set.
 */
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

/**
 * `createdAt` of the `ReminderExecution` matching `dedupeKey`, or null.
 * Backs the race-safe dispatch read-back: the caller compares this against
 * the call window to distinguish "this call inserted the row" from "a
 * concurrent tick deduplicated against a prior dispatch".
 */
export function queryExecutionCreatedAt(
  prisma: PrismaService,
  dedupeKey: string,
): Promise<Date | null> {
  return prisma.reminderExecution
    .findUnique({ where: { dedupeKey }, select: { createdAt: true } })
    .then((execution) => execution?.createdAt ?? null);
}
