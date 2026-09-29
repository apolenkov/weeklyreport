import { AUTH_COOKIE_NAME, type UserSession } from "@customreport/shared";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../prisma/prisma.service";
import { createRequireHeadGuard } from "./bull-board.module";

// The guard must re-check deactivated/revoked state after the role check, so a
// deactivated head loses queue admin immediately rather than keeping it for the
// JWT TTL.

const HEAD_ID = "a0000000-0000-4000-8000-0000000000d1";

const headSession: UserSession = {
  userId: HEAD_ID,
  email: "head@test.local",
  name: "Head One",
  role: "head",
  activeReportId: null,
  activeReportSectionId: null,
};

function makePrisma(isActive: boolean, role = "head"): PrismaService {
  return {
    user: {
      findUnique: () =>
        Promise.resolve({ isActive, role, reportingGroupId: null }),
    },
  } as unknown as PrismaService;
}

function makeReq(token: string | undefined): Request {
  return {
    cookies: token === undefined ? {} : { [AUTH_COOKIE_NAME]: token },
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
      sessionCookieName: AUTH_COOKIE_NAME,
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
      sessionCookieName: AUTH_COOKIE_NAME,
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
      sessionCookieName: AUTH_COOKIE_NAME,
    })(makeReq("token"), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
  });

  it("rejects a head token whose database role was demoted with 403", async () => {
    const next = vi.fn();
    const { res, status } = makeRes();

    await createRequireHeadGuard({
      verifySessionToken: () => headSession,
      prisma: makePrisma(true, "lead"),
      sessionRevocation: { isRevoked: () => Promise.resolve(false) },
      sessionCookieName: AUTH_COOKIE_NAME,
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
      sessionCookieName: AUTH_COOKIE_NAME,
    })(makeReq(undefined), res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("maps a token-verification failure to 401 (invalid session)", async () => {
    const next = vi.fn();
    const { res, status } = makeRes();

    await createRequireHeadGuard({
      verifySessionToken: () => {
        throw new Error("invalid token");
      },
      prisma: makePrisma(true),
      sessionRevocation: { isRevoked: () => Promise.resolve(false) },
      sessionCookieName: AUTH_COOKIE_NAME,
    })(makeReq("token"), res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("propagates an auth-dependency read failure instead of mapping it to 401", async () => {
    const next = vi.fn();
    const { res, status } = makeRes();
    const databaseError = new Error("database unavailable");

    await expect(
      createRequireHeadGuard({
        verifySessionToken: () => headSession,
        prisma: {
          user: {
            findUnique: () => Promise.reject(databaseError),
          },
        } as unknown as PrismaService,
        sessionRevocation: { isRevoked: () => Promise.resolve(false) },
        sessionCookieName: AUTH_COOKIE_NAME,
      })(makeReq("token"), res, next),
    ).rejects.toBe(databaseError);

    expect(status).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
