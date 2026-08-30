import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

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
