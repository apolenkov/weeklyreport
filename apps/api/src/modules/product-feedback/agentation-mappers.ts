import type { Prisma as PrismaTypes } from "@prisma/client";

export type AnnotationWithThread = PrismaTypes.AgentationAnnotationGetPayload<{
  include: { threadMessages: { orderBy: { timestamp: "asc" } } };
}>;
export type SessionWithAnnotations = PrismaTypes.AgentationSessionGetPayload<{
  include: {
    annotations: {
      include: { threadMessages: { orderBy: { timestamp: "asc" } } };
    };
  };
}>;

function present<const Key extends string, Value>(
  key: Key,
  value: Value | null,
): Partial<Record<Key, Value>> {
  return value === null ? {} : ({ [key]: value } as Record<Key, Value>);
}

export function mapAnnotation(row: AnnotationWithThread) {
  return {
    id: row.id,
    clientId: row.clientId,
    sessionId: row.sessionId,
    x: row.x,
    y: row.y,
    comment: row.comment,
    element: row.element,
    elementPath: row.elementPath,
    timestamp: Number(row.timestamp),
    ...present("selectedText", row.selectedText),
    ...present("boundingBox", row.boundingBox),
    ...present("nearbyText", row.nearbyText),
    ...present("cssClasses", row.cssClasses),
    ...present("nearbyElements", row.nearbyElements),
    ...present("computedStyles", row.computedStyles),
    ...present("fullPath", row.fullPath),
    ...present("accessibility", row.accessibility),
    isMultiSelect: row.isMultiSelect,
    isFixed: row.isFixed,
    ...present("reactComponents", row.reactComponents),
    ...present("sourceFile", row.sourceFile),
    ...present("drawingIndex", row.drawingIndex),
    ...present("elementBoundingBoxes", row.elementBoundingBoxes),
    ...present("placement", row.placement),
    ...present("rearrange", row.rearrange),
    ...present("url", row.url),
    kind: row.kind,
    ...present("intent", row.intent),
    ...present("severity", row.severity),
    status: row.status,
    thread: row.threadMessages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      timestamp: Number(message.timestamp),
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...present("resolvedAt", row.resolvedAt?.toISOString() ?? null),
    ...present("resolvedBy", row.resolvedBy),
    authorId: row.authorUserId,
  };
}

export function mapSession(
  row: SessionWithAnnotations | PrismaTypes.AgentationSessionGetPayload<object>,
) {
  return {
    id: row.id,
    url: row.url,
    status: row.status,
    projectId: row.projectId,
    ...(row.metadata === null ? {} : { metadata: row.metadata }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...("annotations" in row
      ? { annotations: row.annotations.map(mapAnnotation) }
      : {}),
  };
}

export function mapEvent(row: {
  sequence: bigint;
  type: string;
  sessionId: string | null;
  payload: unknown;
  createdAt: Date;
}) {
  return {
    sequence: row.sequence,
    type: row.type,
    ...(row.sessionId ? { sessionId: row.sessionId } : {}),
    payload: row.payload,
    timestamp: row.createdAt.toISOString(),
  };
}
