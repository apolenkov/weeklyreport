import type { Prisma } from "@prisma/client";
import {
  type FeedbackStatus,
  normalizeFeedbackPath,
} from "@weeklyreport/shared";

import type { AnnotationWithThread } from "./agentation-mappers.js";
import {
  type FeedbackAccess,
  type FeedbackRecord,
  type FeedbackRecordAnnotation,
} from "./product-feedback.repository.js";

const AGENTATION_INBOX_ID_PREFIX = "agentation_";
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
    return {
      width:
        typeof value.viewportWidth === "number" && value.viewportWidth > 0
          ? value.viewportWidth
          : 1,
      height:
        typeof value.viewportHeight === "number" && value.viewportHeight > 0
          ? value.viewportHeight
          : 1,
    };
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

export function projectAgentation(
  row: AgentationInboxRow,
  access?: FeedbackAccess,
): FeedbackRecord {
  const dimensions = viewport(row);
  return {
    id: agentationInboxId(row.id),
    projectName: "weekly-report",
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
    source: "agentation",
    capabilities: {
      editOriginal: access?.userId === row.authorUserId,
      triage: access?.role === "admin" || access?.role === "head",
      reply: access !== undefined,
      dismiss: access?.role === "admin" || access?.role === "head",
      delete: access?.role === "admin",
    },
    thread: row.threadMessages.map((message) => ({
      id: message.id,
      role: message.role as "human" | "agent",
      content: message.content,
      timestamp: new Date(Number(message.timestamp)).toISOString(),
      authorUserId: message.authorUserId,
    })),
    agentationContext: {
      element: row.element,
      elementPath: row.elementPath,
      selectedText: row.selectedText ?? null,
      nearbyText: row.nearbyText ?? null,
      sourceFile: row.sourceFile ?? null,
      reactComponents: row.reactComponents ?? null,
      accessibility: row.accessibility ?? null,
    },
  };
}
