import { randomUUID } from "node:crypto";

import {
  agentationAnnotationCreateSchema,
  agentationThreadSchema,
  MAX_FEEDBACK_MESSAGE_LENGTH,
} from "@weeklyreport/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createTestPrisma,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper";
import { AgentationPrismaRepository } from "./agentation.repository";
import {
  type FeedbackAccess,
  FeedbackLimitError,
} from "./product-feedback.repository";

// TASK-503.18 C3623 contract (008, option A): one event carries at most 1 MiB.
const MAX_ACTION_EVENT_BYTES = 1024 * 1024;

describe("Agentation action event size", () => {
  const prisma = createTestPrisma();
  const repository = new AgentationPrismaRepository(prisma as never);
  const author: FeedbackAccess = {
    userId: randomUUID(),
    role: "lead",
    name: "Action Lead",
    email: `agentation-${randomUUID()}@example.test`,
    reportingGroupId: undefined,
  };

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: author.userId,
        email: author.email,
        name: author.name,
        firstName: "Action",
        lastName: author.role,
        role: author.role,
        samlId: author.userId,
      },
    });
  });

  afterAll(async () => {
    await prisma.agentationSession.deleteMany({
      where: { authorUserId: author.userId },
    });
    await prisma.user.deleteMany({ where: { id: author.userId } });
    await disconnectTestPrisma();
  });

  // Every value is admitted by the public ingress schemas at its maximum.
  async function sessionWith(annotations: number, repliesEach: number) {
    const session = await repository.createSession(author, {
      url: `/action-size/${randomUUID()}`,
    });
    for (let index = 0; index < annotations; index += 1) {
      const annotation = await repository.addAnnotation(
        author,
        session.id,
        agentationAnnotationCreateSchema.parse({
          id: randomUUID(),
          x: 1,
          y: 2,
          comment: "c".repeat(MAX_FEEDBACK_MESSAGE_LENGTH),
          element: "button",
          elementPath: "main > button",
          timestamp: Date.now(),
        }),
      );
      if (!annotation) throw new Error("Fixture annotation was not created");
      for (let reply = 0; reply < repliesEach; reply += 1) {
        const row = await repository.addThreadMessageForInbox(
          author,
          annotation.id,
          agentationThreadSchema.parse({
            content: "r".repeat(MAX_FEEDBACK_MESSAGE_LENGTH),
          }),
        );
        if (!row) throw new Error("Fixture reply was not created");
      }
    }
    return session.id;
  }

  async function snapshotBytes(sessionId: string) {
    const snapshot = await repository.getSession(author, sessionId);
    if (!snapshot || !("annotations" in snapshot)) {
      throw new Error("Fixture session snapshot is not readable");
    }
    return Buffer.byteLength(JSON.stringify(snapshot.annotations), "utf8");
  }

  function actionEvents(sessionId: string) {
    return prisma.agentationEvent.count({
      where: { sessionId, type: "action.requested" },
    });
  }

  it("rejects an action whose event would exceed the limit, without emitting it", async () => {
    // Five annotations with 49 maximum replies each serialize above 1 MiB.
    const sessionId = await sessionWith(5, 49);
    expect(await snapshotBytes(sessionId)).toBeGreaterThan(
      MAX_ACTION_EVENT_BYTES,
    );

    await expect(
      repository.action(author, sessionId, "Apply the feedback"),
    ).rejects.toBeInstanceOf(FeedbackLimitError);
    expect(await actionEvents(sessionId)).toBe(0);
    // The fixture writes ~250 rows one by one; the 5 s default is not enough.
  }, 60_000);

  it("emits one action event below the limit", async () => {
    const sessionId = await sessionWith(1, 2);
    expect(await snapshotBytes(sessionId)).toBeLessThan(MAX_ACTION_EVENT_BYTES);

    await expect(
      repository.action(author, sessionId, "Apply the feedback"),
    ).resolves.toBe(1);
    expect(await actionEvents(sessionId)).toBe(1);
  });
});
