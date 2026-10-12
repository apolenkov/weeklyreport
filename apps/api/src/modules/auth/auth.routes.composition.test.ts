import type { IncomingHttpHeaders, Server } from "node:http";
import { request } from "node:http";
import type { AddressInfo } from "node:net";

import type { Strategy as SamlStrategy } from "@node-saml/passport-saml";
import type { PrismaClient } from "@prisma/client";
import express from "express";
import passport from "passport";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createNullAuditLogger } from "../../test-utils/audit-logger.js";
import type { createAuthController } from "./auth.controller.js";
import { mountAuthRoutes } from "./auth.routes";
import type { ProvisionLeadWorkspace } from "./user-session.js";

// Composition contract under test: mountAuthRoutes wires dev-login, SAML, and
// logout routes per posture. Invalid-role and successful-login HTTP paths use
// in-memory persistence/session fakes, never the real database. Requests stay
// in-process on an ephemeral loopback port.

const FRONTEND_URL = "https://app.example.com";
const REQUEST_TIMEOUT_MS = 5000;

interface HttpResponse {
  status: number;
  headers: IncomingHttpHeaders;
  body: string;
}

async function listen(app: express.Express): Promise<Server> {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", () => {
      resolve();
    });
    server.once("error", reject);
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

function send(
  port: number,
  method: "GET" | "POST",
  path: string,
): Promise<HttpResponse> {
  return new Promise<HttpResponse>((resolve, reject) => {
    const clientReq = request(
      { host: "127.0.0.1", port, path, method },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString(),
          });
        });
        res.on("error", reject);
      },
    );
    clientReq.setTimeout(REQUEST_TIMEOUT_MS, () => {
      clientReq.destroy(new Error("request timeout"));
    });
    clientReq.on("error", reject);
    clientReq.end();
  });
}

function env(overrides: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", FRONTEND_URL, ...overrides };
}

// Stubbed seams: prisma resolves "no such user", the controller/provisioner
// spies prove no session or workspace is ever created.
function makeDeps() {
  return {
    prisma: {
      user: { findFirst: vi.fn(() => Promise.resolve(null)) },
    } as unknown as PrismaClient,
    authController: {
      issueSessionCookie: vi.fn(),
      verifySessionToken: vi.fn(),
    } as unknown as ReturnType<typeof createAuthController>,
    provisionLeadWorkspace: vi.fn<ProvisionLeadWorkspace>(),
  };
}

interface StubStrategyContext {
  fail(challenge: string, status: number): void;
}

// Passport only needs name+authenticate; fail() makes the attempt observable
// without reaching an identity provider.
function createStubSamlStrategy() {
  let authenticateCalls = 0;
  const strategy = {
    name: "saml",
    authenticate(this: StubStrategyContext): void {
      authenticateCalls += 1;
      this.fail("test-authentication", 401);
    },
  } as unknown as SamlStrategy;
  return { strategy, authenticateCalls: () => authenticateCalls };
}

function mountAuthSurface(
  samlStrategy: SamlStrategy | undefined,
  envValue: NodeJS.ProcessEnv,
) {
  const app = express();
  const deps = makeDeps();
  mountAuthRoutes(app, samlStrategy, {
    authController: deps.authController,
    prisma: deps.prisma,
    env: envValue,
    provisionLeadWorkspace: deps.provisionLeadWorkspace,
    auditLogger: createNullAuditLogger(),
  });
  return { app, deps };
}

// Remove only this suite's "saml" registration from the passport singleton —
// mountSamlRoutes registers it globally whenever a strategy is supplied.
afterEach(() => {
  passport.unuse("saml");
});

describe("mountAuthRoutes composition", () => {
  it("refuses to boot without a SAML strategy when AUTH_DEV_MODE is off", async () => {
    const app = express();
    const deps = makeDeps();

    expect(() =>
      mountAuthRoutes(app, undefined, {
        authController: deps.authController,
        prisma: deps.prisma,
        env: env({ AUTH_DEV_MODE: "false" }),
        provisionLeadWorkspace: deps.provisionLeadWorkspace,
        auditLogger: createNullAuditLogger(),
      }),
    ).toThrow(
      "mountAuthRoutes: a SAML strategy is required when AUTH_DEV_MODE is off",
    );

    // The throw aborts composition — nothing, including /auth/logout (mounted
    // after mountSamlRoutes), may remain reachable on the app.
    const server = await listen(app);
    try {
      const { port } = server.address() as AddressInfo;
      for (const [method, path] of [
        ["GET", "/auth/dev-login"],
        ["GET", "/auth/saml/login"],
        ["POST", "/auth/saml/callback"],
        ["POST", "/auth/logout"],
      ] as const) {
        const res = await send(port, method, path);
        expect(res.status).toBe(404);
      }
    } finally {
      await close(server);
    }
  });

  it("mounts the dev-login shortcut and an explicit 503 callback in dev-only posture", async () => {
    const { app, deps } = mountAuthSurface(
      undefined,
      env({ AUTH_DEV_MODE: "true" }),
    );
    const server = await listen(app);
    try {
      const { port } = server.address() as AddressInfo;

      const login = await send(port, "GET", "/auth/saml/login");
      expect(login.status).toBe(302);
      expect(login.headers.location).toMatch(/^\/auth\/dev-login\?/);
      expect(login.headers.location).toContain("role=admin");

      // The dev-login handler is mounted: it runs and reports the absent seed
      // user (stubbed prisma) — distinct from Express's default 404.
      const devLogin = await send(port, "GET", "/auth/dev-login");
      expect(devLogin.status).toBe(404);
      expect(devLogin.body).toContain("No dev-login user found");
      expect(deps.authController.issueSessionCookie).not.toHaveBeenCalled();
      expect(deps.provisionLeadWorkspace).not.toHaveBeenCalled();

      const callback = await send(port, "POST", "/auth/saml/callback");
      expect(callback.status).toBe(503);
      expect(JSON.parse(callback.body)).toEqual({
        error: "SAML is not configured on this deployment",
      });

      const logout = await send(port, "POST", "/auth/logout");
      expect(logout.status).toBe(302);
      expect(logout.headers.location).toBe("/");
    } finally {
      await close(server);
    }
  });

  it("rejects an invalid dev-login role before touching persistence", async () => {
    const { app, deps } = mountAuthSurface(
      undefined,
      env({ AUTH_DEV_MODE: "true" }),
    );
    const server = await listen(app);
    try {
      const { port } = server.address() as AddressInfo;

      const response = await send(
        port,
        "GET",
        "/auth/dev-login?role=not-a-role",
      );

      expect(response.status).toBe(400);
      expect(JSON.parse(response.body)).toEqual({
        error:
          "Invalid role: not-a-role. Must be one of: lead, head, admin, viewer",
      });
      expect(deps.prisma.user.findFirst).not.toHaveBeenCalled();
      expect(deps.authController.issueSessionCookie).not.toHaveBeenCalled();
    } finally {
      await close(server);
    }
  });

  it("issues a session cookie and redirects to the selected role home", async () => {
    const user = {
      id: "00000000-0000-4000-8000-000000000701",
      email: "viewer@weeklyreport.local",
      name: "Viewer User",
      lastName: "User",
      firstName: "Viewer",
      middleName: null,
      samlId: "viewer-1",
      role: "viewer" as const,
      reportingGroupId: null,
    };
    const prisma = {
      $queryRaw: vi.fn(() => Promise.resolve([{ id: user.id }])),
      user: {
        findFirst: vi.fn(() => Promise.resolve(user)),
        findUnique: vi.fn(() => Promise.resolve(user)),
        update: vi.fn(({ data }: { data: Partial<typeof user> }) =>
          Promise.resolve({ ...user, ...data }),
        ),
      },
      reportSection: {
        findFirst: vi.fn(() => Promise.resolve(null)),
      },
      report: {
        findFirst: vi.fn(() => Promise.resolve(null)),
      },
    } as unknown as PrismaClient;
    const authController = {
      issueSessionCookie: vi.fn(() => ({
        setCookieHeader: "weeklyreport_session=issued; HttpOnly; Path=/",
      })),
      verifySessionToken: vi.fn(),
    } as unknown as ReturnType<typeof createAuthController>;
    const provisionLeadWorkspace = vi.fn<ProvisionLeadWorkspace>();
    const app = express();
    mountAuthRoutes(app, undefined, {
      authController,
      prisma,
      env: env({ AUTH_DEV_MODE: "true" }),
      provisionLeadWorkspace,
      auditLogger: createNullAuditLogger(),
    });
    const server = await listen(app);
    try {
      const { port } = server.address() as AddressInfo;

      const response = await send(port, "GET", "/auth/dev-login?role=viewer");

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(`${FRONTEND_URL}/reports/latest`);
      expect(response.headers["set-cookie"]).toEqual([
        "weeklyreport_session=issued; HttpOnly; Path=/",
      ]);
      expect(authController.issueSessionCookie).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: user.id,
          role: "viewer",
          email: user.email,
        }),
      );
      expect(provisionLeadWorkspace).not.toHaveBeenCalled();
    } finally {
      await close(server);
    }
  });

  it("mounts the passport SAML login and no dev shortcut with a strategy when dev mode is off", async () => {
    const stub = createStubSamlStrategy();
    const { app } = mountAuthSurface(
      stub.strategy,
      env({ AUTH_DEV_MODE: "false" }),
    );
    const server = await listen(app);
    try {
      const { port } = server.address() as AddressInfo;

      const login = await send(port, "GET", "/auth/saml/login");
      expect(login.status).toBe(401);
      expect(stub.authenticateCalls()).toBe(1);

      // Dev surface absent: Express's default 404, not the dev-login handler's.
      const devLogin = await send(port, "GET", "/auth/dev-login");
      expect(devLogin.status).toBe(404);
      expect(devLogin.body).toContain("Cannot GET");
    } finally {
      await close(server);
    }
  });

  it("keeps the dev shortcut on /auth/saml/login while the production callback stays live in dev mode", async () => {
    const stub = createStubSamlStrategy();
    const { app } = mountAuthSurface(
      stub.strategy,
      env({ AUTH_DEV_MODE: "true" }),
    );
    const server = await listen(app);
    try {
      const { port } = server.address() as AddressInfo;

      const login = await send(port, "GET", "/auth/saml/login");
      expect(login.status).toBe(302);
      expect(login.headers.location).toMatch(/^\/auth\/dev-login\?/);
      expect(stub.authenticateCalls()).toBe(0);

      // The real callback chain is still mounted: the stub strategy fails the
      // assertion, which the callback maps to the audited error redirect.
      const callback = await send(port, "POST", "/auth/saml/callback");
      expect(callback.status).toBe(302);
      expect(callback.headers.location).toBe(
        `${FRONTEND_URL}/auth/error?reason=invalid_assertion`,
      );
      expect(stub.authenticateCalls()).toBe(1);
    } finally {
      await close(server);
    }
  });
});
