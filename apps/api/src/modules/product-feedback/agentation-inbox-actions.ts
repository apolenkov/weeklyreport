import { randomUUID } from "node:crypto";

import {
  FEEDBACK_DISMISSAL_PREFIX,
  type FeedbackStatus,
} from "@weeklyreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  emit,
  lockVisibleAnnotation,
} from "./agentation.repository.helpers.js";
import { AgentationPrismaRepository } from "./agentation.repository.js";
import {
  annotationIdFromInboxId,
  projectAgentation,
} from "./agentation-inbox-projection.js";
import { mapAnnotation } from "./agentation-mappers.js";
import { annotationScope } from "./agentation-scope.js";
import {
  type FeedbackAccess,
  FeedbackInvalidStatusError,
  FeedbackNotFoundError,
  type FeedbackRecord,
} from "./product-feedback.repository.js";

const ANNOTATION_UPDATED_EVENT = "annotation.updated";
const ANNOTATION_WITH_THREAD = {
  session: true,
  threadMessages: { orderBy: { timestamp: "asc" } },
} as const;

export class AgentationInboxActions {
  constructor(private readonly prisma: PrismaService) {}

  async delete(access: FeedbackAccess, inboxId: string): Promise<void> {
    const id = annotationIdFromInboxId(inboxId);
    if (!id) throw new FeedbackNotFoundError();
    await this.prisma.$transaction(async (tx) => {
      const current = await lockVisibleAnnotation(tx, access, id);
      if (!current) throw new FeedbackNotFoundError();

      // The row lock closes concurrent thread writes; children follow the
      // parent cascade and prior event payloads must not retain evidence.
      await tx.agentationAnnotation.delete({ where: { id } });
      await tx.agentationEvent.deleteMany({ where: { annotationId: id } });
      await emit(tx, {
        type: ANNOTATION_UPDATED_EVENT,
        sessionId: current.sessionId,
        annotationId: id,
        payload: {
          id,
          clientId: current.clientId,
          authorId: current.authorUserId,
          kind: current.kind,
          status: "dismissed",
          deleted: true,
        },
        authorUserId: access.userId,
      });
    });
  }

  async updateStatus(
    access: FeedbackAccess,
    inboxId: string,
    nextStatus: FeedbackStatus,
  ): Promise<FeedbackRecord> {
    const id = annotationIdFromInboxId(inboxId);
    if (!id) throw new FeedbackNotFoundError();
    if (nextStatus === "wont_fix") {
      throw new FeedbackInvalidStatusError(
        "Agentation dismissal requires a reason.",
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.agentationAnnotation.findFirst({
        where: { id, ...annotationScope(access) },
        include: {
          session: true,
          threadMessages: { orderBy: { timestamp: "asc" } },
        },
      });
      if (!current) throw new FeedbackNotFoundError();
      const databaseStatus =
        nextStatus === "in_progress"
          ? "acknowledged"
          : nextStatus === "resolved"
            ? "resolved"
            : "pending";
      if (current.status === databaseStatus)
        return projectAgentation(current, access);
      const terminal = nextStatus === "resolved";
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
          type: ANNOTATION_UPDATED_EVENT,
          sessionId: changed.sessionId,
          annotationId: changed.id,
          authorUserId: access.userId,
          payload: mapAnnotation(changed),
        },
      });
      return projectAgentation(changed, access);
    });
  }

  async editOriginal(
    access: FeedbackAccess,
    inboxId: string,
    comment: string,
  ): Promise<FeedbackRecord> {
    const id = annotationIdFromInboxId(inboxId);
    if (!id) throw new FeedbackNotFoundError();
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.agentationAnnotation.findFirst({
        where: { id, authorUserId: access.userId, ...annotationScope(access) },
        include: {
          threadMessages: { orderBy: { timestamp: "asc" } },
          session: true,
        },
      });
      if (!current) throw new FeedbackNotFoundError();
      const changed = await tx.agentationAnnotation.update({
        where: { id },
        data: { comment },
        include: {
          threadMessages: { orderBy: { timestamp: "asc" } },
          session: true,
        },
      });
      await tx.agentationEvent.create({
        data: {
          id: randomUUID(),
          type: ANNOTATION_UPDATED_EVENT,
          sessionId: changed.sessionId,
          annotationId: id,
          authorUserId: access.userId,
          payload: mapAnnotation(changed),
        },
      });
      return projectAgentation(changed, access);
    });
  }

  async reply(
    access: FeedbackAccess,
    inboxId: string,
    content: string,
  ): Promise<FeedbackRecord> {
    const id = annotationIdFromInboxId(inboxId);
    if (!id) throw new FeedbackNotFoundError();
    const row = await new AgentationPrismaRepository(
      this.prisma,
    ).addThreadMessageForInbox(access, id, content);
    if (!row) throw new FeedbackNotFoundError();
    return projectAgentation(row, access);
  }

  async dismiss(
    access: FeedbackAccess,
    inboxId: string,
    reason: string,
  ): Promise<FeedbackRecord> {
    const id = annotationIdFromInboxId(inboxId);
    if (!id) throw new FeedbackNotFoundError();
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.agentationAnnotation.findFirst({
        where: { id, ...annotationScope(access) },
        include: ANNOTATION_WITH_THREAD,
      });
      if (!current) throw new FeedbackNotFoundError();
      if (current.status === "dismissed")
        return projectAgentation(current, access);
      const claimed = await tx.agentationAnnotation.updateMany({
        where: {
          id,
          ...annotationScope(access),
          status: { not: "dismissed" },
        },
        data: {
          status: "dismissed",
          resolvedAt: new Date(),
          resolvedBy: "human",
        },
      });
      if (claimed.count !== 1) {
        const dismissed = await tx.agentationAnnotation.findFirst({
          where: { id, ...annotationScope(access) },
          include: ANNOTATION_WITH_THREAD,
        });
        if (!dismissed) throw new FeedbackNotFoundError();
        return projectAgentation(dismissed, access);
      }
      const message = await tx.agentationThreadMessage.create({
        data: {
          id: randomUUID(),
          annotationId: id,
          role: "human",
          content: `${FEEDBACK_DISMISSAL_PREFIX}${reason}`,
          timestamp: BigInt(Date.now()),
          authorUserId: access.userId,
        },
      });
      const changed = await tx.agentationAnnotation.findUniqueOrThrow({
        where: { id },
        include: ANNOTATION_WITH_THREAD,
      });
      await emit(tx, {
        type: "thread.message",
        sessionId: changed.sessionId,
        annotationId: id,
        authorUserId: access.userId,
        payload: {
          id: message.id,
          role: "human",
          content: message.content,
          timestamp: Number(message.timestamp),
          authorUserId: access.userId,
        },
      });
      await emit(tx, {
        type: ANNOTATION_UPDATED_EVENT,
        sessionId: changed.sessionId,
        annotationId: id,
        authorUserId: access.userId,
        payload: mapAnnotation(changed),
      });
      return projectAgentation(changed, access);
    });
  }
}
