import {
  feedbackDiagnosticsSchema,
  feedbackScreenshotRegionSchema,
  normalizeFeedbackPath,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import {
  type FeedbackAccess,
  type FeedbackCreateInput,
  type FeedbackQuery,
  type FeedbackRecord,
  WEEKLY_REPORT_FEEDBACK_PRODUCT,
} from "./product-feedback.repository.js";

export type FeedbackRow = Prisma.ProductFeedbackGetPayload<{
  include: { annotations: true };
}>;

export function mapFeedback(row: FeedbackRow): FeedbackRecord {
  return {
    id: row.id,
    projectName: WEEKLY_REPORT_FEEDBACK_PRODUCT,
    type: row.type as FeedbackRecord["type"],
    message: row.message,
    status: row.status as FeedbackRecord["status"],
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

export function createFeedbackData(
  access: FeedbackAccess,
  input: FeedbackCreateInput,
) {
  return {
    projectName: WEEKLY_REPORT_FEEDBACK_PRODUCT,
    type: input.type,
    message: input.message,
    status: "open",
    url: normalizeFeedbackPath(input.url),
    urlPattern: input.urlPattern
      ? normalizeFeedbackPath(input.urlPattern)
      : null,
    screenshotUrl: input.screenshotDataUrl ?? null,
    ...(input.screenshotRegion
      ? { screenshotRegion: { ...input.screenshotRegion } }
      : {}),
    ...(input.diagnostics
      ? {
          diagnostics: {
            console: input.diagnostics.console.map((entry) => ({ ...entry })),
            network: input.diagnostics.network.map((entry) => ({ ...entry })),
          },
        }
      : {}),
    viewport: input.viewport,
    userAgent: input.userAgent,
    authorUserId: access.userId,
    authorName: access.name,
    authorEmail: access.email,
    authorReportingGroupId: access.reportingGroupId ?? null,
    clientId: input.clientId,
    annotations: {
      create: input.annotations.map((annotation) => ({
        ...annotation,
        elementId: annotation.elementId ?? null,
        anchorKey: annotation.anchorKey ?? null,
      })),
    },
  };
}
