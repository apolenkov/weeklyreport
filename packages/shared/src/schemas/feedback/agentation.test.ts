import { describe, expect, it } from "vitest";

import {
  AGENTATION_MAX_ACTION_OUTPUT_LENGTH,
  AGENTATION_MAX_ARRAY_LENGTH,
  AGENTATION_MAX_COORDINATE,
  AGENTATION_MAX_ID_LENGTH,
  AGENTATION_MAX_STRING_LENGTH,
  agentationActionSchema,
  agentationAnnotationCreateSchema,
  agentationAnnotationPatchSchema,
  agentationAnnotationResponseSchema,
  agentationPendingResponseSchema,
  agentationSessionCreateSchema,
  agentationSessionResponseSchema,
  agentationSseEventSchema,
  agentationThreadSchema,
  normalizeAgentationPath,
} from "./agentation";

const valid = {
  id: "annotation-1",
  x: 42,
  y: 120,
  comment: "Move this button below the heading",
  element: "Button",
  elementPath: "body > main > button",
  timestamp: 1_700_000_000_000,
  boundingBox: { x: 10, y: 20, width: 100, height: 40 },
  sourceFile: "src/button.tsx",
  drawingIndex: 0,
  elementBoundingBoxes: [{ x: 10, y: 20, width: 100, height: 40 }],
  kind: "feedback" as const,
  placement: {
    componentType: "Button",
    width: 100,
    height: 40,
    scrollY: 0,
    text: "Save",
  },
  rearrange: {
    selector: ".button",
    label: "Save",
    tagName: "BUTTON",
    originalRect: { x: 0, y: 0, width: 100, height: 40 },
    currentRect: { x: 10, y: 20, width: 100, height: 40 },
  },
};

describe("Agentation bounded wire contract", () => {
  it("accepts the complete v3 annotation shape", () => {
    expect(agentationAnnotationCreateSchema.parse(valid)).toMatchObject(valid);
  });

  it("requires the browser annotation id and bounds numeric limits", () => {
    expect(() =>
      agentationAnnotationCreateSchema.parse({ ...valid, id: undefined }),
    ).toThrow();
    expect(() =>
      agentationAnnotationCreateSchema.parse({ ...valid, x: 100.001 }),
    ).toThrow();
    expect(() =>
      agentationAnnotationCreateSchema.parse({
        ...valid,
        boundingBox: { ...valid.boundingBox, width: -1 },
      }),
    ).toThrow();
    expect(() =>
      agentationAnnotationCreateSchema.parse({
        ...valid,
        y: AGENTATION_MAX_COORDINATE + 1,
      }),
    ).toThrow();
  });

  it("strips server-authoritative and unsupported spoof fields", () => {
    const parsed = agentationAnnotationCreateSchema.parse({
      ...valid,
      sessionId: "spoof-session",
      authorId: "spoof-author",
      status: "resolved",
      resolvedBy: "agent",
      role: "agent",
      source: { secret: "ignored" },
      context: { huge: "ignored" },
      projectId: "ignored",
    });
    expect(parsed).not.toHaveProperty("sessionId");
    expect(parsed).not.toHaveProperty("authorId");
    expect(parsed).not.toHaveProperty("status");
    expect(parsed).not.toHaveProperty("source");
  });

  it("bounds strings and arrays", () => {
    expect(() =>
      agentationAnnotationCreateSchema.parse({
        ...valid,
        element: "x".repeat(AGENTATION_MAX_STRING_LENGTH + 1),
      }),
    ).toThrow();
    expect(() =>
      agentationAnnotationCreateSchema.parse({
        ...valid,
        elementBoundingBoxes: Array.from(
          { length: AGENTATION_MAX_ARRAY_LENGTH + 1 },
          () => valid.boundingBox,
        ),
      }),
    ).toThrow();
    expect(() =>
      agentationAnnotationCreateSchema.parse({
        ...valid,
        id: "x".repeat(AGENTATION_MAX_ID_LENGTH + 1),
      }),
    ).toThrow();
  });

  it("strips session extras and normalizes URL to pathname", () => {
    expect(
      agentationSessionCreateSchema.parse({
        url: "https://weeklyreport.test/lead?a=1",
        clientId: "spoof",
        projectId: "p",
        metadata: {},
      }),
    ).toEqual({ url: "https://weeklyreport.test/lead?a=1" });
    expect(
      normalizeAgentationPath("https://weeklyreport.test/lead?a=1#x"),
    ).toBe("/lead");
    expect(normalizeAgentationPath("/head/report?token=secret#item")).toBe(
      "/head/report",
    );
  });

  it("bounds patch, thread, and action payloads", () => {
    expect(
      agentationAnnotationPatchSchema.parse({
        status: "resolved",
        role: "agent",
        resolvedBy: "agent",
      }),
    ).toEqual({ status: "resolved" });
    expect(
      agentationThreadSchema.parse({ content: "Done", role: "agent" }),
    ).toEqual({ content: "Done" });
    expect(
      agentationActionSchema.parse({
        output: "x".repeat(AGENTATION_MAX_ACTION_OUTPUT_LENGTH),
      }),
    ).toHaveProperty("output");
    expect(() =>
      agentationActionSchema.parse({
        output: "x".repeat(AGENTATION_MAX_ACTION_OUTPUT_LENGTH + 1),
      }),
    ).toThrow();
  });

  it("accepts bounded adapter response and SSE envelopes", () => {
    const annotation = {
      ...valid,
      clientId: valid.id,
      sessionId: "session-1",
      status: "pending" as const,
      thread: [],
      createdAt: "2026-09-04T10:00:00.000Z",
      updatedAt: "2026-09-04T10:00:00.000Z",
      authorId: "user-1",
    };
    expect(agentationAnnotationResponseSchema.parse(annotation)).toMatchObject(
      annotation,
    );
    for (const resolvedBy of ["human", "agent"])
      expect(
        agentationAnnotationResponseSchema.parse({ ...annotation, resolvedBy }),
      ).toHaveProperty("resolvedBy", resolvedBy);
    expect(
      agentationAnnotationResponseSchema.safeParse({
        ...annotation,
        resolvedBy: "arbitrary-name",
      }).success,
    ).toBe(false);
    const session = {
      id: "session-1",
      url: "https://weeklyreport.test/lead",
      status: "active" as const,
      projectId: "weekly-report",
      createdAt: annotation.createdAt,
      updatedAt: annotation.updatedAt,
      annotations: [annotation],
    };
    expect(agentationSessionResponseSchema.parse(session)).toMatchObject(
      session,
    );
    expect(
      agentationPendingResponseSchema.parse({
        count: 1,
        annotations: [annotation],
      }),
    ).toMatchObject({ count: 1 });
    expect(
      agentationSseEventSchema.parse({
        sequence: 1,
        type: "annotation.created",
        sessionId: session.id,
        timestamp: annotation.createdAt,
        payload: annotation,
      }),
    ).toMatchObject({ type: "annotation.created", sequence: 1 });
  });
});
