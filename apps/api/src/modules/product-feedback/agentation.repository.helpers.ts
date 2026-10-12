import { randomUUID } from "node:crypto";

import { Prisma, type Prisma as PrismaTypes } from "@prisma/client";
import {
  AGENTATION_MAX_ARRAY_LENGTH,
  type AgentationAnnotationCreate,
  type AgentationAnnotationPatch,
  type AgentationAnnotationResponse,
  agentationAnnotationResponseSchema,
  type AgentationStatus,
} from "@weeklyreport/shared";

import type { AgentationRole } from "./agentation.repository.js";
import { annotationScope } from "./agentation-scope.js";
import {
  type FeedbackAccess,
  FeedbackLimitError,
} from "./product-feedback.repository.js";

type Db = Prisma.TransactionClient;

// One ordering contract for every persisted annotation/thread projection.
export const THREAD_MESSAGES_INCLUDE = {
  threadMessages: { orderBy: [{ timestamp: "asc" }, { id: "asc" }] },
} satisfies PrismaTypes.AgentationAnnotationInclude;

export async function findDeletionForSync(
  db: Db,
  access: FeedbackAccess,
  sessionId: string,
  id: string,
) {
  return db.agentationEvent.findFirst({
    where: {
      sessionId,
      type: "annotation.updated",
      AND: [
        {
          OR: [
            { annotationId: id },
            { payload: { path: ["clientId"], equals: id } },
          ],
        },
        { payload: { path: ["authorId"], equals: access.userId } },
        { payload: { path: ["deleted"], equals: true } },
      ],
    },
    select: { annotationId: true, createdAt: true },
    orderBy: { sequence: "desc" },
  });
}

export async function findAnnotationForSync(
  db: Db,
  access: FeedbackAccess,
  sessionId: string,
  id: string,
) {
  return db.agentationAnnotation.findFirst({
    where: {
      sessionId,
      authorUserId: access.userId,
      OR: [{ id }, { clientId: id }],
    },
    include: THREAD_MESSAGES_INCLUDE,
  });
}

export async function lockAgentationSession(
  db: Db,
  sessionId: string,
): Promise<boolean> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "AgentationSession" WHERE "id" = ${sessionId} FOR NO KEY UPDATE
  `;
  return rows.length > 0;
}

export function deletedAnnotationResponse(
  access: FeedbackAccess,
  session: { readonly id: string; readonly url: string },
  input: AgentationAnnotationCreate,
  tombstone: { readonly annotationId: string | null; readonly createdAt: Date },
): AgentationAnnotationResponse {
  const deletedAt = tombstone.createdAt.toISOString();
  return agentationAnnotationResponseSchema.parse({
    ...input,
    id: tombstone.annotationId ?? input.id,
    clientId: input.id,
    sessionId: session.id,
    url: session.url,
    kind: input.kind ?? "feedback",
    status: "dismissed",
    thread: [],
    createdAt: deletedAt,
    updatedAt: deletedAt,
    resolvedAt: deletedAt,
    resolvedBy: "human",
    authorId: access.userId,
  });
}

/**
 * Rejects a thread write once the thread holds AGENTATION_MAX_ARRAY_LENGTH
 * messages minus the `reserved` slots kept for later writes. Callers hold the
 * annotation or session lock, so concurrent writers cannot both pass.
 */
export async function assertThreadHasRoom(
  db: Db,
  annotationId: string,
  reserved: number,
): Promise<void> {
  const messages = await db.agentationThreadMessage.count({
    where: { annotationId },
  });
  if (messages >= AGENTATION_MAX_ARRAY_LENGTH - reserved)
    throw new FeedbackLimitError("Thread message limit reached");
}

export async function lockVisibleAnnotation(
  db: Db,
  access: FeedbackAccess,
  id: string,
): Promise<{
  id: string;
  sessionId: string;
  clientId: string;
  kind: string;
  authorUserId: string;
} | null> {
  const current = await db.agentationAnnotation.findFirst({
    where: { id, ...annotationScope(access) },
    select: {
      id: true,
      sessionId: true,
      clientId: true,
      kind: true,
      authorUserId: true,
    },
  });
  if (!current) return null;

  // Serialize replay/deletion even when no annotation row exists. NO KEY UPDATE
  // remains compatible with FK checks made by concurrent status/edit writers.
  if (!(await lockAgentationSession(db, current.sessionId))) return null;

  // Serialize thread writes with hard deletion so event cleanup observes every
  // committed reply without widening the caller's authorization scope.
  const locked = await db.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "AgentationAnnotation"
    WHERE "id" = ${id}
    FOR UPDATE
  `;
  if (locked.length === 0) return null;
  return db.agentationAnnotation.findFirst({
    where: { id, ...annotationScope(access) },
    select: {
      id: true,
      sessionId: true,
      clientId: true,
      kind: true,
      authorUserId: true,
    },
  });
}

const json = (
  value: unknown,
): PrismaTypes.InputJsonValue | typeof Prisma.JsonNull =>
  value === undefined
    ? Prisma.JsonNull
    : (JSON.parse(JSON.stringify(value)) as PrismaTypes.InputJsonValue);

export const actorId = (
  access: FeedbackAccess,
  role: AgentationRole,
): string | undefined => (role === "human" ? access.userId : undefined);

const terminal = (status: AgentationStatus): boolean =>
  status === "resolved" || status === "dismissed";

interface AnnotationState {
  readonly comment: string;
  readonly intent: string | null;
  readonly severity: string | null;
  readonly kind: string;
  readonly status: string;
}

export function updateData(
  patch: AgentationAnnotationPatch,
  role: AgentationRole,
  current: AnnotationState,
): PrismaTypes.AgentationAnnotationUpdateInput {
  const result: PrismaTypes.AgentationAnnotationUpdateInput = {};
  const fields = [
    ["comment", patch.comment, current.comment],
    ["intent", patch.intent, current.intent],
    ["severity", patch.severity, current.severity],
    ["kind", patch.kind, current.kind],
  ] as const;
  for (const [field, value, previous] of fields) {
    if (value !== undefined && value !== previous) result[field] = value;
  }
  if (patch.status !== undefined && patch.status !== current.status) {
    result.status = patch.status;
    result.resolvedAt = terminal(patch.status) ? new Date() : null;
    result.resolvedBy = terminal(patch.status) ? role : null;
  }
  return result;
}

export async function emit(
  db: Db,
  event: {
    type: string;
    sessionId?: string;
    annotationId?: string;
    payload: unknown;
    authorUserId?: string | undefined;
  },
): Promise<void> {
  await db.agentationEvent.create({
    data: {
      id: randomUUID(),
      type: event.type,
      payload: json(event.payload),
      ...(event.sessionId ? { sessionId: event.sessionId } : {}),
      ...(event.annotationId ? { annotationId: event.annotationId } : {}),
      ...(event.authorUserId ? { authorUserId: event.authorUserId } : {}),
    },
  });
}

export function annotationData(
  id: string,
  access: FeedbackAccess,
  session: { readonly id: string; readonly url: string },
  input: AgentationAnnotationCreate,
): PrismaTypes.AgentationAnnotationUncheckedCreateInput {
  return {
    id,
    clientId: input.id,
    sessionId: session.id,
    x: input.x,
    y: input.y,
    comment: input.comment,
    element: input.element,
    elementPath: input.elementPath,
    timestamp: BigInt(input.timestamp),
    selectedText: input.selectedText ?? null,
    boundingBox: json(input.boundingBox),
    nearbyText: input.nearbyText ?? null,
    cssClasses: input.cssClasses ?? null,
    nearbyElements: input.nearbyElements ?? null,
    computedStyles: input.computedStyles ?? null,
    fullPath: input.fullPath ?? null,
    accessibility: input.accessibility ?? null,
    isMultiSelect: input.isMultiSelect ?? false,
    isFixed: input.isFixed ?? false,
    reactComponents: input.reactComponents ?? null,
    sourceFile: input.sourceFile ?? null,
    drawingIndex: input.drawingIndex ?? null,
    elementBoundingBoxes: json(input.elementBoundingBoxes),
    placement: json(input.placement),
    rearrange: json(input.rearrange),
    url: session.url,
    kind: input.kind ?? "feedback",
    intent: input.intent ?? null,
    severity: input.severity ?? null,
    authorUserId: access.userId,
    authorReportingGroupId: access.reportingGroupId ?? null,
    authorRole: access.role,
    authorName: access.name,
    authorEmail: access.email,
  };
}
