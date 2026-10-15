import { once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import { join } from "node:path";

import type { INestApplication } from "@nestjs/common";
import type { UserSession } from "@weeklyreport/shared";
import cookieParser from "cookie-parser";
import express, { type RequestHandler } from "express";
import superjson from "superjson";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { EnvConfig } from "../infrastructure/config/env.schema";
import { TRPC_MAX_BODY_BYTES } from "../infrastructure/http/ingress-limits";
import { CorrelationIdMiddleware } from "../infrastructure/middleware/correlation-id.middleware";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
import { createAuthRouter } from "../infrastructure/trpc/routers/auth.router";
import {
  protectedProcedure,
  router,
} from "../infrastructure/trpc/trpc.middleware";
import type { AppRouter } from "../infrastructure/trpc/trpc.router";
import { clearOrgCache } from "../infrastructure/trpc/trpc.session-hydration";
import type { AppLogger } from "../lib/logger";
import { SessionRevocationService } from "../modules/admin/index";
import { createAuthController } from "../modules/auth/index";
import { mountApiIngress } from "./api-ingress";

const REQUEST_ID = "auth-hydration-contract-request";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const REQUEST_TIMEOUT_MS = 2000;
const AUTH_JWT_SECRET = "hydration-contract-session-secret-32-characters";
const roots = new Set<string>();
const servers = new Set<Server>();

const humanSession: UserSession = {
  userId: USER_ID,
  email: "hydration@example.test",
  name: "Hydration contract",
  role: "head",
  activeReportId: null,
  activeReportSectionId: null,
};

function makeFixture(devAuth = true) {
  const root = mkdtempSync(join(process.cwd(), ".auth-hydration-"));
  roots.add(root);
  const findOrganization = vi.fn(() =>
    Promise.resolve({
      shortName: "TEST",
      fullName: "Hydration contract organization",
    }),
  );
  const findUser = vi.fn(() =>
    Promise.resolve({
      isActive: true,
      role: "head",
      reportingGroupId: null,
      reportingGroup: null,
    }),
  );
  const prisma = {
    user: { findUnique: findUser },
    reportSection: { findFirst: vi.fn(() => Promise.resolve(null)) },
    organization: { findUnique: findOrganization },
  } as unknown as PrismaService;
  const sessionRevocation = { isRevoked: vi.fn(() => Promise.resolve(false)) };
  const nestApp = {
    get: (token: unknown) => {
      if (token === PrismaService) return prisma;
      if (token === SessionRevocationService) return sessionRevocation;
      throw new Error("Unexpected hydration fixture dependency");
    },
  } as unknown as INestApplication;
  const logger: AppLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => logger,
  };
  const env = {
    NODE_ENV: "test",
    AUTH_DEV_MODE: devAuth,
    AUTH_DEV_MODE_ALLOW_TEST: "false",
    AUTH_JWT_SECRET,
    PDF_OUTPUT_DIR: root,
    PRODUCT_FEEDBACK_ENABLED: false,
  } as EnvConfig;
  const app = express();
  app.disable("x-powered-by");
  app.use(cookieParser());
  const correlation = new CorrelationIdMiddleware({ set: vi.fn() });
  app.use((req, res, next) => correlation.use(req, res, next));
  const passThrough: RequestHandler = (_req, _res, next) => next();
  mountApiIngress({
    app: nestApp,
    expressApp: app,
    env,
    logger,
    prisma,
    appRouter: router({
      auth: createAuthRouter(),
      protected: protectedProcedure.query(() => "authenticated"),
      write: protectedProcedure.input(z.unknown()).mutation(() => "written"),
    }) as unknown as AppRouter,
    trpcLimiter: passThrough,
    vitalsLimiter: passThrough,
    feedbackLimiter: passThrough,
  });
  const cookie = createAuthController(env)
    .issueSessionCookie(humanSession)
    .setCookieHeader.split(";", 1)[0];
  if (!cookie)
    throw new Error("Hydration fixture did not issue a session cookie");

  return { app, logger, findOrganization, findUser, cookie };
}

async function getSession(
  app: express.Express,
  cookie?: string,
  path = "/trpc/auth.me",
  requestId = REQUEST_ID,
  body?: string,
) {
  const server = app.listen(0, "127.0.0.1");
  servers.add(server);
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Hydration fixture has no loopback port");
  }
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    headers: {
      "x-request-id": requestId,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    ...(body !== undefined ? { method: "POST", body } : {}),
  });
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers),
    body: await response.text(),
  };
}

beforeEach(() => clearOrgCache());

function captureExchange(
  name: string,
  fixture: ReturnType<typeof makeFixture>,
  response: Awaited<ReturnType<typeof getSession>>,
  withCookie: boolean,
): void {
  const output = process.env.TASK503_CONTRACT_EVIDENCE_DIR;
  if (!output) return;
  mkdirSync(output, { recursive: true });
  const evidence = JSON.stringify({
    request: {
      method: "GET",
      path: "/trpc/auth.me",
      requestId: REQUEST_ID,
      authenticationCookieSupplied: withCookie,
    },
    response,
    errorLogCalls: vi.mocked(fixture.logger).error.mock.calls,
  });
  writeFileSync(
    join(output, `${name}.json`),
    `${evidence
      .replaceAll(fixture.cookie, "[REDACTED]")
      .replaceAll(AUTH_JWT_SECRET, "[REDACTED]")}\n`,
  );
}

afterEach(async () => {
  try {
    for (const server of servers) {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  } finally {
    servers.clear();
    for (const root of roots) rmSync(root, { recursive: true, force: true });
    roots.clear();
    clearOrgCache();
  }
});

describe("mounted auth hydration diagnostics", () => {
  it.each(["human", "dev"] as const)(
    "logs a correlated failure when %s hydration fails before auth.me",
    async (identity) => {
      const fixture = makeFixture();
      fixture.findOrganization.mockRejectedValueOnce(
        new Error("Controlled organization read failure"),
      );

      const response = await getSession(
        fixture.app,
        identity === "human" ? fixture.cookie : undefined,
      );
      captureExchange(
        `${identity}-failure`,
        fixture,
        response,
        identity === "human",
      );
      expect(fixture.findUser).toHaveBeenCalledTimes(
        identity === "human" ? 1 : 0,
      );
      expect(fixture.findOrganization).toHaveBeenCalledOnce();
      expect(response.status).toBe(500);
      expect(response.headers["x-request-id"]).toBe(REQUEST_ID);
      const body: unknown = JSON.parse(response.body);
      expect(body).toMatchObject({
        error: {
          json: {
            data: {
              code: "INTERNAL_SERVER_ERROR",
              httpStatus: 500,
            },
          },
        },
      });
      expect(response.body).not.toMatch(/"(?:stack|cause)"\s*:/);
      expect(fixture.logger.info).not.toHaveBeenCalledWith(
        "trpc request start",
        expect.anything(),
      );
      // This is the intended RED; all preceding assertions independently
      // establish the real fail-closed adapter response before checking logs.
      expect(fixture.logger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          correlationId: REQUEST_ID,
          ip: "127.0.0.1",
          path: "auth.me",
          code: "INTERNAL_SERVER_ERROR",
        }),
      );
      expect(fixture.logger.error).toHaveBeenCalledTimes(1);
      expect(
        JSON.stringify(vi.mocked(fixture.logger.error).mock.calls),
      ).not.toMatch(
        /Controlled organization read failure|hydration@example\.test|authorization|cookie|stack|cause/i,
      );
    },
  );

  it("returns the hydrated real-cookie identity without a context error", async () => {
    const fixture = makeFixture();
    const response = await getSession(fixture.app, fixture.cookie);
    captureExchange("human-success", fixture, response, true);

    expect(response.status).toBe(200);
    const body = JSON.parse(response.body) as {
      result: { data: Parameters<typeof superjson.deserialize>[0] };
    };
    expect(superjson.deserialize(body.result.data)).toMatchObject({
      userId: USER_ID,
      role: "head",
      organization: { shortName: "TEST" },
    });
    expect(fixture.findOrganization).toHaveBeenCalledOnce();
    expect(fixture.logger.error).not.toHaveBeenCalled();
  });

  it("retains auth.me null policy when dev auth is disabled and no cookie exists", async () => {
    const fixture = makeFixture(false);
    const response = await getSession(fixture.app);
    captureExchange("anonymous", fixture, response, false);

    expect(response.status).toBe(200);
    const body = JSON.parse(response.body) as {
      result: { data: Parameters<typeof superjson.deserialize>[0] };
    };
    expect(superjson.deserialize(body.result.data)).toBeNull();
    expect(fixture.findOrganization).not.toHaveBeenCalled();
    expect(fixture.logger.error).not.toHaveBeenCalled();
  });
  it("logs one failed context for a two-procedure HTTP batch", async () => {
    const fixture = makeFixture();
    fixture.findOrganization.mockRejectedValueOnce(
      new Error("Controlled batch failure"),
    );
    const response = await getSession(
      fixture.app,
      undefined,
      "/trpc/auth.me,auth.printGate?batch=1",
    );

    expect(response.status).toBe(500);
    const body: unknown = JSON.parse(response.body);
    expect(body).toMatchObject([
      { error: { json: { data: { code: "INTERNAL_SERVER_ERROR" } } } },
      { error: { json: { data: { code: "INTERNAL_SERVER_ERROR" } } } },
    ]);
    expect(fixture.findOrganization).toHaveBeenCalledOnce();
    expect(fixture.logger.error).toHaveBeenCalledTimes(1);
  });

  it("logs the canonical replacement for an invalid inbound request ID", async () => {
    const fixture = makeFixture();
    const inbound = "private-header".repeat(20);
    fixture.findOrganization.mockRejectedValueOnce(
      new Error("Controlled header failure"),
    );
    const response = await getSession(
      fixture.app,
      undefined,
      "/trpc/auth.me",
      inbound,
    );
    const normalizedId = response.headers["x-request-id"];

    expect(response.status).toBe(500);
    expect(normalizedId).toEqual(expect.any(String));
    expect(normalizedId).not.toBe(inbound);
    expect(fixture.logger.error).toHaveBeenCalledWith(
      "trpc context failed",
      expect.objectContaining({ correlationId: normalizedId, path: "auth.me" }),
    );
    expect(
      JSON.stringify(vi.mocked(fixture.logger).error.mock.calls),
    ).not.toContain(inbound);
  });

  it("keeps procedure failures with a completed context in the existing logger", async () => {
    const fixture = makeFixture(false);
    const response = await getSession(
      fixture.app,
      undefined,
      "/trpc/protected",
    );

    expect(response.status).toBe(401);
    expect(fixture.logger.error).toHaveBeenCalledTimes(1);
    expect(fixture.logger.error).toHaveBeenCalledWith(
      "trpc request end",
      expect.objectContaining({
        phase: "trpc.request",
        error: { code: "UNAUTHORIZED" },
      }),
    );
  });

  it("does not copy an unknown request-controlled procedure path into diagnostics", async () => {
    const fixture = makeFixture();
    fixture.findOrganization.mockRejectedValueOnce(
      new Error("Controlled unknown-path failure"),
    );
    const response = await getSession(
      fixture.app,
      undefined,
      "/trpc/private-query-name",
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(fixture.logger.error).toHaveBeenCalledWith(
      "trpc context failed",
      expect.objectContaining({ path: "unknown", correlationId: REQUEST_ID }),
    );
    expect(
      JSON.stringify(vi.mocked(fixture.logger).error.mock.calls),
    ).not.toContain("private-query-name");
  });

  it("does not label a pre-context mixed-query/mutation batch as a hydration failure", async () => {
    const fixture = makeFixture();
    const response = await getSession(
      fixture.app,
      undefined,
      "/trpc/auth.me,write?batch=1",
    );

    expect(response.status).toBe(400);
    expect(fixture.findOrganization).not.toHaveBeenCalled();
    expect(fixture.logger.error).not.toHaveBeenCalledWith(
      "trpc context failed",
      expect.anything(),
    );
  });

  it.each([
    ["malformed JSON", '{"json":', 400],
    [
      "oversized JSON",
      JSON.stringify({ json: "x".repeat(TRPC_MAX_BODY_BYTES) }),
      413,
    ],
  ] as const)(
    "keeps %s in the transport error path",
    async (_name, body, status) => {
      const fixture = makeFixture();
      const response = await getSession(
        fixture.app,
        undefined,
        "/trpc/write",
        REQUEST_ID,
        body,
      );

      expect(response.status).toBe(status);
      expect(fixture.logger.error).not.toHaveBeenCalledWith(
        "trpc context failed",
        expect.anything(),
      );
    },
  );
});
