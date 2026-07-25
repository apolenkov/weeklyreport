import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

// Shared by dashboard summary and Prometheus gauge so the two never drift.
/**
 * Query Active Leads Last Published Period.
 * @param prisma - The prisma argument.
 * @param sectionScope - The sectionScope argument.
 */
export async function queryActiveLeadsLastPublishedPeriod(
  prisma: PrismaService,
  sectionScope: Record<string, unknown>,
): Promise<number> {
  const report = await prisma.report.findFirst({
    where: { status: "published" },
    orderBy: { periodStart: "desc" },
    select: { id: true },
  });
  if (!report) return 0;
  const rows = await prisma.reportSection.findMany({
    where: { reportId: report.id, status: "submitted", ...sectionScope },
    distinct: ["authorId"],
    select: { authorId: true },
  });
  return rows.length;
}
