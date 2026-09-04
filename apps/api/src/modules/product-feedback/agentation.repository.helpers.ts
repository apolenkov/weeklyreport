import { randomUUID } from "node:crypto";

import {
  type AgentationAnnotationCreate,
  type AgentationAnnotationPatch,
  type AgentationStatus,
} from "@customreport/shared";
import { Prisma, type Prisma as PrismaTypes } from "@prisma/client";

import type { AgentationRole } from "./agentation.repository.js";
import type { FeedbackAccess } from "./product-feedback.repository.js";

type Db = Prisma.TransactionClient;

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
  session: { url: string },
  sessionId: string,
  input: AgentationAnnotationCreate,
): PrismaTypes.AgentationAnnotationUncheckedCreateInput {
  return {
    id,
    clientId: input.id,
    sessionId,
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
