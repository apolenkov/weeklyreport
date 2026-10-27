import { randomUUID } from "node:crypto";

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  createTestPrisma,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper";
import { AgentationPrismaRepository } from "./agentation.repository";
import { AgentationInboxRepository } from "./agentation-inbox.repository";
import type { FeedbackAccess } from "./product-feedback.repository";

describe("Agentation inbox thread order", () => {
  const prisma = createTestPrisma();
  const repository = new AgentationPrismaRepository(prisma as never);
  const inbox = new AgentationInboxRepository(prisma as never);
  const author: FeedbackAccess = {
    userId: randomUUID(),
    role: "lead",
    name: "Thread Lead",
    email: `agentation-${randomUUID()}@example.test`,
    reportingGroupId: undefined,
  };

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: author.userId,
        email: author.email,
        name: author.name,
        firstName: "Thread",
        lastName: author.role,
        role: author.role,
        samlId: author.userId,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.agentationSession.deleteMany({
      where: { authorUserId: author.userId },
    });
    await prisma.user.deleteMany({ where: { id: author.userId } });
    await disconnectTestPrisma();
  });

  async function annotationWithReplies(replies: number) {
    const marker = `thread-order-${randomUUID()}`;
    const session = await repository.createSession(author, {
      url: `/thread-order/${randomUUID()}`,
    });
    const annotation = await repository.addAnnotation(author, session.id, {
      id: randomUUID(),
      x: 1,
      y: 2,
      comment: marker,
      element: "button",
      elementPath: "main > button",
      timestamp: Date.now(),
    });
    if (!annotation) throw new Error("Fixture annotation was not created");
    // Replies stamp the server clock in milliseconds; one fixed millisecond
    // stands for replies that land in the same tick.
    vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 9, 15, 12));
    for (let index = 0; index < replies; index += 1) {
      const reply = await repository.addThreadMessageForInbox(
        author,
        annotation.id,
        `Reply ${index}`,
      );
      if (!reply) throw new Error("Fixture reply was not created");
    }
    vi.restoreAllMocks();
    return { marker, sessionId: session.id, annotationId: annotation.id };
  }

  async function inboxThreadIds(marker: string) {
    const page = await inbox.list(author, { search: marker });
    const [record, ...rest] = page.feedbacks;
    if (!record || rest.length > 0) throw new Error("Fixture is not unique");
    return record.thread.map((message) => message.id);
  }

  async function snapshotThreadIds(sessionId: string) {
    const snapshot = await repository.getSession(author, sessionId);
    if (!snapshot || !("annotations" in snapshot)) {
      throw new Error("Fixture session snapshot is not readable");
    }
    const [annotation] = snapshot.annotations;
    if (!annotation) throw new Error("Fixture annotation is not readable");
    return annotation.thread.map((message) => message.id);
  }

  it("lists same-millisecond replies in the snapshot's server-id order", async () => {
    const fixture = await annotationWithReplies(8);

    // The database orders the oracle, so the lane's text collation decides.
    const oracle = await prisma.agentationThreadMessage.findMany({
      where: { annotationId: fixture.annotationId },
      orderBy: [{ timestamp: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    const expected = oracle.map((row) => row.id);

    expect(expected).toHaveLength(8);
    expect(await snapshotThreadIds(fixture.sessionId)).toEqual(expected);
    expect(await inboxThreadIds(fixture.marker)).toEqual(expected);
  });

  it("keeps replies from different milliseconds in timestamp order", async () => {
    const fixture = await annotationWithReplies(0);
    const now = vi.spyOn(Date, "now");
    // Inserted later-first, so insertion order cannot satisfy the check.
    for (const [content, at] of [
      ["Later", Date.UTC(2026, 9, 15, 12, 0, 2)],
      ["Earlier", Date.UTC(2026, 9, 15, 12, 0, 1)],
    ] as const) {
      now.mockReturnValue(at);
      const row = await repository.addThreadMessageForInbox(
        author,
        fixture.annotationId,
        content,
      );
      if (!row) throw new Error("Fixture reply was not created");
    }
    now.mockRestore();

    const page = await inbox.list(author, { search: fixture.marker });
    expect(
      page.feedbacks.flatMap((record) =>
        record.thread.map((message) => message.content),
      ),
    ).toEqual(["Earlier", "Later"]);
  });
});
