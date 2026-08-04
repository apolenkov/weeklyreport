import {
  type SubmissionDashboardRow,
  submissionDashboardRowSchema,
} from "@customreport/shared";
import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { groupScopeFilter } from "../../../lib/group-scope.js";
import type {
  DashboardScopeSession,
  ReviewRepository,
} from "../application/review.service.js";

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

    return sections.map(toDashboardRow);
  };
}

type SectionWithAuthor = Awaited<
  ReturnType<PrismaService["reportSection"]["findMany"]>
>[number] & {
  readonly author: {
    readonly id: string;
    readonly name: string;
    readonly role: string;
    readonly ledProjects: readonly { readonly name: string }[];
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
