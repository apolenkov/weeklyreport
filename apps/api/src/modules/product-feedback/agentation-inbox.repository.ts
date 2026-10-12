import type { Prisma } from "@prisma/client";
import { normalizeFeedbackPath } from "@weeklyreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { projectAgentation } from "./agentation-inbox-projection.js";
import { annotationScope } from "./agentation-scope.js";
import {
  type FeedbackAccess,
  type FeedbackPage,
  type FeedbackQuery,
} from "./product-feedback.repository.js";
export { annotationIdFromInboxId } from "./agentation-inbox-projection.js";
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

function whereFor(
  access: FeedbackAccess,
  query: FeedbackQuery,
): Prisma.AgentationAnnotationWhereInput {
  return {
    AND: [
      annotationScope(access),
      ...(query.url ? [{ url: normalizeFeedbackPath(query.url) }] : []),
      ...(query.search
        ? [
            {
              comment: {
                contains: query.search.trim(),
                mode: "insensitive" as const,
              },
            },
          ]
        : []),
    ],
  };
}

export class AgentationInboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    access: FeedbackAccess,
    query: FeedbackQuery = {},
  ): Promise<FeedbackPage> {
    const where = whereFor(access, query);
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, query.limit ?? DEFAULT_PAGE_SIZE),
    );
    const page = Math.max(1, query.page ?? 1);
    const [rows, total] = await Promise.all([
      this.prisma.agentationAnnotation.findMany({
        where,
        include: {
          session: true,
          threadMessages: { orderBy: { timestamp: "asc" } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.agentationAnnotation.count({ where }),
    ]);
    return {
      feedbacks: rows.map((row) => projectAgentation(row, access)),
      total,
    };
  }
}
