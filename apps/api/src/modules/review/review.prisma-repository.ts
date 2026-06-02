import {
  type SubmissionDashboardRow,
  submissionDashboardRowSchema,
} from "@customreport/shared";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { groupScopeFilter } from "../../lib/group-scope.js";
import type {
  DashboardScopeSession,
  ReviewRepository,
} from "./review.service.js";

@Injectable()
export class ReviewPrismaRepository implements ReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getSubmissionDashboard(
    activeReportId: string,
    session: DashboardScopeSession,
  ): Promise<SubmissionDashboardRow[]> {
    const scope = groupScopeFilter(
      session as Parameters<typeof groupScopeFilter>[0],
      "reportSection",
    );
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

    return sections.map((section) => toDashboardRow(section));
  }
}

type SectionWithAuthor = Awaited<
  ReturnType<PrismaService["reportSection"]["findMany"]>
>[number] & {
  author: {
    id: string;
    name: string;
    role: string;
    ledProjects: { name: string }[];
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
