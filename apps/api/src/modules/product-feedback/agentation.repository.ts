import { randomUUID } from "node:crypto";

import {
  type AgentationAction,
  type AgentationAnnotationCreate,
  type AgentationAnnotationPatch,
  type AgentationSessionCreate,
  type AgentationThread,
  normalizeAgentationPath,
} from "@customreport/shared";
import { Prisma } from "@prisma/client";

import {
  actorId,
  annotationData,
  emit,
  lockVisibleAnnotation,
  updateData,
} from "./agentation.repository.helpers.js";
import { AgentationReadRepository } from "./agentation.repository.reads.js";
import { mapAnnotation, mapEvent, mapSession } from "./agentation-mappers.js";
import { annotationScope, sessionScope } from "./agentation-scope.js";
import {
  type FeedbackAccess,
  WEEKLY_REPORT_FEEDBACK_PRODUCT,
} from "./product-feedback.repository.js";

export type AgentationRole = "human" | "agent";

const THREAD_WITH_SESSION_INCLUDE = {
  session: true,
  threadMessages: { orderBy: { timestamp: "asc" as const } },
} as const;

export type AgentationThreadWriteRow = Prisma.AgentationAnnotationGetPayload<{
  include: typeof THREAD_WITH_SESSION_INCLUDE;
}>;

export interface AgentationEventRecord {
  readonly sequence: bigint;
  readonly type: string;
  readonly sessionId?: string;
  readonly payload: unknown;
  readonly timestamp: string;
}

const MAX_EVENT_BATCH = 500;
export class AgentationPrismaRepository extends AgentationReadRepository {
  async latestEventSequence(
    access: FeedbackAccess,
    sessionId?: string,
  ): Promise<bigint> {
    const result = await this.prisma.agentationEvent.aggregate({
      where: {
        ...(sessionId ? { sessionId } : {}),
        session: sessionScope(access),
      },
      _max: { sequence: true },
    });
    return result._max.sequence ?? BigInt(0);
  }

  async events(
    access: FeedbackAccess,
    after: bigint,
    sessionId?: string,
    limit = MAX_EVENT_BATCH,
  ): Promise<AgentationEventRecord[]> {
    const rows = await this.prisma.agentationEvent.findMany({
      where: {
        sequence: { gt: after },
        ...(sessionId ? { sessionId } : {}),
        session: sessionScope(access),
      },
      orderBy: { sequence: "asc" },
      take: Math.min(MAX_EVENT_BATCH, Math.max(1, Math.trunc(limit))),
    });
    return rows.map(mapEvent);
  }

  async createSession(
    access: FeedbackAccess,
    input: AgentationSessionCreate,
  ): Promise<ReturnType<typeof mapSession>> {
    const url = normalizeAgentationPath(input.url);
    return this.prisma.$transaction(async (db) => {
      const proposedId = randomUUID();
      const row = await db.agentationSession.upsert({
        where: { authorUserId_url: { authorUserId: access.userId, url } },
        update: {},
        create: {
          id: proposedId,
          url,
          projectId: WEEKLY_REPORT_FEEDBACK_PRODUCT,
          metadata: Prisma.JsonNull,
          authorUserId: access.userId,
          authorReportingGroupId: access.reportingGroupId ?? null,
          authorRole: access.role,
          authorName: access.name,
          authorEmail: access.email,
        },
        include: {
          annotations: {
            include: { threadMessages: { orderBy: { timestamp: "asc" } } },
          },
        },
      });
      const session = mapSession(row);
      if (row.id === proposedId)
        await emit(db, {
          type: "session.created",
          sessionId: row.id,
          payload: session,
          authorUserId: access.userId,
        });
      return session;
    });
  }

  async addAnnotation(
    access: FeedbackAccess,
    sessionId: string,
    input: AgentationAnnotationCreate,
  ): Promise<ReturnType<typeof mapAnnotation> | null> {
    return this.prisma.$transaction(async (db) => {
      const session = await db.agentationSession.findFirst({
        where: { id: sessionId, ...sessionScope(access) },
      });
      if (!session) return null;
      const proposedId = randomUUID();
      const row = await db.agentationAnnotation.upsert({
        where: {
          sessionId_authorUserId_clientId: {
            sessionId,
            authorUserId: access.userId,
            clientId: input.id,
          },
        },
        update: {},
        create: annotationData(proposedId, access, session, sessionId, input),
        include: { threadMessages: { orderBy: { timestamp: "asc" } } },
      });
      const annotation = mapAnnotation(row);
      if (row.id === proposedId)
        await emit(db, {
          type: "annotation.created",
          sessionId,
          annotationId: row.id,
          payload: annotation,
          authorUserId: access.userId,
        });
      return annotation;
    });
  }

  async updateAnnotation(
    access: FeedbackAccess,
    id: string,
    patch: AgentationAnnotationPatch,
    role: AgentationRole = "human",
  ): Promise<ReturnType<typeof mapAnnotation> | null> {
    return this.prisma.$transaction(async (db) => {
      const current = await db.agentationAnnotation.findFirst({
        where: { id, ...annotationScope(access) },
        include: { threadMessages: { orderBy: { timestamp: "asc" } } },
      });
      if (!current) return null;
      const data = updateData(patch, role, current);
      if (Object.keys(data).length === 0) return mapAnnotation(current);
      const row = await db.agentationAnnotation.update({
        where: { id },
        data,
        include: { threadMessages: { orderBy: { timestamp: "asc" } } },
      });
      const annotation = mapAnnotation(row);
      await emit(db, {
        type: "annotation.updated",
        sessionId: row.sessionId,
        annotationId: id,
        payload: annotation,
        ...(actorId(access, role)
          ? { authorUserId: actorId(access, role) }
          : {}),
      });
      return annotation;
    });
  }

  async addThreadMessage(
    access: FeedbackAccess,
    id: string,
    input: AgentationThread | string,
    role: AgentationRole = "human",
  ): Promise<ReturnType<typeof mapAnnotation> | null> {
    const row = await this.addThreadMessageForInbox(access, id, input, role);
    return row ? mapAnnotation(row) : null;
  }

  async addThreadMessageForInbox(
    access: FeedbackAccess,
    id: string,
    input: AgentationThread | string,
    role: AgentationRole = "human",
  ): Promise<AgentationThreadWriteRow | null> {
    return this.prisma.$transaction(async (db) => {
      const current = await lockVisibleAnnotation(db, access, id);
      if (!current) return null;
      const content = typeof input === "string" ? input : input.content;
      const message = await db.agentationThreadMessage.create({
        data: {
          id: randomUUID(),
          annotationId: id,
          role,
          content,
          timestamp: BigInt(Date.now()),
          authorUserId: actorId(access, role) ?? null,
        },
      });
      await emit(db, {
        type: "thread.message",
        sessionId: current.sessionId,
        annotationId: id,
        payload: {
          id: message.id,
          role,
          content: message.content,
          timestamp: Number(message.timestamp),
          authorUserId: message.authorUserId,
        },
        ...(actorId(access, role)
          ? { authorUserId: actorId(access, role) }
          : {}),
      });
      const row = await db.agentationAnnotation.findUnique({
        where: { id },
        include: THREAD_WITH_SESSION_INCLUDE,
      });
      return row;
    });
  }

  async action(
    access: FeedbackAccess,
    sessionId: string,
    input: AgentationAction | string,
    role: AgentationRole = "human",
  ): Promise<number | null> {
    return this.prisma.$transaction(async (db) => {
      const session = await db.agentationSession.findFirst({
        where: { id: sessionId, ...sessionScope(access) },
        include: {
          annotations: {
            include: { threadMessages: { orderBy: { timestamp: "asc" } } },
          },
        },
      });
      if (!session) return null;
      const output = typeof input === "string" ? input : input.output;
      await emit(db, {
        type: "action.requested",
        sessionId,
        payload: {
          sessionId,
          annotations: session.annotations.map(mapAnnotation),
          output,
          timestamp: new Date().toISOString(),
        },
        ...(actorId(access, role)
          ? { authorUserId: actorId(access, role) }
          : {}),
      });
      return session.annotations.length;
    });
  }
}
