import type { INestApplication } from "@nestjs/common";
import type { Request } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNullLogger } from "../../lib/logger";
import { createContextFactory } from "./trpc.context";

/**
 * AUTH-01 / Phase 28-02 contract tests for the four flag combinations.
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
      findFirst: vi.fn(async () => null),
    },
    // UFB-047 / Phase 48-A: context factory hydrates `session.organization`
    // from the singleton Organization row. The stub returns the seeded
    // defaults so the dev-session branches resolve without touching a real
    // database.
    organization: {
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

describe("createContextFactory — AUTH-01 dev-mode flag matrix (Phase 28-02)", () => {
  const ORIGINAL_AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET;

  beforeEach(() => {
    // createAuthController(env) reads AUTH_JWT_SECRET at factory creation.
    // Stub a stable test secret so the factory can construct without throwing.
    vi.stubEnv("AUTH_JWT_SECRET", "integration-test-secret-32-chars-or-more");
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
});
