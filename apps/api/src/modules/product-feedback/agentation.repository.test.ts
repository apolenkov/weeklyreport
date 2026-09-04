import type { AgentationAnnotationCreate } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AgentationPrismaRepository } from "./agentation.repository";
import type { FeedbackAccess } from "./product-feedback.repository";

const leadA: FeedbackAccess = {
  userId: "lead-a",
  role: "lead",
  name: "Lead A",
  email: "lead-a@example.test",
  reportingGroupId: "group-a",
};
const leadB: FeedbackAccess = {
  userId: "lead-b",
  role: "lead",
  name: "Lead B",
  email: "lead-b@example.test",
  reportingGroupId: "group-b",
};

const annotationInput: AgentationAnnotationCreate = {
  id: "client-annotation-1",
  x: 10,
  y: 20,
  comment: "Move this button",
  element: "button",
  elementPath: "main > button",
  timestamp: 1_700_000_000_000,
  kind: "placement",
  placement: {
    componentType: "Button",
    width: 100,
    height: 40,
    scrollY: 0,
    text: "Save",
  },
  rearrange: {
    selector: ".save",
    label: "Save",
    tagName: "BUTTON",
    originalRect: { x: 0, y: 0, width: 100, height: 40 },
    currentRect: { x: 10, y: 20, width: 100, height: 40 },
  },
};

function annotationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "annotation-1",
    clientId: annotationInput.id,
    sessionId: "session-1",
    x: annotationInput.x,
    y: annotationInput.y,
    comment: annotationInput.comment,
    element: annotationInput.element,
    elementPath: annotationInput.elementPath,
    timestamp: BigInt(annotationInput.timestamp),
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
    placement: annotationInput.placement,
    rearrange: annotationInput.rearrange,
    url: "/report",
    kind: "placement",
    intent: null,
    severity: null,
    status: "pending",
    threadMessages: [],
    authorUserId: leadA.userId,
    authorReportingGroupId: leadA.reportingGroupId,
    authorRole: leadA.role,
    authorName: leadA.name,
    authorEmail: leadA.email,
    createdAt: new Date("2026-09-04T10:00:00.000Z"),
    updatedAt: new Date("2026-09-04T10:00:00.000Z"),
    resolvedAt: null,
    resolvedBy: null,
    ...overrides,
  };
}

function sessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    url: "/report",
    projectId: "weekly-report",
    metadata: null,
    status: "active",
    createdAt: new Date("2026-09-04T10:00:00.000Z"),
    updatedAt: new Date("2026-09-04T10:00:00.000Z"),
    annotations: [],
    ...overrides,
  };
}

function transactionPrisma(tx: Record<string, unknown>): PrismaService {
  return {
    $transaction: vi.fn((callback: (value: unknown) => unknown) =>
      callback(tx),
    ),
  } as unknown as PrismaService;
}

describe("AgentationPrismaRepository", () => {
  it("persists placement and rearrange payloads with the annotation", async () => {
    const created = annotationRow();
    const upsert = vi.fn().mockResolvedValue(created);
    const tx = {
      agentationSession: {
        findFirst: vi.fn().mockResolvedValue(sessionRow()),
      },
      agentationAnnotation: { upsert },
      agentationEvent: { create: vi.fn().mockResolvedValue({}) },
    };

    const result = await new AgentationPrismaRepository(
      transactionPrisma(tx),
    ).addAnnotation(leadA, "session-1", annotationInput);

    expect(result).toMatchObject({
      kind: "placement",
      placement: annotationInput.placement,
      rearrange: annotationInput.rearrange,
    });
    expect(upsert).toHaveBeenCalled();
  });

  it("appends thread messages and audits an agent action", async () => {
    const current = annotationRow();
    const threadMessage = {
      id: "thread-1",
      role: "agent",
      content: "Implemented",
      timestamp: 1_700_000_000_001n,
    };
    const withThread = annotationRow({ threadMessages: [threadMessage] });
    const eventCreate = vi.fn().mockResolvedValue({});
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "annotation-1" }]),
      agentationAnnotation: {
        findFirst: vi.fn().mockResolvedValue(current),
        findUnique: vi.fn().mockResolvedValue(withThread),
      },
      agentationThreadMessage: {
        create: vi.fn().mockResolvedValue(threadMessage),
      },
      agentationSession: {
        findFirst: vi
          .fn()
          .mockResolvedValue(sessionRow({ annotations: [current] })),
      },
      agentationEvent: { create: eventCreate },
    };
    const repository = new AgentationPrismaRepository(transactionPrisma(tx));

    const replied = await repository.addThreadMessage(
      leadA,
      "annotation-1",
      { content: "Implemented" },
      "agent",
    );
    const count = await repository.action(
      leadA,
      "session-1",
      { output: "Review these annotations" },
      "agent",
    );

    expect(replied?.thread).toEqual([
      expect.objectContaining({ role: "agent", content: "Implemented" }),
    ]);
    expect(count).toBe(1);
    expect(eventCreate).toHaveBeenCalledTimes(2);
    expect(eventCreate.mock.calls[0]?.[0]).toMatchObject({
      data: { type: "thread.message", annotationId: "annotation-1" },
    });
    expect(eventCreate.mock.calls[1]?.[0]).toMatchObject({
      data: { type: "action.requested", sessionId: "session-1" },
    });
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.agentationThreadMessage.create.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("applies immutable user and reporting-group scope to reads", async () => {
    const findSessions = vi.fn().mockResolvedValue([]);
    const findPending = vi.fn().mockResolvedValue([]);
    const prisma = {
      agentationSession: { findMany: findSessions },
      agentationAnnotation: { findMany: findPending },
    } as unknown as PrismaService;
    const repository = new AgentationPrismaRepository(prisma);

    await repository.listSessions(leadA);
    await repository.pending(leadB);

    expect(findSessions.mock.calls[0]?.[0]).toMatchObject({
      where: {
        projectId: "weekly-report",
        authorUserId: "lead-a",
      },
    });
    expect(findPending.mock.calls[0]?.[0]).toMatchObject({
      where: {
        status: "pending",
        session: { projectId: "weekly-report" },
        authorUserId: "lead-b",
      },
    });
    expect(findSessions.mock.calls[0]?.[0]).not.toMatchObject({
      where: { authorReportingGroupId: "group-b" },
    });
  });

  it("uses group scope for a head without exposing another group", async () => {
    const findPending = vi.fn().mockResolvedValue([]);
    const prisma = {
      agentationAnnotation: { findMany: findPending },
    } as unknown as PrismaService;
    const headA: FeedbackAccess = { ...leadA, role: "head" };

    await new AgentationPrismaRepository(prisma).pending(headA);

    expect(findPending.mock.calls[0]?.[0]).toMatchObject({
      where: {
        session: { projectId: "weekly-report" },
        OR: [{ authorUserId: "lead-a" }, { authorReportingGroupId: "group-a" }],
      },
    });
    expect(findPending.mock.calls[0]?.[0]).not.toMatchObject({
      where: { authorReportingGroupId: "group-b" },
    });
  });
});
