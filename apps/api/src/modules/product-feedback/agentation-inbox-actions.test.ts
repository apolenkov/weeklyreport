import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AgentationInboxActions } from "./agentation-inbox-actions";
import type { AgentationInboxRow } from "./agentation-inbox-projection";
import type { FeedbackAccess } from "./product-feedback.repository";

const access: FeedbackAccess = {
  userId: "u-admin",
  role: "admin",
  name: "Admin",
  email: "admin@example.test",
  reportingGroupId: undefined,
};

function row(status = "pending"): AgentationInboxRow {
  const now = new Date("2026-09-04T10:00:00.000Z");
  return {
    id: "a-1",
    clientId: "c-1",
    sessionId: "s-1",
    x: 1,
    y: 1,
    comment: "Original",
    element: "button",
    elementPath: "#save",
    timestamp: 1n,
    selectedText: null,
    boundingBox: null,
    nearbyText: null,
    cssClasses: null,
    nearbyElements: null,
    computedStyles: null,
    fullPath: null,
    accessibility: null,
    isMultiSelect: false,
    isFixed: false,
    reactComponents: null,
    sourceFile: null,
    drawingIndex: null,
    elementBoundingBoxes: null,
    placement: null,
    rearrange: null,
    url: "/lead",
    kind: "feedback",
    intent: "change",
    severity: null,
    status,
    threadMessages: [],
    source: null,
    context: null,
    resolvedAt: null,
    resolvedBy: null,
    authorUserId: "u-lead",
    authorReportingGroupId: null,
    authorRole: "lead",
    authorName: "Lead",
    authorEmail: "lead@example.test",
    createdAt: now,
    updatedAt: now,
    session: { id: "s-1", url: "/lead", status: "active" },
    author: { name: "Lead", email: "lead@example.test" },
  } as unknown as AgentationInboxRow;
}

function prismaFor(tx: object): PrismaService {
  return {
    $transaction: vi.fn((callback: (value: object) => unknown) => callback(tx)),
  } as unknown as PrismaService;
}

describe("AgentationInboxActions", () => {
  it("hard-deletes annotation evidence and retains a terminal tombstone", async () => {
    const current = row();
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "a-1" }]),
      agentationAnnotation: {
        findFirst: vi.fn().mockResolvedValue(current),
        delete: vi.fn().mockResolvedValue(current),
      },
      agentationEvent: {
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
        create: vi.fn().mockResolvedValue({}),
      },
    };

    await new AgentationInboxActions(prismaFor(tx)).delete(
      access,
      "agentation_a-1",
    );

    expect(tx.agentationEvent.deleteMany).toHaveBeenCalledWith({
      where: { annotationId: "a-1" },
    });
    expect(tx.agentationAnnotation.delete).toHaveBeenCalledWith({
      where: { id: "a-1" },
    });
    expect(tx.agentationEvent.create.mock.calls).toMatchObject([
      [
        {
          data: {
            type: "annotation.updated",
            annotationId: "a-1",
            payload: {
              id: "a-1",
              clientId: current.clientId,
              status: "dismissed",
              deleted: true,
            },
          },
        },
      ],
    ]);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.agentationAnnotation.delete.mock.invocationCallOrder[0] ?? 0,
    );
    expect(
      tx.agentationEvent.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.agentationEvent.create.mock.invocationCallOrder[0] ?? 0);
  });

  it("does not delete an annotation outside the actor scope", async () => {
    const tx = {
      agentationAnnotation: { findFirst: vi.fn().mockResolvedValue(null) },
      agentationEvent: { deleteMany: vi.fn() },
    };

    await expect(
      new AgentationInboxActions(prismaFor(tx)).delete(
        access,
        "agentation_a-1",
      ),
    ).rejects.toMatchObject({ code: "STORE_NOT_FOUND" });
    expect(tx.agentationEvent.deleteMany).not.toHaveBeenCalled();
  });

  it("fails closed when the annotation disappears before the delete lock", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      agentationAnnotation: {
        findFirst: vi.fn().mockResolvedValue(row()),
        delete: vi.fn(),
      },
      agentationEvent: { deleteMany: vi.fn() },
    };

    await expect(
      new AgentationInboxActions(prismaFor(tx)).delete(
        access,
        "agentation_a-1",
      ),
    ).rejects.toMatchObject({ code: "STORE_NOT_FOUND" });
    expect(tx.agentationAnnotation.delete).not.toHaveBeenCalled();
    expect(tx.agentationEvent.deleteMany).not.toHaveBeenCalled();
  });

  it("edits only the original author's annotation and emits the mapped event", async () => {
    const current = row();
    current.authorUserId = access.userId;
    const changed = { ...current, comment: "Edited" };
    const tx = {
      agentationAnnotation: {
        findFirst: vi.fn().mockResolvedValue(current),
        update: vi.fn().mockResolvedValue(changed),
      },
      agentationEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const result = await new AgentationInboxActions(prismaFor(tx)).editOriginal(
      access,
      "agentation_a-1",
      "Edited",
    );

    expect(result.message).toBe("Edited");
    const editQuery = tx.agentationAnnotation.findFirst.mock
      .calls[0]?.[0] as unknown as { where: { authorUserId: string } };
    expect(editQuery.where.authorUserId).toBe(access.userId);
    const editEvent = tx.agentationEvent.create.mock
      .calls[0]?.[0] as unknown as { data: { type: string } };
    expect(editEvent.data.type).toBe("annotation.updated");
  });

  it("rejects wont_fix as a status mutation even when called directly", async () => {
    const transaction = vi.fn();
    const actions = new AgentationInboxActions({
      $transaction: transaction,
    } as unknown as PrismaService);

    await expect(
      actions.updateStatus(access, "agentation_a-1", "wont_fix"),
    ).rejects.toMatchObject({ code: "STORE_INVALID_STATUS" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("dismisses once, records the reason, and emits both events in one transaction", async () => {
    const current = row();
    const changed = { ...current, status: "dismissed" };
    const tx = {
      agentationAnnotation: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(current)
          .mockResolvedValueOnce(changed),
        update: vi.fn().mockResolvedValue(changed),
        updateMany: vi
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(changed),
      },
      agentationThreadMessage: {
        create: vi.fn().mockResolvedValue({
          id: "m-1",
          content: "Dismissed: Not actionable",
          timestamp: 10n,
        }),
      },
      agentationEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const actions = new AgentationInboxActions(prismaFor(tx));
    await actions.dismiss(access, "agentation_a-1", "Not actionable");
    await actions.dismiss(access, "agentation_a-1", "Not actionable");

    expect(tx.agentationThreadMessage.create).toHaveBeenCalledTimes(1);
    expect(tx.agentationEvent.create).toHaveBeenCalledTimes(2);
    const claim = tx.agentationAnnotation.updateMany.mock
      .calls[0]?.[0] as unknown as { where: { status: { not: string } } };
    expect(claim.where.status.not).toBe("dismissed");
    const dismissEvent = tx.agentationEvent.create.mock
      .calls[0]?.[0] as unknown as { data: { type: string } };
    expect(dismissEvent.data.type).toBe("thread.message");
  });

  it("returns the winner's row when a concurrent dismiss already claimed it", async () => {
    const pending = row();
    const dismissed = { ...pending, status: "dismissed" };
    const tx = {
      agentationAnnotation: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(pending)
          .mockResolvedValueOnce(dismissed),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      agentationThreadMessage: { create: vi.fn() },
      agentationEvent: { create: vi.fn() },
    };

    const result = await new AgentationInboxActions(prismaFor(tx)).dismiss(
      access,
      "agentation_a-1",
      "Duplicate request",
    );

    expect(result.status).toBe("wont_fix");
    expect(tx.agentationThreadMessage.create).not.toHaveBeenCalled();
    expect(tx.agentationEvent.create).not.toHaveBeenCalled();
  });

  it("replies transactionally and includes the thread event actor in its payload", async () => {
    const current = row();
    const message = {
      id: "m-1",
      annotationId: "a-1",
      role: "human",
      content: "Please take this one",
      timestamp: 10n,
      authorUserId: access.userId,
    };
    const changed = { ...current, threadMessages: [message] };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "a-1" }]),
      agentationAnnotation: {
        findFirst: vi.fn().mockResolvedValue(current),
        findUnique: vi.fn().mockResolvedValue(changed),
      },
      agentationThreadMessage: { create: vi.fn().mockResolvedValue(message) },
      agentationEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = prismaFor(tx);

    const result = await new AgentationInboxActions(prisma).reply(
      access,
      "agentation_a-1",
      message.content,
    );

    expect(result.thread[0]?.content).toBe(message.content);
    const replyEvent = tx.agentationEvent.create.mock
      .calls[0]?.[0] as unknown as {
      data: { type: string; payload: { authorUserId: string } };
    };
    expect(replyEvent.data.type).toBe("thread.message");
    expect(replyEvent.data.payload.authorUserId).toBe(access.userId);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.agentationThreadMessage.create.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("returns not found instead of writing a reply after concurrent deletion", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      agentationAnnotation: {
        findFirst: vi.fn().mockResolvedValue(row()),
        findUnique: vi.fn(),
      },
      agentationThreadMessage: { create: vi.fn() },
      agentationEvent: { create: vi.fn() },
    };

    await expect(
      new AgentationInboxActions(prismaFor(tx)).reply(
        access,
        "agentation_a-1",
        "Too late",
      ),
    ).rejects.toMatchObject({ code: "STORE_NOT_FOUND" });
    expect(tx.agentationThreadMessage.create).not.toHaveBeenCalled();
    expect(tx.agentationEvent.create).not.toHaveBeenCalled();
  });
});
