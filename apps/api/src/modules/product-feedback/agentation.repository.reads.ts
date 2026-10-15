import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { THREAD_MESSAGES_INCLUDE } from "./agentation.repository.helpers.js";
import { mapAnnotation, mapEvent, mapSession } from "./agentation-mappers.js";
import { annotationScope, sessionScope } from "./agentation-scope.js";
import type { FeedbackAccess } from "./product-feedback.repository.js";

export class AgentationReadRepository {
  constructor(protected readonly prisma: PrismaService) {}

  async deletionEvents(
    access: FeedbackAccess,
    sessionId: string,
    query: {
      readonly after: bigint;
      readonly through: bigint;
      readonly limit: number;
    },
  ): Promise<ReturnType<typeof mapEvent>[]> {
    const { after, through, limit } = query;
    const rows = await this.prisma.agentationEvent.findMany({
      where: {
        sessionId,
        session: sessionScope(access),
        sequence: { gt: after, lte: through },
        type: "annotation.updated",
        payload: { path: ["deleted"], equals: true },
      },
      orderBy: { sequence: "asc" },
      take: limit,
    });
    return rows.map(mapEvent);
  }

  async listSessions(
    access: FeedbackAccess,
  ): Promise<ReturnType<typeof mapSession>[]> {
    const rows = await this.prisma.agentationSession.findMany({
      where: sessionScope(access),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map(mapSession);
  }

  async getSession(
    access: FeedbackAccess,
    id: string,
  ): Promise<ReturnType<typeof mapSession> | null> {
    const row = await this.prisma.agentationSession.findFirst({
      where: { id, ...sessionScope(access) },
      include: {
        annotations: {
          // Ingress admits equal client timestamps; the server ID fixes their order.
          orderBy: [{ timestamp: "asc" }, { id: "asc" }],
          include: THREAD_MESSAGES_INCLUDE,
        },
      },
    });
    return row ? mapSession(row) : null;
  }

  async getAnnotation(
    access: FeedbackAccess,
    id: string,
  ): Promise<ReturnType<typeof mapAnnotation> | null> {
    const row = await this.prisma.agentationAnnotation.findFirst({
      where: { id, ...annotationScope(access) },
      include: THREAD_MESSAGES_INCLUDE,
    });
    return row ? mapAnnotation(row) : null;
  }

  async pending(
    access: FeedbackAccess,
    sessionId?: string,
  ): Promise<ReturnType<typeof mapAnnotation>[]> {
    const rows = await this.prisma.agentationAnnotation.findMany({
      where: {
        status: "pending",
        ...(sessionId ? { sessionId } : {}),
        ...annotationScope(access),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: THREAD_MESSAGES_INCLUDE,
    });
    return rows.map(mapAnnotation);
  }
}
