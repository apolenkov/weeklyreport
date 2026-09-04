import { randomUUID } from "node:crypto";

import {
  type FeedbackStatus,
  normalizeFeedbackPath,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  type AnnotationWithThread,
  mapAnnotation,
} from "./agentation-mappers.js";
import { annotationScope } from "./agentation-scope.js";
import {
  type FeedbackAccess,
  FeedbackNotFoundError,
  type FeedbackPage,
  type FeedbackQuery,
  type FeedbackRecord,
  type FeedbackRecordAnnotation,
  WEEKLY_REPORT_FEEDBACK_PRODUCT,
} from "./product-feedback.repository.js";

export const AGENTATION_INBOX_ID_PREFIX = "agentation_";
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;
const PERCENT_SCALE = 100;

export type AgentationInboxRow = AnnotationWithThread & {
  session: Prisma.AgentationSessionGetPayload<object>;
};

export function agentationInboxId(id: string): string {
  return `${AGENTATION_INBOX_ID_PREFIX}${id}`;
}

export function annotationIdFromInboxId(id: string): string | null {
  return id.startsWith(AGENTATION_INBOX_ID_PREFIX)
    ? id.slice(AGENTATION_INBOX_ID_PREFIX.length)
    : null;
}

function status(value: string): FeedbackStatus {
  return value === "acknowledged"
    ? "in_progress"
    : value === "resolved"
      ? "resolved"
      : value === "dismissed"
        ? "wont_fix"
        : "open";
}

function inverseStatus(value: FeedbackStatus): string {
  return value === "in_progress"
    ? "acknowledged"
    : value === "resolved"
      ? "resolved"
      : value === "wont_fix"
        ? "dismissed"
        : "pending";
}

function type(row: AgentationInboxRow): FeedbackRecord["type"] {
  if (row.intent === "question") return "question";
  if (
    row.intent === "fix" ||
    row.intent === "change" ||
    row.kind !== "feedback"
  )
    return "change";
  return "other";
}

function viewport(row: AgentationInboxRow): { width: number; height: number } {
  const box = row.boundingBox;
  if (box && typeof box === "object" && !Array.isArray(box)) {
    const value = box as Record<string, unknown>;
    const width =
      typeof value.viewportWidth === "number" && value.viewportWidth > 0
        ? value.viewportWidth
        : 1;
    const height =
      typeof value.viewportHeight === "number" && value.viewportHeight > 0
        ? value.viewportHeight
        : 1;
    return { width, height };
  }
  return { width: 1, height: 1 };
}

function annotation(
  row: AgentationInboxRow,
  width: number,
  height: number,
): FeedbackRecordAnnotation {
  return {
    id: agentationInboxId(row.id),
    feedbackId: agentationInboxId(row.id),
    cssSelector: row.elementPath,
    xpath: row.elementPath,
    textSnippet: row.selectedText ?? row.nearbyText ?? "",
    elementTag: "element",
    textPrefix: "",
    textSuffix: "",
    fingerprint: row.elementPath,
    neighborText: row.nearbyText ?? "",
    anchorKey: row.id,
    xPct: Math.max(0, Math.min(1, row.x / PERCENT_SCALE)),
    yPct: Math.max(0, Math.min(1, row.y / height)),
    wPct: 0,
    hPct: 0,
    scrollX: 0,
    scrollY: 0,
    viewportW: width,
    viewportH: height,
    devicePixelRatio: 1,
    createdAt: row.createdAt,
  };
}

export function projectAgentation(row: AgentationInboxRow): FeedbackRecord {
  const dimensions = viewport(row);
  return {
    id: agentationInboxId(row.id),
    projectName: WEEKLY_REPORT_FEEDBACK_PRODUCT,
    type: type(row),
    message: row.comment,
    status: status(row.status),
    url: normalizeFeedbackPath(row.url ?? row.session.url),
    urlPattern: null,
    viewport: `${dimensions.width}x${dimensions.height}`,
    userAgent: "Agentation",
    clientId: `agentation:${row.id}`,
    annotations: [annotation(row, dimensions.width, dimensions.height)],
    authorUserId: row.authorUserId,
    authorReportingGroupId: row.authorReportingGroupId,
    authorName: row.authorName,
    authorEmail: row.authorEmail,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    screenshotUrl: null,
    screenshotDataUrl: null,
    screenshotRegion: null,
    diagnostics: null,
    agentationSessionId: row.sessionId,
    agentationAnnotationId: row.id,
  };
}

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
    return { feedbacks: rows.map(projectAgentation), total };
  }

  async updateInboxStatus(
    access: FeedbackAccess,
    inboxId: string,
    nextStatus: FeedbackStatus,
  ): Promise<FeedbackRecord> {
    const id = annotationIdFromInboxId(inboxId);
    if (!id) throw new FeedbackNotFoundError();
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.agentationAnnotation.findFirst({
        where: { id, ...annotationScope(access) },
        include: {
          session: true,
          threadMessages: { orderBy: { timestamp: "asc" } },
        },
      });
      if (!current) throw new FeedbackNotFoundError();
      const databaseStatus = inverseStatus(nextStatus);
      if (current.status === databaseStatus) return projectAgentation(current);
      const terminal = nextStatus === "resolved" || nextStatus === "wont_fix";
      const changed = await tx.agentationAnnotation.update({
        where: { id },
        data: {
          status: databaseStatus,
          resolvedAt: terminal ? new Date() : null,
          resolvedBy: terminal ? "human" : null,
        },
        include: {
          session: true,
          threadMessages: { orderBy: { timestamp: "asc" } },
        },
      });
      await tx.agentationEvent.create({
        data: {
          id: randomUUID(),
          type: "annotation.updated",
          sessionId: changed.sessionId,
          annotationId: changed.id,
          authorUserId: access.userId,
          payload: mapAnnotation(changed),
        },
      });
      return projectAgentation(changed);
    });
  }
}
