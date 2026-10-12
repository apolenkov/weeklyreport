import { randomUUID } from "node:crypto";

import {
  type AgentationAnnotationCreate,
  agentationAnnotationResponseSchema,
  agentationSessionResponseSchema,
  FEEDBACK_DISMISSAL_PREFIX,
  type UserSession,
} from "@weeklyreport/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startAgentationContractServer } from "../../test-utils/agentation-contract-server";

const ORIGINAL_AND_CAPTURE_SELECT = {
  clientId: true,
  sessionId: true,
  x: true,
  y: true,
  comment: true,
  element: true,
  elementPath: true,
  timestamp: true,
  selectedText: true,
  boundingBox: true,
  nearbyText: true,
  cssClasses: true,
  nearbyElements: true,
  computedStyles: true,
  fullPath: true,
  accessibility: true,
  isMultiSelect: true,
  isFixed: true,
  reactComponents: true,
  sourceFile: true,
  drawingIndex: true,
  elementBoundingBoxes: true,
  placement: true,
  rearrange: true,
  kind: true,
  intent: true,
  severity: true,
  url: true,
  authorUserId: true,
  authorReportingGroupId: true,
  authorRole: true,
  authorName: true,
  authorEmail: true,
  createdAt: true,
} as const;

describe("Agentation rich-context feedback acceptance", () => {
  let server: Awaited<ReturnType<typeof startAgentationContractServer>>;
  let closeServer: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    server = await startAgentationContractServer();
    closeServer = server.close;
  });

  afterAll(async () => {
    await closeServer?.();
  });

  function actor(index: number): UserSession {
    const value = server.actors[index];
    if (!value) throw new Error(`Missing contract-test actor ${index}`);
    return value;
  }

  async function expectStatus(
    response: Response,
    expected: number,
  ): Promise<void> {
    if (response.status === expected) return;
    throw new Error(
      `Expected HTTP ${expected}, received ${response.status}: ${await response.text()}`,
    );
  }

  async function createSession(author: UserSession) {
    const response = await server.request(
      "/agentation/sessions",
      author,
      "POST",
      {
        url: `http://localhost:3000/feedback-acceptance/${randomUUID()}?secret=discard#fragment`,
      },
    );
    await expectStatus(response, 201);
    return agentationSessionResponseSchema.parse(await response.json());
  }

  async function createAnnotation(
    author: UserSession,
    sessionId: string,
    input: AgentationAnnotationCreate,
  ) {
    const response = await server.request(
      `/agentation/sessions/${sessionId}/annotations`,
      author,
      "POST",
      input,
    );
    await expectStatus(response, 201);
    return agentationAnnotationResponseSchema.parse(await response.json());
  }

  function richInputs(): AgentationAnnotationCreate[] {
    const context = {
      x: 41.25,
      y: 932.5,
      comment: "Rich captured context",
      element: "section",
      elementPath: "main > section:nth-child(2)",
      timestamp: Date.now(),
      selectedText: "Selected report text",
      boundingBox: { x: 120, y: 800, width: 640, height: 360 },
      nearbyText: "Nearby report context",
      cssClasses: "report-card highlighted",
      nearbyElements: "heading, paragraph, button",
      computedStyles: "display:grid;gap:16px",
      fullPath: "html > body > main > section:nth-child(2)",
      accessibility: "region: Weekly report summary",
      isMultiSelect: true,
      isFixed: false,
      reactComponents: "ReportPage > ReportCard",
      sourceFile: "apps/web/src/features/report/ReportCard.tsx",
      drawingIndex: 2,
      elementBoundingBoxes: [
        { x: 120, y: 800, width: 300, height: 160 },
        { x: 440, y: 800, width: 320, height: 160 },
      ],
      intent: "change" as const,
      severity: "important" as const,
    };
    return [
      {
        ...context,
        id: randomUUID(),
        kind: "placement",
        placement: {
          componentType: "ReportCard",
          width: 640,
          height: 360,
          scrollY: 720,
          text: "Place below the summary",
        },
      },
      {
        ...context,
        id: randomUUID(),
        kind: "rearrange",
        rearrange: {
          selector: "[data-report-card='risks']",
          label: "Risks",
          tagName: "SECTION",
          originalRect: { x: 120, y: 800, width: 640, height: 360 },
          currentRect: { x: 120, y: 420, width: 640, height: 360 },
        },
      },
    ];
  }

  it("persists and rereads exact placement and rearrange captures within the author scope", async () => {
    const author = actor(0);
    const foreignLead = actor(1);
    const session = await createSession(author);

    for (const input of richInputs()) {
      const created = await createAnnotation(author, session.id, input);
      const rereadResponse = await server.request(
        `/agentation/annotations/${created.id}`,
        author,
      );
      await expectStatus(rereadResponse, 200);
      const reread = agentationAnnotationResponseSchema.parse(
        await rereadResponse.json(),
      );
      const { id: clientId, ...expectedCapture } = input;

      expect(reread).toMatchObject({
        ...expectedCapture,
        id: created.id,
        clientId,
        sessionId: session.id,
        authorId: author.userId,
      });
      expect(
        await server.prisma.agentationAnnotation.findUniqueOrThrow({
          where: { id: created.id },
          select: {
            placement: true,
            rearrange: true,
            boundingBox: true,
            elementBoundingBoxes: true,
          },
        }),
      ).toEqual({
        placement: input.placement ?? null,
        rearrange: input.rearrange ?? null,
        boundingBox: input.boundingBox,
        elementBoundingBoxes: input.elementBoundingBoxes,
      });
      await expectStatus(
        await server.request(
          `/agentation/annotations/${created.id}`,
          foreignLead,
        ),
        404,
      );
    }
  });

  it("appends a reviewer reply with server-owned actor and timestamp without changing the original capture", async () => {
    const author = actor(0);
    const reviewer = actor(2);
    const session = await createSession(author);
    const input = richInputs()[0];
    if (!input) throw new Error("Missing rich annotation fixture");
    const annotation = await createAnnotation(author, session.id, input);
    const before = await server.prisma.agentationAnnotation.findUniqueOrThrow({
      where: { id: annotation.id },
      select: ORIGINAL_AND_CAPTURE_SELECT,
    });
    const startedAt = Date.now();

    const response = await server.request(
      `/feedback/agentation_${annotation.id}/replies`,
      reviewer,
      "POST",
      { content: "Reviewer reply" },
    );
    await expectStatus(response, 200);
    const completedAt = Date.now();
    const after = await server.prisma.agentationAnnotation.findUniqueOrThrow({
      where: { id: annotation.id },
      select: {
        ...ORIGINAL_AND_CAPTURE_SELECT,
        threadMessages: true,
      },
    });
    const { threadMessages, ...unchanged } = after;

    expect(unchanged).toEqual(before);
    expect(threadMessages).toHaveLength(1);
    expect(threadMessages[0]).toMatchObject({
      role: "human",
      content: "Reviewer reply",
      authorUserId: reviewer.userId,
    });
    expect(Number(threadMessages[0]?.timestamp)).toBeGreaterThanOrEqual(
      startedAt,
    );
    expect(Number(threadMessages[0]?.timestamp)).toBeLessThanOrEqual(
      completedAt,
    );
  });

  it("dismisses non-destructively while retaining evidence and an unrelated legacy sentinel", async () => {
    const author = actor(0);
    const reviewer = actor(2);
    const session = await createSession(author);
    const input = richInputs()[1];
    if (!input) throw new Error("Missing rich annotation fixture");
    const annotation = await createAnnotation(author, session.id, input);
    const initialThreadResponse = await server.request(
      `/agentation/annotations/${annotation.id}/thread`,
      author,
      "POST",
      { content: "Original author follow-up" },
    );
    await expectStatus(initialThreadResponse, 201);
    const before = await server.prisma.agentationAnnotation.findUniqueOrThrow({
      where: { id: annotation.id },
      select: {
        ...ORIGINAL_AND_CAPTURE_SELECT,
        threadMessages: { orderBy: { timestamp: "asc" } },
      },
    });
    const legacyClientId = `legacy-sentinel-${randomUUID()}`;
    const legacy = await server.prisma.productFeedback.create({
      data: {
        projectName: "weekly-report",
        type: "other",
        message: "Unrelated legacy sentinel",
        status: "open",
        url: "/legacy-sentinel",
        viewport: "1x1",
        userAgent: "feedback-acceptance-test",
        authorUserId: reviewer.userId,
        authorName: reviewer.name,
        authorEmail: reviewer.email,
        authorReportingGroupId: null,
        clientId: legacyClientId,
      },
    });

    try {
      const cursor = await server.prisma.agentationEvent.aggregate({
        where: { sessionId: session.id },
        _max: { sequence: true },
      });
      const reason = "Superseded by an approved workflow";
      const response = await server.request(
        `/feedback/agentation_${annotation.id}/dismiss`,
        reviewer,
        "POST",
        { reason },
      );
      await expectStatus(response, 200);

      const after = await server.prisma.agentationAnnotation.findUniqueOrThrow({
        where: { id: annotation.id },
        select: {
          ...ORIGINAL_AND_CAPTURE_SELECT,
          status: true,
          resolvedAt: true,
          resolvedBy: true,
          threadMessages: { orderBy: { timestamp: "asc" } },
        },
      });
      const { status, resolvedAt, resolvedBy, threadMessages, ...unchanged } =
        after;
      const { threadMessages: originalThread, ...originalAndCapture } = before;
      const dismissalMessage = threadMessages.find(
        (message) =>
          message.content === `${FEEDBACK_DISMISSAL_PREFIX}${reason}`,
      );

      expect(unchanged).toEqual(originalAndCapture);
      expect(status).toBe("dismissed");
      expect(resolvedAt).toBeInstanceOf(Date);
      expect(resolvedBy).toBe("human");
      expect(threadMessages).toEqual(expect.arrayContaining(originalThread));
      expect(dismissalMessage).toMatchObject({
        role: "human",
        authorUserId: reviewer.userId,
      });
      expect(
        await server.prisma.productFeedback.findUniqueOrThrow({
          where: { clientId: legacyClientId },
        }),
      ).toEqual(legacy);

      const events = await server.prisma.agentationEvent.findMany({
        where: {
          annotationId: annotation.id,
          sequence: { gt: cursor._max.sequence ?? BigInt(0) },
        },
        orderBy: { sequence: "asc" },
      });
      expect(
        events.map(({ type, authorUserId }) => ({ type, authorUserId })),
      ).toEqual([
        { type: "thread.message", authorUserId: reviewer.userId },
        { type: "annotation.updated", authorUserId: reviewer.userId },
      ]);
      expect(events[0]?.payload).toMatchObject({
        content: `${FEEDBACK_DISMISSAL_PREFIX}${reason}`,
        authorUserId: reviewer.userId,
      });
      expect(events[1]?.payload).toMatchObject({
        id: annotation.id,
        status: "dismissed",
      });
    } finally {
      await server.prisma.productFeedback.deleteMany({
        where: { clientId: legacyClientId },
      });
    }
  });

  it("keeps the annotation evidence and legacy data when public DELETE dismisses it", async () => {
    const author = actor(0);
    const session = await createSession(author);
    const input = richInputs()[0];
    if (!input) throw new Error("Missing rich annotation fixture");
    const annotation = await createAnnotation(author, session.id, input);
    const initialThreadResponse = await server.request(
      `/agentation/annotations/${annotation.id}/thread`,
      author,
      "POST",
      { content: "Evidence retained across public DELETE" },
    );
    await expectStatus(initialThreadResponse, 201);
    const before = await server.prisma.agentationAnnotation.findUniqueOrThrow({
      where: { id: annotation.id },
      select: {
        ...ORIGINAL_AND_CAPTURE_SELECT,
        threadMessages: { orderBy: { timestamp: "asc" } },
      },
    });
    const legacyClientId = `legacy-public-delete-${randomUUID()}`;
    const legacy = await server.prisma.productFeedback.create({
      data: {
        projectName: "weekly-report",
        type: "other",
        message: "Public DELETE legacy sentinel",
        status: "open",
        url: "/legacy-public-delete",
        viewport: "1x1",
        userAgent: "feedback-acceptance-test",
        authorUserId: author.userId,
        authorName: author.name,
        authorEmail: author.email,
        authorReportingGroupId: null,
        clientId: legacyClientId,
      },
    });

    try {
      const deleteResponse = await server.request(
        `/agentation/annotations/${annotation.id}`,
        author,
        "DELETE",
      );
      await expectStatus(deleteResponse, 200);
      expect(await deleteResponse.json()).toEqual({
        deleted: true,
        annotationId: annotation.id,
      });

      const rereadResponse = await server.request(
        `/agentation/annotations/${annotation.id}`,
        author,
      );
      await expectStatus(rereadResponse, 200);
      expect(
        agentationAnnotationResponseSchema.parse(await rereadResponse.json()),
      ).toMatchObject({ id: annotation.id, status: "dismissed" });

      const after = await server.prisma.agentationAnnotation.findUniqueOrThrow({
        where: { id: annotation.id },
        select: {
          ...ORIGINAL_AND_CAPTURE_SELECT,
          status: true,
          resolvedAt: true,
          resolvedBy: true,
          threadMessages: { orderBy: { timestamp: "asc" } },
        },
      });
      const { status, resolvedAt, resolvedBy, ...retained } = after;

      expect(retained).toEqual(before);
      expect(status).toBe("dismissed");
      expect(resolvedAt).toBeInstanceOf(Date);
      expect(resolvedBy).toBe("human");
      expect(
        await server.prisma.productFeedback.findUniqueOrThrow({
          where: { clientId: legacyClientId },
        }),
      ).toEqual(legacy);
    } finally {
      await server.prisma.productFeedback.deleteMany({
        where: { clientId: legacyClientId },
      });
    }
  });
});
