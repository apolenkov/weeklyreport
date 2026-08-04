import type { Prisma } from "@prisma/client";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

// Typed Prisma where fragments, never a bare Record bag — the report scope
// gates which periods settle and the section scope gates which lead sections
// aggregate, so both must stay Prisma-checked at every call site.
type ReportScope = Prisma.ReportWhereInput;
type SectionScope = Prisma.ReportSectionWhereInput;

// A reopened period is editable again, so settled metrics fall back to the
// latest period whose lifecycle flavour is still published.
export async function querySettledPeriodIds(
  prisma: PrismaService,
  take: number,
  reportScope: ReportScope = {},
): Promise<string[]> {
  const reports = await prisma.report.findMany({
    where: { periodStatus: "published", ...reportScope },
    orderBy: { periodStart: "desc" },
    take,
    select: { id: true },
  });
  return reports.map(({ id }) => id);
}

// Shared by dashboard summary and Prometheus gauge so the two never drift.
export async function queryActiveLeadsLastPublishedPeriod(
  prisma: PrismaService,
  sectionScope: SectionScope,
): Promise<number> {
  const scoped = Object.keys(sectionScope).length > 0;
  const [reportId] = await querySettledPeriodIds(
    prisma,
    1,
    scoped ? { sections: { some: sectionScope } } : {},
  );
  if (!reportId) return 0;
  const rows = await prisma.reportSection.findMany({
    where: { reportId, status: "submitted", ...sectionScope },
    distinct: ["authorId"],
    select: { authorId: true },
  });
  return rows.length;
}
