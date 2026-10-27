import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { THREAD_MESSAGES_INCLUDE } from "./agentation.repository.helpers";
import { AgentationInboxRepository } from "./agentation-inbox.repository";
import { AgentationInboxActions } from "./agentation-inbox-actions";
import { makeAgentationInboxRow } from "./agentation-inbox-test-fixtures";
import type { FeedbackAccess } from "./product-feedback.repository";

const access: FeedbackAccess = {
  userId: "u-head",
  role: "head",
  name: "Head",
  email: "head@example.test",
  reportingGroupId: "g-1",
};

// The session snapshot reads the shared include, so the inbox has to request
// exactly that order: timestamp, then server ID.
const SNAPSHOT_THREAD_ORDER = THREAD_MESSAGES_INCLUDE.threadMessages.orderBy;

interface ThreadQuery {
  readonly include?: {
    readonly threadMessages?: { readonly orderBy?: unknown };
  };
}

interface QuerySpy {
  readonly mock: { readonly calls: readonly (readonly unknown[])[] };
}

function firstQuery(spy: QuerySpy): unknown {
  return spy.mock.calls[0]?.[0];
}

function requestedThreadOrder(query: unknown): unknown {
  return (query as ThreadQuery | undefined)?.include?.threadMessages?.orderBy;
}

function actionsWith(tx: object): AgentationInboxActions {
  const prisma = {
    $transaction: vi.fn((callback: (value: object) => unknown) => callback(tx)),
  } as unknown as PrismaService;
  return new AgentationInboxActions(prisma);
}

describe("Agentation inbox thread order", () => {
  it("asks the list for the session-snapshot thread order", async () => {
    const findMany = vi.fn().mockResolvedValue([makeAgentationInboxRow()]);
    const prisma = {
      agentationAnnotation: {
        findMany,
        count: vi.fn().mockResolvedValue(1),
      },
    } as unknown as PrismaService;

    await new AgentationInboxRepository(prisma).list(access, {
      search: "move",
    });

    expect(requestedThreadOrder(firstQuery(findMany))).toEqual(
      SNAPSHOT_THREAD_ORDER,
    );
  });

  it("asks the status change for the snapshot thread order", async () => {
    const current = makeAgentationInboxRow();
    const changed = { ...current, status: "resolved" };
    const tx = {
      agentationAnnotation: {
        findFirst: vi.fn().mockResolvedValue(current),
        update: vi.fn().mockResolvedValue(changed),
      },
      agentationEvent: { create: vi.fn().mockResolvedValue({}) },
    };

    await actionsWith(tx).updateStatus(access, "agentation_a-1", "resolved");

    expect(
      requestedThreadOrder(firstQuery(tx.agentationAnnotation.findFirst)),
    ).toEqual(SNAPSHOT_THREAD_ORDER);
    expect(
      requestedThreadOrder(firstQuery(tx.agentationAnnotation.update)),
    ).toEqual(SNAPSHOT_THREAD_ORDER);
  });

  it("asks the original edit for the snapshot thread order", async () => {
    const current = makeAgentationInboxRow({ authorUserId: access.userId });
    const changed = { ...current, comment: "Edited" };
    const tx = {
      agentationAnnotation: {
        findFirst: vi.fn().mockResolvedValue(current),
        update: vi.fn().mockResolvedValue(changed),
      },
      agentationEvent: { create: vi.fn().mockResolvedValue({}) },
    };

    await actionsWith(tx).editOriginal(access, "agentation_a-1", "Edited");

    expect(
      requestedThreadOrder(firstQuery(tx.agentationAnnotation.findFirst)),
    ).toEqual(SNAPSHOT_THREAD_ORDER);
    expect(
      requestedThreadOrder(firstQuery(tx.agentationAnnotation.update)),
    ).toEqual(SNAPSHOT_THREAD_ORDER);
  });

  it("asks the dismissal for the snapshot thread order", async () => {
    const current = makeAgentationInboxRow();
    const changed = { ...current, status: "dismissed" };
    const tx = {
      agentationAnnotation: {
        findFirst: vi.fn().mockResolvedValue(current),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(changed),
      },
      agentationThreadMessage: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({
          id: "m-1",
          content: "Dismissed: Not actionable",
          timestamp: 10n,
        }),
      },
      agentationEvent: { create: vi.fn().mockResolvedValue({}) },
    };

    await actionsWith(tx).dismiss(access, "agentation_a-1", "Not actionable");

    expect(
      requestedThreadOrder(firstQuery(tx.agentationAnnotation.findFirst)),
    ).toEqual(SNAPSHOT_THREAD_ORDER);
    expect(
      requestedThreadOrder(
        firstQuery(tx.agentationAnnotation.findUniqueOrThrow),
      ),
    ).toEqual(SNAPSHOT_THREAD_ORDER);
  });
});
