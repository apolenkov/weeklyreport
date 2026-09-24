import type { Server } from "node:http";
import { request } from "node:http";
import type { AddressInfo } from "node:net";

import type { INestApplication } from "@nestjs/common";
import type { Strategy as SamlStrategy } from "@node-saml/passport-saml";
import type { PrismaClient } from "@prisma/client";
import { initTRPC } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import type { RequestHandler } from "express";
import express from "express";
import type { Redis } from "ioredis";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { mountApiIngress } from "../../bootstrap/api-ingress";
import { createAuditLogger } from "../../lib/audit-logger";
import { createNullLogger } from "../../lib/logger";
import {
  createAuthController,
  mountAuthRoutes,
} from "../../modules/auth/index";
import { WebVitalsController } from "../../modules/observability/index";
import { createFakeRedisCall } from "../../test-utils/fake-redis-call";
import type { EnvConfig } from "../config/env.schema";
import type { PrismaService } from "../prisma/prisma.service";
import { createRateLimits } from "../throttler/rate-limit.middleware";
import type { AppRouter } from "../trpc/trpc.router";
import {
  CLIENT_LOGS_JSON_LIMIT,
  mountClientLogsIngress,
  SAML_CALLBACK_URLENCODED_LIMIT,
  TRPC_MAX_BODY_BYTES,
  WEB_VITALS_JSON_LIMIT,
} from "./ingress-limits";

// The composed mounts below never log unless a 429 fires, and these servers key
// per loopback IP, so a no-op warn sink is all the limiter needs.
const silentLogger = createNullLogger();

interface HttpResponse {
  status: number;
  body: string;
}

async function listen(app: express.Express): Promise<Server> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => {
    server.once("listening", () => {
      resolve();
    });
  });
  return server;
}

function close(server: Server): Promise<void> {
  return new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
}

function postBody(
  port: number,
  path: string,
  bodyStr: string,
  contentType: string,
): Promise<HttpResponse> {
  return new Promise<HttpResponse>((resolve, reject) => {
    const clientReq = request(
      {
        host: "127.0.0.1",
        port,
        path,
        method: "POST",
        headers: {
          "content-type": contentType,
          "content-length": Buffer.byteLength(bodyStr),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString(),
          });
        });
      },
    );
    clientReq.on("error", reject);
    clientReq.write(bodyStr);
    clientReq.end();
  });
}

function postJson(
  port: number,
  path: string,
  bodyStr: string,
): Promise<HttpResponse> {
  return postBody(port, path, bodyStr, "application/json");
}

function postForm(
  port: number,
  path: string,
  bodyStr: string,
): Promise<HttpResponse> {
  return postBody(port, path, bodyStr, "application/x-www-form-urlencoded");
}

async function floodPost(
  port: number,
  path: string,
  bodyStr: string,
  count: number,
): Promise<HttpResponse[]> {
  const responses: HttpResponse[] = [];
  for (let i = 0; i < count; i += 1) {
    responses.push(await postJson(port, path, bodyStr));
  }
  return responses;
}

async function buildClientLogsApp(): Promise<express.Express> {
  // Mirror main.ts via mountClientLogsIngress so limiter→parser→handler order
  // and the byte limit cannot drift here without failing in production too.
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  // The production-budget path requires a store; fake Redis exercises the real
  // RedisStore without an external service.
  const { clientLogsLimiter } = await createRateLimits({
    logger: silentLogger,
    isTest: false,
    redis: createFakeRedisCall() as unknown as Redis,
  });
  mountClientLogsIngress(
    app,
    "/api/client-logs",
    clientLogsLimiter,
    express.json({ limit: CLIENT_LOGS_JSON_LIMIT }),
    (_req, res) => {
      res.sendStatus(204);
    },
  );
  return app;
}

// 128 KiB plus the JSON wrapper is unambiguously over the parser's budget, so
// the 413 assertion cannot pass by accidentally sitting at the boundary.
function oversizedClientLogsBody(): string {
  return JSON.stringify({ data: "x".repeat(128 * 1024) });
}

describe("public ingress limits — /api/client-logs flood", () => {
  it("pins the client-logs byte budget itself, not just its enforcement", () => {
    // An oversize request only proves the parser rejects *something*; the
    // literal catches a relaxed budget (e.g. "1mb") the oversize body would
    // otherwise sail under.
    expect(CLIENT_LOGS_JSON_LIMIT).toBe("128kb");
  });

  it("rejects a client-logs body over 128 KiB with 413", async () => {
    const server = await listen(await buildClientLogsApp());
    const { port } = server.address() as AddressInfo;

    try {
      const res = await postJson(
        port,
        "/api/client-logs",
        oversizedClientLogsBody(),
      );
      expect(res.status).toBe(413);
    } finally {
      await close(server);
    }
  });

  it("rate-limits an oversized body before the JSON parser sees it", async () => {
    // Fresh app means a fresh fake-Redis bucket: 60 accepted requests exhaust
    // the production 60/min/IP client-logs budget.
    const server = await listen(await buildClientLogsApp());
    const { port } = server.address() as AddressInfo;

    try {
      const accepted = await floodPost(
        port,
        "/api/client-logs",
        JSON.stringify({ entries: [] }),
        60,
      );
      expect(accepted.every((r) => r.status === 204)).toBe(true);

      // Parser-before-limiter would surface 413/400 here; limiter-first must
      // short-circuit the oversized body with 429 before it is parsed.
      const limited = await postJson(
        port,
        "/api/client-logs",
        oversizedClientLogsBody(),
      );
      expect(limited.status).toBe(429);
      const rejected = JSON.parse(limited.body) as { error: string };
      expect(rejected.error).toBe("rate_limit_exceeded");
    } finally {
      await close(server);
    }
  });

  it("accepts traffic under the limit and returns 429 over it", async () => {
    // Production budget (isTest=false) is 60/min/IP; fire one past it.
    const server = await listen(await buildClientLogsApp());
    const { port } = server.address() as AddressInfo;

    try {
      const responses = await floodPost(
        port,
        "/api/client-logs",
        JSON.stringify({ entries: [] }),
        61,
      );
      expect(responses.slice(0, 60).every((r) => r.status === 204)).toBe(true);
      const limited = responses.at(60);
      if (!limited) throw new Error("61st response missing");
      expect(limited.status).toBe(429);
      const rejected = JSON.parse(limited.body) as { error: string };
      expect(rejected.error).toBe("rate_limit_exceeded");
    } finally {
      await close(server);
    }
  });
});

const t = initTRPC.create();
const probeRouter = t.router({
  echo: t.procedure
    .input(z.object({ value: z.string() }))
    .mutation(({ input }) => ({ ok: input.value })),
});

function buildTrpcApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    "/trpc",
    trpcExpress.createExpressMiddleware({
      router: probeRouter,
      maxBodySize: TRPC_MAX_BODY_BYTES,
    }),
  );
  return app;
}

describe("public ingress limits — tRPC body cap", () => {
  it("pins the tRPC byte budget itself, not just its enforcement", () => {
    // repeat(TRPC_MAX_BODY_BYTES) always exceeds whatever the constant is,
    // so this literal pin is what catches a budget regression (10 bytes or
    // 10 GiB would both pass the oversize test below without it).
    expect(TRPC_MAX_BODY_BYTES).toBe(1024 * 1024);
  });

  it("rejects a mutation body over the configured limit with 413", async () => {
    const server = await listen(buildTrpcApp());
    const { port } = server.address() as AddressInfo;
    const oversized = JSON.stringify({
      value: "x".repeat(TRPC_MAX_BODY_BYTES),
    });

    try {
      const res = await postJson(port, "/trpc/echo", oversized);
      expect(res.status).toBe(413);
      expect(res.body).toContain("PAYLOAD_TOO_LARGE");
    } finally {
      await close(server);
    }
  });

  it("executes a mutation whose body is within the limit", async () => {
    const server = await listen(buildTrpcApp());
    const { port } = server.address() as AddressInfo;

    try {
      const res = await postJson(
        port,
        "/trpc/echo",
        JSON.stringify({ value: "hi" }),
      );
      expect(res.status).toBe(200);
      const parsed = JSON.parse(res.body) as {
        result: { data: { ok: string } };
      };
      expect(parsed.result.data.ok).toBe("hi");
    } finally {
      await close(server);
    }
  });
});

const PUBLIC_ROUTE_BODY_LIMIT_BYTES = 128 * 1024;

function buildWebVitalsApp(): {
  app: express.Express;
  terminalCalls: () => number;
} {
  const app = express();
  app.disable("x-powered-by");

  const nestApp = {
    get: () => ({ isRevoked: () => false }),
  } as unknown as INestApplication;
  const env = {
    AUTH_DEV_MODE: true,
    AUTH_JWT_SECRET: "web-vitals-body-limit-test-secret-32",
    FRONTEND_URL: "http://localhost:3000",
    NODE_ENV: "test",
    PDF_OUTPUT_DIR: ".",
    PRODUCT_FEEDBACK_ENABLED: false,
  } as unknown as EnvConfig;
  const passThrough: RequestHandler = (_req, _res, next) => next();
  const controller = new WebVitalsController();
  let calls = 0;

  mountApiIngress({
    app: nestApp,
    expressApp: app,
    env,
    logger: silentLogger,
    prisma: {} as PrismaService,
    appRouter: probeRouter as unknown as AppRouter,
    trpcLimiter: passThrough,
    vitalsLimiter: passThrough,
    feedbackLimiter: passThrough,
  });
  app.post("/api/web-vitals", (req, res, next) => {
    calls += 1;
    try {
      controller.record(req.body);
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  return { app, terminalCalls: () => calls };
}

interface TestSamlStrategyContext {
  fail(challenge: string, status: number): void;
}

function buildSamlConfiguredApp(): {
  app: express.Express;
  strategyCalls: () => number;
} {
  const app = express();
  let calls = 0;
  const samlStrategy = {
    name: "saml",
    authenticate(this: TestSamlStrategyContext): void {
      calls += 1;
      this.fail("test-authentication", 401);
    },
  } as unknown as SamlStrategy;

  mountAuthRoutes(
    app,
    samlStrategy,
    createAuthController({
      AUTH_JWT_SECRET: "saml-body-limit-test-secret-32-characters",
      NODE_ENV: "test",
    }),
    {} as PrismaClient,
    {
      AUTH_DEV_MODE: "true",
      FRONTEND_URL: "http://localhost:3000",
    },
    () => Promise.resolve({ reportId: "report-id", sectionId: "section-id" }),
    createAuditLogger(silentLogger),
  );
  return { app, strategyCalls: () => calls };
}

function validWebVitalsBody(): string {
  return JSON.stringify({ name: "LCP", value: 2500, id: "lcp-sample" });
}

function oversizedWebVitalsBody(): string {
  return JSON.stringify({
    name: "LCP",
    value: 2500,
    id: "lcp-sample",
    padding: "x".repeat(PUBLIC_ROUTE_BODY_LIMIT_BYTES),
  });
}

describe("public ingress limits — route-owned parsers", () => {
  it("keeps browser and SAML public routes on the 128 KiB budget", () => {
    expect(WEB_VITALS_JSON_LIMIT).toBe("128kb");
    expect(SAML_CALLBACK_URLENCODED_LIMIT).toBe("128kb");
  });

  it("parses a valid web-vitals beacon and rejects an oversized one before the controller", async () => {
    const fixture = buildWebVitalsApp();
    const server = await listen(fixture.app);
    const { port } = server.address() as AddressInfo;

    try {
      const accepted = await postJson(
        port,
        "/api/web-vitals",
        validWebVitalsBody(),
      );
      expect(accepted.status).toBe(204);
      expect(fixture.terminalCalls()).toBe(1);

      const rejected = await postJson(
        port,
        "/api/web-vitals",
        oversizedWebVitalsBody(),
      );
      expect(rejected.status).toBe(413);
      expect(fixture.terminalCalls()).toBe(1);
    } finally {
      await close(server);
    }
  });

  it("lets an under-cap configured SAML callback reach strategy and rejects an oversized one first", async () => {
    const fixture = buildSamlConfiguredApp();
    const server = await listen(fixture.app);
    const { port } = server.address() as AddressInfo;
    const underLimit = `SAMLResponse=${"x".repeat(
      PUBLIC_ROUTE_BODY_LIMIT_BYTES - 64,
    )}`;
    const overLimit = `SAMLResponse=${"x".repeat(
      PUBLIC_ROUTE_BODY_LIMIT_BYTES,
    )}`;

    try {
      const accepted = await postForm(port, "/auth/saml/callback", underLimit);
      expect(accepted.status).toBe(302);
      expect(fixture.strategyCalls()).toBe(1);

      const rejected = await postForm(port, "/auth/saml/callback", overLimit);
      expect(rejected.status).toBe(413);
      expect(fixture.strategyCalls()).toBe(1);
    } finally {
      await close(server);
    }
  });
});
