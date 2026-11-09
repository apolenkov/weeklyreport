import { Inject, Injectable } from "@nestjs/common";
import {
  mapPrismaToAuthorReportSection,
  reportSectionFullInclude,
} from "@weeklyreport/report-persistence";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { currentEditableReportWhere } from "../../../lib/report-lifecycle.js";
import type {
  RetainedSource,
  RetainedSourceReader,
  RetainedSourceRequest,
} from "../application/retained-incomplete-records.service.js";
import { privateDraftOwnerWhere } from "./private-draft-entitlement.js";

const sourceReportSelect = {
  periodStart: true,
  periodEnd: true,
  status: true,
  periodStatus: true,
  archived: true,
} as const;

// Same pick as the lead form's route (newest started editable report, id as
// the tie-break), so "on the current form" means the same report in both.
async function isOnCurrentForm(
  prisma: PrismaService,
  reportId: string,
): Promise<boolean> {
  const current = await prisma.report.findFirst({
    where: currentEditableReportWhere(),
    orderBy: [{ periodStart: "desc" }, { id: "desc" }],
    select: { id: true },
  });
  return current?.id === reportId;
}

/**
 * Reads one own source section for private recovery. Ownership and the
 * actor's current active authoring role are part of the same statement that
 * selects the section, so a foreign, demoted or deactivated actor gets the
 * same empty answer as a missing source. Read-only: it never provisions a
 * section and writes nothing.
 */
export async function queryRetainedSource(
  prisma: PrismaService,
  { actorId, reportId, reportSectionId }: RetainedSourceRequest,
): Promise<RetainedSource | null> {
  const row = await prisma.reportSection.findFirst({
    where: {
      id: reportSectionId,
      reportId,
      ...privateDraftOwnerWhere(actorId),
    },
    include: {
      ...reportSectionFullInclude,
      report: { select: sourceReportSelect },
    },
    relationLoadStrategy: "join",
  });
  if (!row) return null;

  const { report, ...sectionRow } = row;
  const section = mapPrismaToAuthorReportSection(sectionRow);
  return {
    reportId: section.reportId,
    reportSectionId: section.reportSectionId,
    periodStart: report.periodStart,
    periodEnd: report.periodEnd,
    lifecycle: {
      status: report.status,
      periodStatus: report.periodStatus,
      archived: report.archived,
    },
    onCurrentForm: await isOnCurrentForm(prisma, section.reportId),
    risks: section.risks,
    decisions: section.decisions,
  };
}

/** Prisma adapter for the private recovery read. */
@Injectable()
export class RetainedSourcePrismaReader implements RetainedSourceReader {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  readOwnSource(
    request: RetainedSourceRequest,
  ): Promise<RetainedSource | null> {
    return queryRetainedSource(this.prisma, request);
  }
}
