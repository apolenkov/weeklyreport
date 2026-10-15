import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createTestPrisma,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper";
import { AgentationPrismaRepository } from "./agentation.repository";
import type { FeedbackAccess } from "./product-feedback.repository";

describe("Agentation session snapshot order", () => {
  const prisma = createTestPrisma();
  const repository = new AgentationPrismaRepository(prisma as never);
  const author: FeedbackAccess = {
    userId: randomUUID(),
    role: "lead",
    name: "Snapshot Lead",
    email: `agentation-${randomUUID()}@example.test`,
    reportingGroupId: undefined,
  };

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: author.userId,
        email: author.email,
        name: author.name,
        firstName: "Snapshot",
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

  // Captures carry the client's timestamp; ingress admits equal values.
  async function capture(sessionId: string, timestamp: number) {
    const row = await repository.addAnnotation(author, sessionId, {
      id: randomUUID(),
      x: 1,
      y: 2,
      comment: "Snapshot order",
      element: "button",
      elementPath: "main > button",
      timestamp,
    });
    if (!row) throw new Error("Fixture annotation was not created");
    return row.id;
  }

  async function snapshotIds(sessionId: string) {
    const snapshot = await repository.getSession(author, sessionId);
    if (!snapshot || !("annotations" in snapshot)) {
      throw new Error("Fixture session snapshot is not readable");
    }
    return snapshot.annotations.map((annotation) => annotation.id);
  }

  it("lists equal-timestamp annotations in server-id order on every read", async () => {
    const session = await repository.createSession(author, {
      url: `/snapshot/${randomUUID()}`,
    });
    const timestamp = Date.now();
    const ids: string[] = [];
    // Eight random server IDs: insertion order matches ID order by chance only.
    for (let index = 0; index < 8; index += 1) {
      ids.push(await capture(session.id, timestamp));
    }

    const first = await snapshotIds(session.id);
    const second = await snapshotIds(session.id);

    // The database orders the oracle, so the lane's text collation decides.
    const byServerId = await prisma.agentationAnnotation.findMany({
      where: { sessionId: session.id },
      orderBy: [{ timestamp: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    expect(byServerId.map((row) => row.id).toSorted()).toEqual(ids.toSorted());
    expect(first).toEqual(byServerId.map((row) => row.id));
    expect(second).toEqual(first);
  });

  it("keeps distinct timestamps in timestamp order", async () => {
    const session = await repository.createSession(author, {
      url: `/snapshot/${randomUUID()}`,
    });
    const base = Date.now();
    const later = await capture(session.id, base + 2);
    const earlier = await capture(session.id, base + 1);

    expect(await snapshotIds(session.id)).toEqual([earlier, later]);
  });
});
