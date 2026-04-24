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
          publishedAt: new Date(),
          publishedById: userId,
        },
      });
    });
  }

  async reopenPeriod(reportId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.report.update({
        where: { id: reportId },
        data: {
          periodStatus: 'reopened',
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
