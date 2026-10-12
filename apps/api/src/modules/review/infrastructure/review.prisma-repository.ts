import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  type SubmissionDashboardRow,
  submissionDashboardRowSchema,
} from "@weeklyreport/shared";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { groupScopeFilter } from "../../../lib/group-scope.js";
import type {
  DashboardScopeSession,
  ReviewRepository,
} from "../application/review.service.js";

const submissionDashboardInclude = {
  author: {
    include: {
      ledProjects: {
        where: { archived: false },
        select: { name: true },
      },
    },
  },
} as const satisfies Prisma.ReportSectionInclude;

@Injectable()
export class ReviewPrismaRepository implements ReviewRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  readonly getSubmissionDashboard = async (
    activeReportId: string,
    session: DashboardScopeSession,
  ): Promise<SubmissionDashboardRow[]> => {
    const scope = groupScopeFilter(session, "reportSection");
    const sections = await this.prisma.reportSection.findMany({
      where: { reportId: activeReportId, ...scope },
      include: submissionDashboardInclude,
    });

    return sections.map(toDashboardRow);
  };
}

type SectionWithAuthor = Prisma.ReportSectionGetPayload<{
  include: typeof submissionDashboardInclude;
}>;

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
