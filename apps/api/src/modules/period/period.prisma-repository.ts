import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { PeriodRepository } from './period.service.js';

@Injectable()
export class PeriodPrismaRepository implements PeriodRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getReportById(
    reportId: string,
  ): Promise<{
    id: string;
    status: string;
    periodStatus: string;
    publishedAt: Date | null;
  } | null> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        status: true,
        periodStatus: true,
        publishedAt: true,
      },
    });

    return report;
  }

  async publishPeriod(reportId: string, userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.report.update({
        where: { id: reportId },
        data: {
          status: 'published',
          periodStatus: 'published',
          // UFB-053 / Phase 51-C: write the new state column atomically
          // with the legacy fields. `periodState` and `periodStatus` are
          // separate state machines — both move together on a head-driven
          // publish (open → published on both).
          periodState: 'published',
          publishedAt: new Date(),
          publishedById: userId,
        },
      });
    });
  }

  /**
   * Phase 54 (UFB-055): all section ids for a report. Used by the
   * ingestion seam to enqueue one stub `AiIngestionJob` row per
   * section after `publishPeriod` resolves. Returns an empty array
   * when the report has no sections (legal — period was published
   * without anyone filling in their section).
   */
  async listSectionIds(reportId: string): Promise<string[]> {
    const sections = await this.prisma.reportSection.findMany({
      where: { reportId },
      select: { id: true },
    });
    return sections.map((s) => s.id);
  }

  async reopenPeriod(reportId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.report.update({
        where: { id: reportId },
        data: {
          periodStatus: 'reopened',
          // UFB-053 / Phase 51-C: on reopen, revert `periodState` to
          // 'open' (the closest of the four states to "editable again").
          // `periodStatus` stays distinct with the 'reopened' marker so
          // consumers that care about reopen-flavour can still discriminate.
          // See "Open Questions" in the 51-C SUMMARY for the asymmetry
          // rationale.
          periodState: 'open',
          reopenedAt: new Date(),
        },
      });

      await tx.reportSection.updateMany({
        where: {
          reportId,
          status: 'submitted',
        },
        data: {
          status: 'draft',
          submittedAt: null,
        },
      });
    });
  }
}
