import type { UserSession } from "@customreport/shared";
import type { INestApplication } from "@nestjs/common";
import type { Request } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../lib/logger";
import {
  clearOrgCache,
  createContextFactory,
  type HumanSessionDeps,
  resolveHumanSession,
} from "./trpc.context";

/**
 * Contract tests for the four dev-mode flag combinations.
 *
 * These tests exercise `createContextFactory` directly with a mocked INestApp
 * and a fake express Request — no real Postgres, no real Prisma. The goal is
 * to assert ONLY the dev-mode branch logic; downstream integration tests
 * verify the cookie path against a live database.
 */

interface MockNestApp {
  get: () => unknown;
}

function makePrismaStub() {
  return {
    reportSection: {
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements async Prisma findFirst contract (no awaitable work in the stub)
      findFirst: vi.fn(async () => null),
    },
    // Context factory hydrates `session.organization` from the singleton
    // Organization row. The stub returns the seeded
    // defaults so the dev-session branches resolve without touching a real
    // database.
    organization: {
      findUnique: vi.fn(() =>
        Promise.resolve({
          shortName: "PEO",
          fullName: "Product Engineering & Operations",
        }),
      ),
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements async Prisma upsert contract (no awaitable work in the stub)
      upsert: vi.fn(async () => ({
        shortName: "PEO",
        fullName: "Product Engineering & Operations",
      })),
    },
  };
}

function makeApp(prisma: ReturnType<typeof makePrismaStub>): INestApplication {
  const app: MockNestApp = {
    get: () => prisma,
  };
  return app as unknown as INestApplication;
}

function makeReq(cookieToken?: string): { req: Request } {
  const req = {
    headers: {},
    cookies: cookieToken ? { customreport_session: cookieToken } : {},
  } as unknown as Request;
  return { req };
}

function makeReqWithRequestId(requestId: string): { req: Request } {
  const req = {
    headers: { "x-request-id": requestId },
    cookies: {},
  } as unknown as Request;
  return { req };
}

const HUMAN_SESSION: UserSession = {
  userId: "user-1",
  email: "user@example.com",
  name: "Test User",
  role: "head",
  activeReportId: "report-1",
  activeReportSectionId: null,
};

function makeHumanSessionDeps(prisma: unknown): HumanSessionDeps {
  return {
    verifySessionToken: vi.fn(() => HUMAN_SESSION),
    sessionRevocation: {
      isRevoked: vi.fn(() => Promise.resolve(false)),
    },
    prisma: prisma as HumanSessionDeps["prisma"],
  };
}

describe("resolveHumanSession", () => {
  it("resolves to null when token verification throws", async () => {
    const verificationError = new Error("token verification failed");
    const deps = {
      ...makeHumanSessionDeps({}),
      verifySessionToken: vi.fn(() => {
        throw verificationError;
      }),
    };

    await expect(
      resolveHumanSession("invalid-token", deps),
    ).resolves.toBeNull();
  });

  it("propagates hydration errors", async () => {
    const hydrationError = new Error("section lookup failed");
    const prisma = {
      user: {
        findUnique: vi.fn(() => Promise.resolve({ isActive: true })),
      },
      reportSection: {
        findFirst: vi.fn(() => Promise.reject(hydrationError)),
      },
    };

    await expect(
      resolveHumanSession("valid-token", makeHumanSessionDeps(prisma)),
    ).rejects.toBe(hydrationError);
  });

  it("propagates access-bar check errors", async () => {
    const accessError = new Error("user lookup failed");
    const prisma = {
      user: {
        findUnique: vi.fn(() => Promise.reject(accessError)),
      },
    };

    await expect(
      resolveHumanSession("valid-token", makeHumanSessionDeps(prisma)),
    ).rejects.toBe(accessError);
  });
});

describe("createContextFactory — dev-mode flag matrix", () => {
  const ORIGINAL_AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET;

  beforeEach(() => {
    // createAuthController(env) reads AUTH_JWT_SECRET at factory creation.
    // Stub a stable test secret so the factory can construct without throwing.
    vi.stubEnv("AUTH_JWT_SECRET", "integration-test-secret-32-chars-or-more");
    // D5: reset the module-level orgCache (5s TTL) so assertions in each
    // case are not order-dependent on cache state from a prior case.
    clearOrgCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (ORIGINAL_AUTH_JWT_SECRET !== undefined) {
      process.env.AUTH_JWT_SECRET = ORIGINAL_AUTH_JWT_SECRET;
    }
  });

  it("AUTH_DEV_MODE=false + AUTH_DEV_MODE_ALLOW_TEST=false + no cookie → session null", async () => {
    vi.stubEnv("AUTH_DEV_MODE", "false");
    vi.stubEnv("AUTH_DEV_MODE_ALLOW_TEST", "false");

    const factory = createContextFactory(
      makeApp(makePrismaStub()),
      createNullLogger(),
    );
    const ctx = await factory(makeReq() as never);

    expect(ctx.session).toBeNull();
  });

  it("AUTH_DEV_MODE=false + AUTH_DEV_MODE_ALLOW_TEST=true + no cookie → DEV_SESSION", async () => {
    vi.stubEnv("AUTH_DEV_MODE", "false");
    vi.stubEnv("AUTH_DEV_MODE_ALLOW_TEST", "true");

    const factory = createContextFactory(
      makeApp(makePrismaStub()),
      createNullLogger(),
    );
    const ctx = await factory(makeReq() as never);

    expect(ctx.session).not.toBeNull();
    expect(ctx.session?.role).toBe("head");
    expect(ctx.session?.userId).toBeTruthy();
  });

  it("AUTH_DEV_MODE=true (legacy) + AUTH_DEV_MODE_ALLOW_TEST=false + no cookie → DEV_SESSION", async () => {
    vi.stubEnv("AUTH_DEV_MODE", "true");
    vi.stubEnv("AUTH_DEV_MODE_ALLOW_TEST", "false");

    const factory = createContextFactory(
      makeApp(makePrismaStub()),
      createNullLogger(),
    );
    const ctx = await factory(makeReq() as never);

    expect(ctx.session).not.toBeNull();
    expect(ctx.session?.role).toBe("head");
  });

  it("both flags true + no cookie → DEV_SESSION (regression-free)", async () => {
    vi.stubEnv("AUTH_DEV_MODE", "true");
    vi.stubEnv("AUTH_DEV_MODE_ALLOW_TEST", "true");

    const factory = createContextFactory(
      makeApp(makePrismaStub()),
      createNullLogger(),
    );
    const ctx = await factory(makeReq() as never);

    expect(ctx.session).not.toBeNull();
  });

  it("copies x-request-id into tRPC context correlationId", async () => {
    vi.stubEnv("AUTH_DEV_MODE", "false");
    vi.stubEnv("AUTH_DEV_MODE_ALLOW_TEST", "false");

    const factory = createContextFactory(
      makeApp(makePrismaStub()),
      createNullLogger(),
    );
    const ctx = await factory(makeReqWithRequestId("req-context-1") as never);

    expect(ctx.correlationId).toBe("req-context-1");
  });

  it("AUTH_DEV_MODE_ALLOW_TEST=true + INVALID cookie → still falls through to DEV_SESSION", async () => {
    // Defense-in-depth: a stale/forged cookie must not break the staging path.
    vi.stubEnv("AUTH_DEV_MODE", "false");
    vi.stubEnv("AUTH_DEV_MODE_ALLOW_TEST", "true");

    const factory = createContextFactory(
      makeApp(makePrismaStub()),
      createNullLogger(),
    );
    const ctx = await factory(makeReq("not-a-real-jwt") as never);

    expect(ctx.session).not.toBeNull();
    expect(ctx.session?.role).toBe("head");
  });

  // -------------------------------------------------------------------------
  // 2.2 Hydration pins (refactor-trpc-infra-duplication)
  // -------------------------------------------------------------------------

  it("AUTH_DEV_MODE=true: dev session is hydrated with organization stub", async () => {
    vi.stubEnv("AUTH_DEV_MODE", "true");
    vi.stubEnv("AUTH_DEV_MODE_ALLOW_TEST", "false");

    const factory = createContextFactory(
      makeApp(makePrismaStub()),
      createNullLogger(),
    );
    const ctx = await factory(makeReq() as never);

    expect(ctx.session?.organization).toEqual({
      shortName: "PEO",
      fullName: "Product Engineering & Operations",
    });
  });

  it("AUTH_DEV_MODE_ALLOW_TEST=true: dev session is hydrated with organization stub", async () => {
    vi.stubEnv("AUTH_DEV_MODE", "false");
    vi.stubEnv("AUTH_DEV_MODE_ALLOW_TEST", "true");

    const factory = createContextFactory(
      makeApp(makePrismaStub()),
      createNullLogger(),
    );
    const ctx = await factory(makeReq() as never);

    expect(ctx.session?.organization).toEqual({
      shortName: "PEO",
      fullName: "Product Engineering & Operations",
    });
  });

  it("AUTH_DEV_MODE_ALLOW_TEST=true: dev session resolves activeReportSectionId when reportSection stub returns a row", async () => {
    vi.stubEnv("AUTH_DEV_MODE", "false");
    vi.stubEnv("AUTH_DEV_MODE_ALLOW_TEST", "true");

    const prisma = makePrismaStub();
    prisma.reportSection.findFirst.mockResolvedValueOnce({
      id: "section-stub-id",
    } as never);

    const factory = createContextFactory(makeApp(prisma), createNullLogger());
    const ctx = await factory(makeReq() as never);

    expect(ctx.session?.activeReportSectionId).toBe("section-stub-id");
  });
});
