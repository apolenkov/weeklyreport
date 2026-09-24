import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  accessWhere,
  mapFeedback,
  queryWhere,
} from "./product-feedback.prisma-support.js";
import {
  type FeedbackAccess,
  FeedbackNotFoundError,
  type FeedbackPage,
  type FeedbackQuery,
  type FeedbackRecord,
  type FeedbackUpdateInput,
  type ProductFeedbackRepository,
  WEEKLY_REPORT_FEEDBACK_PRODUCT,
} from "./product-feedback.repository.js";
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

export class ProductFeedbackPrismaRepository implements ProductFeedbackRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    access: FeedbackAccess,
    query: FeedbackQuery,
    focusId?: string,
  ): Promise<FeedbackPage> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, query.limit ?? DEFAULT_PAGE_SIZE),
    );
    const where = queryWhere(access, query);
    const [result, focused] = await Promise.all([
      this.prisma.$transaction([
        this.prisma.productFeedback.findMany({
          where,
          include: { annotations: true },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.productFeedback.count({ where }),
      ]),
      page === 1 && focusId
        ? this.prisma.productFeedback.findFirst({
            where: { AND: [where, { id: focusId }] },
            include: { annotations: true },
          })
        : Promise.resolve(null),
    ]);
    const [rows, total] = result;
    const visibleRows =
      focused && !rows.some((row) => row.id === focused.id)
        ? [focused, ...rows.slice(0, Math.max(0, limit - 1))]
        : rows;
    return { feedbacks: visibleRows.map(mapFeedback), total };
  }

  async update(
    access: FeedbackAccess,
    id: string,
    input: FeedbackUpdateInput,
  ): Promise<FeedbackRecord> {
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.productFeedback.updateMany({
        where: {
          id,
          projectName: WEEKLY_REPORT_FEEDBACK_PRODUCT,
          ...accessWhere(access),
        },
        data: {
          ...(input.status ? { status: input.status } : {}),
          ...(input.message ? { message: input.message } : {}),
          ...(input.screenshotDataUrl
            ? { screenshotUrl: input.screenshotDataUrl }
            : {}),
          ...(input.resolvedAt !== undefined
            ? { resolvedAt: input.resolvedAt }
            : {}),
        },
      });
      if (changed.count !== 1) throw new FeedbackNotFoundError();
      const row = await tx.productFeedback.findUniqueOrThrow({
        where: { id },
        include: { annotations: true },
      });
      return mapFeedback(row);
    });
  }

  async delete(access: FeedbackAccess, id: string): Promise<void> {
    if (access.role !== "admin") throw new FeedbackNotFoundError();
    const deleted = await this.prisma.productFeedback.deleteMany({
      where: {
        id,
        projectName: WEEKLY_REPORT_FEEDBACK_PRODUCT,
      },
    });
    if (deleted.count !== 1) throw new FeedbackNotFoundError();
  }

  async ownsAuthor(access: FeedbackAccess, id: string): Promise<boolean> {
    const count = await this.prisma.productFeedback.count({
      where: {
        id,
        projectName: WEEKLY_REPORT_FEEDBACK_PRODUCT,
        authorUserId: access.userId,
      },
    });
    return count === 1;
  }
}
