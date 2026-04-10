import { Injectable } from '@nestjs/common';
import {
  submissionDashboardRowSchema,
  type SubmissionDashboardRow,
} from '@customreport/shared';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { ReviewRepository } from './review.service.js';

@Injectable()
export class ReviewPrismaRepository implements ReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getSubmissionDashboard(activeReportId: string): Promise<SubmissionDashboardRow[]> {
    const sections = await this.prisma.reportSection.findMany({
      where: { reportId: activeReportId },
      include: {
        author: {
          include: {
            ledProjects: {
              where: { archived: false },
              select: { name: true },
            },
          },
        },
      },
    });

    return sections.map((section) => toDashboardRow(section));
  }
}

type SectionWithAuthor = Awaited<
  ReturnType<PrismaService['reportSection']['findMany']>
>[number] & {
  author: {
    id: string;
    name: string;
    role: string;
    ledProjects: Array<{ name: string }>;
  };
};

function toDashboardRow(section: SectionWithAuthor): SubmissionDashboardRow {
  return submissionDashboardRowSchema.parse({
    leadId: section.authorId,
    leadName: section.author.name,
    role: section.author.role,
    projectNames: section.author.ledProjects.map((p) => p.name),
    status: section.status,
    submittedAt: section.submittedAt,
  });
}
