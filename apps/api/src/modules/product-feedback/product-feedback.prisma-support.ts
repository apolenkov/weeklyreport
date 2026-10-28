import type { Prisma } from "@prisma/client";
import {
  feedbackDiagnosticsSchema,
  feedbackScreenshotRegionSchema,
  feedbackStatusSchema,
  feedbackTypeSchema,
  normalizeFeedbackPath,
} from "@weeklyreport/shared";

import {
  type FeedbackAccess,
  FeedbackInvalidStatusError,
  type FeedbackQuery,
  type FeedbackRecord,
  WEEKLY_REPORT_FEEDBACK_PRODUCT,
} from "./product-feedback.repository.js";

export type FeedbackRow = Prisma.ProductFeedbackGetPayload<{
  include: { annotations: true };
}>;

// `type` and `status` are plain String columns; a legacy or manually edited row
// may hold a value outside the shared enums, so it is rejected, not cast.
function storedType(row: FeedbackRow): FeedbackRecord["type"] {
  const parsed = feedbackTypeSchema.safeParse(row.type);
  if (!parsed.success) {
    throw new FeedbackInvalidStatusError(
      `Stored feedback ${row.id} has an unknown type.`,
    );
  }
  return parsed.data;
}

function storedStatus(row: FeedbackRow): FeedbackRecord["status"] {
  const parsed = feedbackStatusSchema.safeParse(row.status);
  if (!parsed.success) {
    throw new FeedbackInvalidStatusError(
      `Stored feedback ${row.id} has an unknown status.`,
    );
  }
  return parsed.data;
}

export function mapFeedback(row: FeedbackRow): FeedbackRecord {
  return {
    id: row.id,
    projectName: WEEKLY_REPORT_FEEDBACK_PRODUCT,
    type: storedType(row),
    message: row.message,
    status: storedStatus(row),
    url: row.url,
    urlPattern: row.urlPattern,
    authorName: row.authorName,
    authorEmail: row.authorEmail,
    authorUserId: row.authorUserId,
    authorReportingGroupId: row.authorReportingGroupId,
    viewport: row.viewport,
    userAgent: row.userAgent,
    clientId: row.clientId,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    annotations: row.annotations.map(
      ({ elementId, anchorKey, ...annotation }) => ({
        ...annotation,
        ...(elementId ? { elementId } : {}),
        ...(anchorKey ? { anchorKey } : {}),
      }),
    ),
    screenshotUrl: row.screenshotUrl,
    screenshotRegion:
      row.screenshotRegion === null
        ? null
        : feedbackScreenshotRegionSchema.parse(row.screenshotRegion),
    diagnostics:
      row.diagnostics === null
        ? null
        : feedbackDiagnosticsSchema.parse(row.diagnostics),
    source: "legacy",
    capabilities: {
      editOriginal: false,
      triage: false,
      reply: false,
      dismiss: false,
      delete: false,
    },
    thread: [],
    agentationContext: null,
  };
}

export function accessWhere(
  access: FeedbackAccess,
): Prisma.ProductFeedbackWhereInput {
  if (access.role === "admin") return {};
  if (access.role === "head" && access.reportingGroupId !== undefined) {
    return {
      OR: [
        { authorUserId: access.userId },
        { authorReportingGroupId: access.reportingGroupId },
      ],
    };
  }
  return { authorUserId: access.userId };
}

export function queryWhere(
  access: FeedbackAccess,
  query: FeedbackQuery,
): Prisma.ProductFeedbackWhereInput {
  const statuses = query.statuses?.length
    ? { in: [...query.statuses] }
    : query.status;
  const search = query.search?.trim();
  return {
    projectName: WEEKLY_REPORT_FEEDBACK_PRODUCT,
    AND: [
      accessWhere(access),
      ...(query.type ? [{ type: query.type }] : []),
      ...(statuses ? [{ status: statuses }] : []),
      ...(query.url ? [{ url: normalizeFeedbackPath(query.url) }] : []),
      ...(query.urlPattern
        ? [{ urlPattern: normalizeFeedbackPath(query.urlPattern) }]
        : []),
      ...(search
        ? [
            {
              OR: [
                { message: { contains: search, mode: "insensitive" as const } },
                {
                  authorName: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
                {
                  authorEmail: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
              ],
            },
          ]
        : []),
    ],
  };
}
