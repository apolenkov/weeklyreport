import type { UserSession } from "@customreport/shared";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { resolveSessionCookieName } from "../../lib/session-cookie";
import type { PrismaService } from "../prisma/prisma.service";
import { createRequireHeadGuard } from "./bull-board.module";

/**
 * The /admin/queues guard must re-check the deactivated/revoked state after the
 * role check, so a deactivated head loses queue admin immediately rather than
 * keeping it for the JWT TTL.
 */

const HEAD_ID = "a0000000-0000-4000-8000-0000000000d1";

const headSession: UserSession = {
  userId: HEAD_ID,
  email: "head@test.local",
  name: "Head One",
  role: "head",
  activeReportId: null,
  activeReportSectionId: null,
};

function makePrisma(isActive: boolean): PrismaService {
  return {
    user: { findUnique: () => Promise.resolve({ isActive }) },
  } as unknown as PrismaService;
}

function makeReq(token: string | undefined): Request {
  const cookieName = resolveSessionCookieName(process.env);
  return {
    cookies: token === undefined ? {} : { [cookieName]: token },
  } as unknown as Request;
}

function makeRes(): { res: Response; status: ReturnType<typeof vi.fn> } {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status } as unknown as Response, status };
}

describe("createRequireHeadGuard", () => {
  it("denies a deactivated head with 401 and does not call next", async () => {
    const next = vi.fn();
    const { res, status } = makeRes();

    await createRequireHeadGuard({
      verifySessionToken: () => headSession,
      prisma: makePrisma(false),
      sessionRevocation: { isRevoked: () => Promise.resolve(false) },
    })(makeReq("token"), res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("denies a revoked head with 401 via the fast path", async () => {
    const next = vi.fn();
    const { res, status } = makeRes();

    await createRequireHeadGuard({
      verifySessionToken: () => headSession,
      // An active DB row must not rescue a revoked head.
      prisma: makePrisma(true),
      sessionRevocation: { isRevoked: () => Promise.resolve(true) },
    })(makeReq("token"), res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("admits an active, non-revoked head", async () => {
    const next = vi.fn();
    const { res, status } = makeRes();

    await createRequireHeadGuard({
      verifySessionToken: () => headSession,
      prisma: makePrisma(true),
      sessionRevocation: { isRevoked: () => Promise.resolve(false) },
    })(makeReq("token"), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
  });

  it("rejects a non-head role with 403 before any deactivation check", async () => {
    const next = vi.fn();
    const { res, status } = makeRes();

    await createRequireHeadGuard({
      verifySessionToken: () => ({ ...headSession, role: "lead" }),
      prisma: makePrisma(true),
      sessionRevocation: { isRevoked: () => Promise.resolve(false) },
    })(makeReq("token"), res, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a missing cookie with 401", async () => {
    const next = vi.fn();
    const { res, status } = makeRes();

    await createRequireHeadGuard({
      verifySessionToken: () => headSession,
      prisma: makePrisma(true),
      sessionRevocation: { isRevoked: () => Promise.resolve(false) },
    })(makeReq(undefined), res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    {
      failure: "invalid token",
      verifySessionToken: () => {
        throw new Error("invalid token");
      },
      prisma: makePrisma(true),
    },
    {
      failure: "Prisma read",
      verifySessionToken: () => headSession,
      prisma: {
        user: {
          findUnique: () => Promise.reject(new Error("database unavailable")),
        },
      } as unknown as PrismaService,
    },
  ])("maps a thrown $failure to 401", async (deps) => {
    const next = vi.fn();
    const { res, status } = makeRes();

    await createRequireHeadGuard({
      verifySessionToken: deps.verifySessionToken,
      prisma: deps.prisma,
      sessionRevocation: { isRevoked: () => Promise.resolve(false) },
    })(makeReq("token"), res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
