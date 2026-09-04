import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import {
  agentationInboxId,
  AgentationInboxRepository,
  type AgentationInboxRow,
  projectAgentation,
} from "./agentation-inbox.repository";
import type { FeedbackAccess } from "./product-feedback.repository";

const access: FeedbackAccess = {
  userId: "u-head",
  role: "head",
  name: "Head",
  email: "head@example.test",
  reportingGroupId: "g-1",
};

function row(overrides: Partial<AgentationInboxRow> = {}): AgentationInboxRow {
  const now = new Date("2026-09-04T10:00:00.000Z");
  return {
    id: "a-1",
    clientId: "c-1",
    sessionId: "s-1",
    x: 20,
    y: 30,
    comment: "Move this button",
    element: "button",
    elementPath: "#save",
    timestamp: 1n,
    selectedText: null,
    boundingBox: null,
    nearbyText: "Save",
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
    url: "https://app.example.test/report?x=1",
    kind: "feedback",
    intent: "change",
    severity: "important",
    status: "pending",
    threadMessages: [],
    source: null,
    context: null,
    resolvedAt: null,
    resolvedBy: null,
    authorUserId: "u-lead",
    authorReportingGroupId: "g-1",
    authorRole: "lead",
    authorName: "Lead Snapshot",
    authorEmail: "lead@example.test",
    createdAt: now,
    updatedAt: now,
    session: {
      id: "s-1",
      url: "https://app.example.test/report",
      status: "active",
    },
    author: { name: "Mutable User", email: "mutable@example.test" },
    ...overrides,
  } as AgentationInboxRow;
}

describe("AgentationInboxRepository", () => {
  it("projects a complete stable FeedbackRecord using immutable annotation author snapshots", () => {
    const projected = projectAgentation(row());
    expect(projected).toMatchObject({
      id: agentationInboxId("a-1"),
      authorName: "Lead Snapshot",
      authorEmail: "lead@example.test",
      url: "/report",
      status: "open",
      agentationSessionId: "s-1",
      agentationAnnotationId: "a-1",
    });
    expect(projected.annotations).toHaveLength(1);
    expect(projected.annotations[0]?.feedbackId).toBe(projected.id);
  });

  it("applies head scope and URL filter before take and count", async () => {
    const findMany = vi.fn().mockResolvedValue([row()]);
    const count = vi.fn().mockResolvedValue(1);
    const prisma = {
      agentationAnnotation: { findMany, count },
    } as unknown as PrismaService;
    const page = await new AgentationInboxRepository(prisma).list(access, {
      url: "https://app.example.test/report",
      limit: 1,
    });
    expect(page.total).toBe(1);
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        AND: [
          {
            session: { projectId: "weekly-report" },
            OR: [{ authorUserId: "u-head" }, { authorReportingGroupId: "g-1" }],
          },
          { url: "/report" },
        ],
      },
      take: 1,
    });
    expect(count.mock.calls[0]?.[0]).toMatchObject({
      where: {
        AND: [
          {
            session: { projectId: "weekly-report" },
            OR: [{ authorUserId: "u-head" }, { authorReportingGroupId: "g-1" }],
          },
          { url: "/report" },
        ],
      },
    });
    expect(page.feedbacks[0]?.id).toBe("agentation_a-1");
  });

  it("updates status and emits an event atomically as the human actor", async () => {
    const changed = row({
      status: "resolved",
      resolvedAt: new Date(),
      resolvedBy: "human",
    });
    const tx = {
      agentationAnnotation: {
        findFirst: vi.fn().mockResolvedValue(row()),
        update: vi.fn().mockResolvedValue(changed),
      },
      agentationEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: vi.fn((callback: (value: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const result = await new AgentationInboxRepository(
      prisma,
    ).updateInboxStatus(access, "agentation_a-1", "resolved");
    expect(result.status).toBe("resolved");
    const findArgument = tx.agentationAnnotation.findFirst.mock
      .calls[0]?.[0] as unknown as {
      where: { id: string; session: { projectId: string } };
    };
    expect(findArgument.where).toMatchObject({
      id: "a-1",
      session: { projectId: "weekly-report" },
    });
    const updateArgument = tx.agentationAnnotation.update.mock
      .calls[0]?.[0] as unknown as {
      where: { id: string };
      data: { status: string; resolvedAt: unknown; resolvedBy: string };
    };
    expect(updateArgument.where.id).toBe("a-1");
    expect(updateArgument.data.status).toBe("resolved");
    expect(updateArgument.data.resolvedBy).toBe("human");
    expect(updateArgument.data.resolvedAt).toBeInstanceOf(Date);
    const eventArgument = tx.agentationEvent.create.mock
      .calls[0]?.[0] as unknown as {
      data: { type: string; authorUserId: string };
    };
    expect(eventArgument.data.type).toBe("annotation.updated");
    expect(eventArgument.data.authorUserId).toBe("u-head");
  });

  it("does not emit another event when a status retry changes nothing", async () => {
    const unchanged = row({
      status: "resolved",
      resolvedAt: new Date("2026-09-04T10:01:00.000Z"),
      resolvedBy: "human",
    });
    const tx = {
      agentationAnnotation: {
        findFirst: vi.fn().mockResolvedValue(unchanged),
        update: vi.fn(),
      },
      agentationEvent: { create: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn((callback: (value: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;

    const result = await new AgentationInboxRepository(
      prisma,
    ).updateInboxStatus(access, "agentation_a-1", "resolved");

    expect(result.status).toBe("resolved");
    expect(tx.agentationAnnotation.update).not.toHaveBeenCalled();
    expect(tx.agentationEvent.create).not.toHaveBeenCalled();
  });
});
