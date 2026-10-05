import { AUTH_COOKIE_NAME, type UserSession } from "@customreport/shared";
import type { INestApplication } from "@nestjs/common";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../lib/logger";
import {
  clearOrgCache,
  createContextFactory as createContextFactoryImpl,
  type HumanSessionDeps,
  resolveHumanSession,
} from "./trpc.context";

const testContextEnv = () => ({
  NODE_ENV: (process.env.NODE_ENV ?? "test") as
    "development" | "production" | "test",
  AUTH_DEV_MODE: process.env.AUTH_DEV_MODE === "true",
  AUTH_DEV_MODE_ALLOW_TEST: process.env.AUTH_DEV_MODE_ALLOW_TEST as
    "true" | "false" | undefined,
  AUTH_JWT_SECRET:
    process.env.AUTH_JWT_SECRET ?? "integration-test-secret-32-chars-or-more",
  PDF_EXPORT_JWT_SECRET:
    process.env.PDF_EXPORT_JWT_SECRET ??
    "test-pdf-export-secret-at-least-32-chars",
});

function createContextFactory(
  app: INestApplication,
  logger: ReturnType<typeof createNullLogger>,
) {
  return createContextFactoryImpl(app, logger, testContextEnv());
}

// Dev-mode flag matrix against a mocked Nest app — no real DB.
// Cookie-path coverage lives in integration tests.

interface MockNestApp {
  get: () => unknown;
}

function makePrismaStub() {
  return {
    reportSection: {
      findFirst: vi.fn<() => Promise<{ id: string } | null>>(() =>
        Promise.resolve(null),
      ),
    },
    // The dev-session path hydrates `session.organization` from the singleton
    // Organization row.
    organization: {
      findUnique: vi.fn(() =>
        Promise.resolve({
          shortName: "PEO",
          fullName: "Product Engineering & Operations",
        }),
      ),
      upsert: vi.fn(() =>
        Promise.resolve({
          shortName: "PEO",
          fullName: "Product Engineering & Operations",
        }),
      ),
    },
  };
}

function makeApp(prisma: ReturnType<typeof makePrismaStub>): INestApplication {
  const app: MockNestApp = {
    get: () => prisma,
  };
  return app as unknown as INestApplication;
}

function makeReq(
  options: {
    cookieToken?: string;
    requestId?: string;
  } = {},
): CreateExpressContextOptions {
  const req = {
    headers: options.requestId ? { "x-request-id": options.requestId } : {},
    cookies: options.cookieToken
      ? { [AUTH_COOKIE_NAME]: options.cookieToken }
      : {},
  } as unknown as Request;
  const res = {} as Response;
  return {
    req,
    res,
    info: {
      accept: null,
      type: "query",
      isBatchCall: false,
      calls: [],
      connectionParams: null,
      signal: new AbortController().signal,
      url: null,
    },
  };
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
        findUnique: vi.fn(() =>
          Promise.resolve({
            isActive: true,
            role: "head",
            reportingGroupId: null,
          }),
        ),
      },
      organization: {
        findUnique: vi.fn(() => Promise.reject(hydrationError)),
      },
    };

    await expect(
      resolveHumanSession("valid-token", makeHumanSessionDeps(prisma)),
    ).rejects.toBe(hydrationError);
  });

  it("takes group name and section from the one user read, without extra lookups", async () => {
    const groupFindUnique = vi.fn();
    const sectionFindFirst = vi.fn();
    const prisma = {
      user: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            isActive: true,
            role: "lead",
            reportingGroupId: "g1",
            reportingGroup: { name: "Group One" },
            authoredReportSections: [{ id: "section-1" }],
          }),
        ),
      },
      reportingGroup: { findUnique: groupFindUnique },
      reportSection: { findFirst: sectionFindFirst },
      organization: {
        findUnique: vi.fn(() =>
          Promise.resolve({ shortName: "S", fullName: "Full" }),
        ),
      },
    };

    await expect(
      resolveHumanSession("valid-token", makeHumanSessionDeps(prisma)),
    ).resolves.toMatchObject({
      reportingGroupId: "g1",
      reportingGroupName: "Group One",
      activeReportSectionId: "section-1",
    });
    expect(groupFindUnique).not.toHaveBeenCalled();
    expect(sectionFindFirst).not.toHaveBeenCalled();
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
    // Reset the module-level orgCache so cases are order-independent.
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
    const ctx = await factory(makeReq());

    expect(ctx.session).toBeNull();
  });

  it("AUTH_DEV_MODE=false + AUTH_DEV_MODE_ALLOW_TEST=true + no cookie → DEV_SESSION", async () => {
    vi.stubEnv("AUTH_DEV_MODE", "false");
    vi.stubEnv("AUTH_DEV_MODE_ALLOW_TEST", "true");

    const factory = createContextFactory(
      makeApp(makePrismaStub()),
      createNullLogger(),
    );
    const ctx = await factory(makeReq());

    expect(ctx.session).not.toBeNull();
    expect(ctx.session?.role).toBe("head");
    expect(ctx.session?.userId).toBeTruthy();
  });

  it("AUTH_DEV_MODE=true + AUTH_DEV_MODE_ALLOW_TEST=false + no cookie → DEV_SESSION", async () => {
    vi.stubEnv("AUTH_DEV_MODE", "true");
    vi.stubEnv("AUTH_DEV_MODE_ALLOW_TEST", "false");

    const factory = createContextFactory(
      makeApp(makePrismaStub()),
      createNullLogger(),
    );
    const ctx = await factory(makeReq());

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
    const ctx = await factory(makeReq());

    expect(ctx.session).not.toBeNull();
  });

  it("copies x-request-id into tRPC context correlationId", async () => {
    vi.stubEnv("AUTH_DEV_MODE", "false");
    vi.stubEnv("AUTH_DEV_MODE_ALLOW_TEST", "false");

    const factory = createContextFactory(
      makeApp(makePrismaStub()),
      createNullLogger(),
    );
    const ctx = await factory(makeReq({ requestId: "req-context-1" }));

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
    const ctx = await factory(makeReq({ cookieToken: "not-a-real-jwt" }));

    expect(ctx.session).not.toBeNull();
    expect(ctx.session?.role).toBe("head");
  });

  it("AUTH_DEV_MODE=true: dev session is hydrated with organization stub", async () => {
    vi.stubEnv("AUTH_DEV_MODE", "true");
    vi.stubEnv("AUTH_DEV_MODE_ALLOW_TEST", "false");

    const factory = createContextFactory(
      makeApp(makePrismaStub()),
      createNullLogger(),
    );
    const ctx = await factory(makeReq());

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
    const ctx = await factory(makeReq());

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
    });

    const factory = createContextFactory(makeApp(prisma), createNullLogger());
    const ctx = await factory(makeReq());

    expect(ctx.session?.activeReportSectionId).toBe("section-stub-id");
  });
});
