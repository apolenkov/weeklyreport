import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPauseGate } from "../../test-utils/paused-prisma";
import {
  createTestPrisma,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper";
import { AgentationPrismaRepository } from "./agentation.repository";
import { AgentationInboxActions } from "./agentation-inbox-actions";
import type { FeedbackAccess } from "./product-feedback.repository";

describe("Agentation deletion protocol", () => {
  const prisma = createTestPrisma();
  const repository = new AgentationPrismaRepository(prisma as never);
  const actions = new AgentationInboxActions(prisma as never);
  const author: FeedbackAccess = {
    userId: randomUUID(),
    role: "lead",
    name: "Protocol Lead",
    email: `agentation-${randomUUID()}@example.test`,
    reportingGroupId: undefined,
  };
  const admin: FeedbackAccess = {
    userId: randomUUID(),
    role: "admin",
    name: "Protocol Admin",
    email: `agentation-${randomUUID()}@example.test`,
    reportingGroupId: undefined,
  };

  beforeAll(async () => {
    await prisma.user.createMany({
      data: [author, admin].map((actor) => ({
        id: actor.userId,
        email: actor.email,
        name: actor.name,
        firstName: "Protocol",
        lastName: actor.role,
        role: actor.role,
        samlId: actor.userId,
      })),
    });
  });

  afterAll(async () => {
    await prisma.agentationSession.deleteMany({
      where: { authorUserId: author.userId },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [author.userId, admin.userId] } },
    });
    await disconnectTestPrisma();
  });

  async function fixture() {
    const session = await repository.createSession(author, {
      url: `/protocol/${randomUUID()}`,
    });
    const input = {
      id: randomUUID(),
      x: 1,
      y: 2,
      comment: "Deleted evidence",
      element: "button",
      elementPath: "main > button",
      timestamp: Date.now(),
    };
    const row = await repository.addAnnotation(author, session.id, input);
    if (!row) throw new Error("Fixture annotation was not created");
    return { session, input, row };
  }

  it.each(["client", "server"])(
    "does not recreate a deleted %s ID",
    async (kind) => {
      const { session, input, row } = await fixture();
      await actions.delete(admin, `agentation_${row.id}`);
      const replay = await repository.addAnnotation(author, session.id, {
        ...input,
        id: kind === "client" ? input.id : row.id,
      });
      expect(replay?.status).toBe("dismissed");
      expect(
        await prisma.agentationAnnotation.count({
          where: { sessionId: session.id },
        }),
      ).toBe(0);
      const events = await prisma.agentationEvent.findMany({
        where: { sessionId: session.id },
      });
      expect(
        JSON.stringify(events.map((event) => event.payload)),
      ).not.toContain(input.comment);
    },
  );

  it("replays only deletions made after the page snapshot within the authorized session", async () => {
    const { session, row } = await fixture();
    const snapshot = await repository.getSession(author, session.id);
    expect(snapshot?.annotations?.map((annotation) => annotation.id)).toContain(
      row.id,
    );
    await repository.updateAnnotation(admin, row.id, { status: "resolved" });
    expect(
      await repository.deletionEvents(
        author,
        session.id,
        0n,
        await repository.latestEventSequence(author, session.id),
        1,
      ),
    ).toEqual([]);
    await actions.delete(admin, `agentation_${row.id}`);
    const cursor = await repository.latestEventSequence(author, session.id);
    const deleted = await repository.deletionEvents(
      author,
      session.id,
      0n,
      cursor,
      1,
    );
    expect(deleted).toHaveLength(1);
    expect(deleted[0]?.payload).toMatchObject({
      id: row.id,
      deleted: true,
      status: "dismissed",
    });
    expect(
      await repository.deletionEvents(
        { ...author, userId: admin.userId },
        session.id,
        0n,
        cursor,
        1,
      ),
    ).toEqual([]);
    expect(
      await repository.deletionEvents(author, session.id, cursor, cursor, 1),
    ).toEqual([]);
  });

  it("recognizes an existing server ID before deletion", async () => {
    const { session, input, row } = await fixture();
    const replay = await repository.addAnnotation(author, session.id, {
      ...input,
      id: row.id,
    });
    expect(replay?.id).toBe(row.id);
    await actions.delete(admin, `agentation_${row.id}`);
    expect(
      await prisma.agentationAnnotation.count({
        where: { sessionId: session.id },
      }),
    ).toBe(0);
  });

  it("does not suppress another author's matching client ID", async () => {
    const { session, input, row } = await fixture();
    await actions.delete(admin, `agentation_${row.id}`);
    const other = await repository.addAnnotation(admin, session.id, input);
    expect(other?.status).toBe("pending");
    expect(other?.authorId).toBe(admin.userId);
  });

  it.each([
    ["post", "client"],
    ["post", "server"],
    ["delete", "client"],
    ["delete", "server"],
  ])(
    "serializes %s first with a concurrent %s ID replay",
    async (first, kind) => {
      const { session, input, row } = await fixture();
      const holder = createPauseGate();
      const waiting = Promise.withResolvers<void>();
      const heldClient = prisma.$extends({
        query: {
          async $allOperations({ operation, args, query }) {
            const result: unknown = await query(args);
            if (operation === "$queryRaw") await holder.pause();
            return result;
          },
        },
      });
      const waitingClient = prisma.$extends({
        query: {
          async $allOperations({ operation, args, query }) {
            if (operation === "$queryRaw") waiting.resolve();
            const result: unknown = await query(args);
            return result;
          },
        },
      });
      const replayInput = {
        ...input,
        id: kind === "client" ? input.id : row.id,
      };
      const post = (client: typeof heldClient | typeof prisma) =>
        new AgentationPrismaRepository(client as never).addAnnotation(
          author,
          session.id,
          replayInput,
        );
      const remove = (client: typeof heldClient | typeof prisma) =>
        new AgentationInboxActions(client as never).delete(
          admin,
          `agentation_${row.id}`,
        );
      const firstOperation =
        first === "post" ? post(heldClient) : remove(heldClient);
      try {
        await holder.paused;
        const secondOperation =
          first === "post" ? remove(waitingClient) : post(waitingClient);
        await waiting.promise;
        holder.release();
        await Promise.all([firstOperation, secondOperation]);
        expect(
          await prisma.agentationAnnotation.count({
            where: { sessionId: session.id },
          }),
        ).toBe(0);
        const replay = await post(prisma);
        expect(replay?.status).toBe("dismissed");
      } finally {
        holder.release();
        await firstOperation;
      }
    },
  );

  it("allows a status writer to finish its event while deletion holds the session", async () => {
    const { session, row } = await fixture();
    const updated = createPauseGate();
    const sessionHeld = createPauseGate();
    const statusClient = prisma.$extends({
      query: {
        agentationAnnotation: {
          async update({ args, query }) {
            const result = await query(args);
            await updated.pause();
            return result;
          },
        },
      },
    });
    const deleteClient = prisma.$extends({
      query: {
        async $allOperations({ operation, args, query }) {
          const result: unknown = await query(args);
          if (operation === "$queryRaw") await sessionHeld.pause();
          return result;
        },
      },
    });
    const status = new AgentationInboxActions(
      statusClient as never,
    ).updateStatus(admin, `agentation_${row.id}`, "in_progress");
    await updated.paused;
    const deletion = new AgentationInboxActions(deleteClient as never).delete(
      admin,
      `agentation_${row.id}`,
    );
    try {
      await sessionHeld.paused;
      updated.release();
      await status;
      sessionHeld.release();
      await deletion;
      expect(
        await prisma.agentationAnnotation.count({
          where: { sessionId: session.id },
        }),
      ).toBe(0);
    } finally {
      updated.release();
      sessionHeld.release();
      await Promise.allSettled([status, deletion]);
    }
  });
});
