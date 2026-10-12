import type { UserSession } from "@weeklyreport/shared";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { AppLogger } from "../../lib/logger.js";
import {
  executeAgentationRequest,
  normalizeAgentationPath,
} from "./agentation-wire.js";

describe("Agentation wire contract", () => {
  it("stores only the pathname and drops query/hash", () => {
    expect(
      normalizeAgentationPath("https://weeklyreport.test/lead?x=1#feedback"),
    ).toBe("/lead");
  });

  it("keeps a root pathname for an origin URL", () => {
    expect(normalizeAgentationPath("https://weeklyreport.test")).toBe("/");
  });

  it("rejects a reasonless human PATCH dismissal before repository writes", async () => {
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const prisma = { $transaction: vi.fn() } as unknown as PrismaService;
    const session: UserSession = {
      userId: "head-1",
      email: "head@example.test",
      name: "Head",
      role: "head",
      reportingGroupId: "group-a",
    };
    const handled = await executeAgentationRequest(
      {
        method: "PATCH",
        path: "/agentation/annotations/annotation-1",
        body: { status: "dismissed" },
        query: {},
      } as Request,
      {
        setHeader: vi.fn(),
        status,
        json,
      } as unknown as Response,
      session,
      { prisma, logger: {} as AppLogger },
    );

    expect(handled).toBe(true);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: "dismiss_reason_required" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it.each([
    { role: "head" as const, actor: "human" as const },
    { role: "admin" as const, actor: "human" as const },
    { role: "admin" as const, actor: "agent" as const },
  ])(
    "preserves author-only original patches for $role/$actor",
    async ({ role, actor }) => {
      const annotation = {
        id: "annotation-1",
        sessionId: "session-1",
        clientId: "client-1",
        authorUserId: "author-1",
        authorRole: "lead",
        authorName: "Author",
        authorEmail: "author@example.test",
        kind: "feedback",
        comment: "Original",
        intent: null,
        severity: null,
        status: "pending",
        threadMessages: [],
        timestamp: 1n,
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: null,
        resolvedBy: null,
      };
      const update = vi.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...annotation, ...data }),
      );
      const event = vi.fn().mockResolvedValue({});
      const db = {
        agentationAnnotation: {
          findFirst: vi.fn(({ where }: { where: { authorUserId?: string } }) =>
            Promise.resolve(
              where.authorUserId === undefined ||
                where.authorUserId === annotation.authorUserId
                ? annotation
                : null,
            ),
          ),
          update,
        },
        agentationEvent: { create: event },
      };
      const prisma = {
        $transaction: (callback: (value: typeof db) => Promise<unknown>) =>
          callback(db),
      } as unknown as PrismaService;
      const reviewer: UserSession = {
        userId: "reviewer-1",
        email: "reviewer@example.test",
        name: "Reviewer",
        role,
        reportingGroupId: "group-a",
      };
      const request = async (
        body: Record<string, string>,
        session = reviewer,
      ) => {
        const status = vi.fn().mockReturnThis();
        await executeAgentationRequest(
          {
            method: "PATCH",
            path: "/agentation/annotations/annotation-1",
            body,
            query: {},
          } as Request,
          { setHeader: vi.fn(), status, json: vi.fn() } as unknown as Response,
          session,
          { prisma, logger: {} as AppLogger, options: actor },
        );
        return status;
      };

      for (const patch of [
        { kind: "placement" },
        { severity: "blocking" },
        { status: "acknowledged", kind: "placement" },
      ]) {
        expect(await request(patch)).toHaveBeenCalledWith(404);
      }
      expect(update).not.toHaveBeenCalled();
      expect(event).not.toHaveBeenCalled();

      expect(await request({ status: "acknowledged" })).toHaveBeenCalledWith(
        200,
      );
      expect(update).toHaveBeenCalledOnce();
      expect(event).toHaveBeenCalledOnce();
      update.mockClear();
      event.mockClear();
      expect(
        await request(
          { kind: "placement", severity: "blocking" },
          { ...reviewer, userId: "author-1" },
        ),
      ).toHaveBeenCalledWith(200);
      expect(update).toHaveBeenCalledOnce();
      expect(event).toHaveBeenCalledOnce();
    },
  );
});
