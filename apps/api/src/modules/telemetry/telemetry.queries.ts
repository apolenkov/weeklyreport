import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

/**
 * Distinct lead authors who submitted a section in the single most-recently
 * published period; 0 when no period is published yet. Backs the active-leads
 * KPI — shared by both the `/dashboard` summary repository and the Prometheus
 * gauge so the two can never drift apart.
 */
export async function queryActiveLeadsLastPublishedPeriod(
  prisma: PrismaService,
): Promise<number> {
  const report = await prisma.report.findFirst({
    where: { status: "published" },
    orderBy: { periodStart: "desc" },
    select: { id: true },
  });
  if (!report) return 0;
  const rows = await prisma.reportSection.findMany({
    where: { reportId: report.id, status: "submitted" },
    distinct: ["authorId"],
    select: { authorId: true },
  });
  return rows.length;
}
