import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

export async function queryActiveReportId(
  prisma: PrismaService,
): Promise<string | null> {
  // Exclude scheduled-future periods: their periodStatus defaults to "open"
  // (the PeriodStatus enum has no "scheduled" value), so a future period
  // would otherwise win the periodStart-desc ordering and be mis-picked as
  // the current period. Requiring periodStart <= now returns the most recent
  // open/reopened period that has actually started.
  const editableReport = await prisma.report.findFirst({
    where: {
      periodStatus: { in: ["open", "reopened"] },
      periodStart: { lte: new Date() },
    },
    orderBy: { periodStart: "desc" },
    select: { id: true },
  });

  if (editableReport) {
    return editableReport.id;
  }

  const publishedReport = await prisma.report.findFirst({
    where: { periodStatus: "published" },
    orderBy: { periodStart: "desc" },
    select: { id: true },
  });

  return publishedReport?.id ?? null;
}

// Newest non-archived open/reopened that has started. No published fallback
// (would defeat open→published race rejection). Secondary id desc: gate and
// latestForViewer call this separately and must pick the same id on ties.
export async function queryCurrentEditableId(
  prisma: PrismaService,
): Promise<string | null> {
  const editableReport = await prisma.report.findFirst({
    where: {
      periodStatus: { in: ["open", "reopened"] },
      periodStart: { lte: new Date() },
      archived: false,
    },
    orderBy: [{ periodStart: "desc" }, { id: "desc" }],
    select: { id: true },
  });

  return editableReport?.id ?? null;
}

// Head reopen / published-fallback target: newest non-archived published;
// id desc tiebreak keeps the pick deterministic on a shared periodStart.
export async function queryLatestPublishedNonArchivedId(
  prisma: PrismaService,
): Promise<string | null> {
  const publishedReport = await prisma.report.findFirst({
    where: { periodStatus: "published", archived: false },
    orderBy: [{ periodStart: "desc" }, { id: "desc" }],
    select: { id: true },
  });

  return publishedReport?.id ?? null;
}
