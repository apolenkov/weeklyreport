import type { UserSession } from "@customreport/shared";
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
      prisma,
      {} as AppLogger,
    );

    expect(handled).toBe(true);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: "dismiss_reason_required" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
