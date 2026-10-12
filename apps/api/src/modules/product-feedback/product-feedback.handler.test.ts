import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import { AUTH_COOKIE_NAME, type UserSession } from "@weeklyreport/shared";
import cookieParser from "cookie-parser";
import express, {
  type Request,
  type Response as ExpressResponse,
} from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PRODUCT_FEEDBACK_JSON_LIMIT } from "../../infrastructure/http/ingress-limits";
import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { resolveHumanSession } from "../../lib/human-session";
import { createNullLogger } from "../../lib/logger";
import { ProductFeedbackMemoryRepository } from "../../test-utils/product-feedback.memory-repository";
import {
  createAuthenticatedFeedbackHandler,
  isLoopbackAddress,
} from "./product-feedback.handler";
import { feedbackAccessFromSession } from "./product-feedback.repository";

vi.mock("../../lib/human-session", () => ({
  resolveHumanSession: vi.fn(),
}));

const ORIGIN = "http://localhost:3000";
const AGENTATION_TEST_KEY = "agentation-test-key-with-32-characters";
const sessions = vi.mocked(resolveHumanSession);

function session(role: UserSession["role"]): UserSession {
  return {
    userId: `${role}-user`,
    role,
    name: `${role} user`,
    email: `${role}@example.test`,
    reportingGroupId: role === "admin" ? undefined : "group-1",
  };
}

function createPayload(
  message = "The row is difficult to read",
  clientId = "page_feedback_one",
) {
  return {
    type: "change",
    message,
    url: `${ORIGIN}/reports/one?token=secret#row`,
    viewport: "1000x500",
    userAgent: "test-browser",
    clientId,
  } as const;
}

async function createServer(
  options: {
    readonly agentationEnabled?: boolean;
    readonly agentationApiKey?: string;
    readonly repository?: ProductFeedbackMemoryRepository;
  } = {},
): Promise<Server> {
  sessions.mockImplementation((token) => {
    if (token === "lead-token") return Promise.resolve(session("lead"));
    if (token === "admin-token") return Promise.resolve(session("admin"));
    return Promise.resolve(null);
  });
  const {
    repository = new ProductFeedbackMemoryRepository(),
    ...handlerOptions
  } = options;
  const app = express();
  app.disable("x-powered-by");
  app.use(cookieParser());
  const handler = createAuthenticatedFeedbackHandler({
    prisma: {} as PrismaService,
    repository,
    verifySessionToken: () => session("lead"),
    sessionRevocation: { isRevoked: () => Promise.resolve(false) },
    frontendOrigin: ORIGIN,
    logger: createNullLogger(),
    ...handlerOptions,
  });
  app.use(
    "/api/v1",
    handler.authenticate,
    express.json({ limit: PRODUCT_FEEDBACK_JSON_LIMIT }),
    handler.handle,
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  return server;
}

async function call(
  server: Server,
  path: string,
  options: RequestInit & { role?: "lead" | "admin" } = {},
): Promise<Response> {
  const { port } = server.address() as AddressInfo;
  const { role = "lead", headers, ...request } = options;
  return fetch(`http://127.0.0.1:${port}/api/v1${path}`, {
    ...request,
    headers: {
      cookie: `${AUTH_COOKIE_NAME}=${role}-token`,
      ...(request.method && request.method !== "GET" ? { origin: ORIGIN } : {}),
      ...headers,
    },
  });
}

function jsonBody(value: unknown): Pick<RequestInit, "body" | "headers"> {
  return {
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  };
}

async function seedLegacyFeedback(
  repository: ProductFeedbackMemoryRepository,
  role: UserSession["role"],
  payload = createPayload(),
): Promise<{ id: string }> {
  const created = await repository.create(
    feedbackAccessFromSession(session(role)),
    { ...payload, annotations: [] },
  );
  return { id: created.id };
}

afterEach(() => {
  sessions.mockReset();
});

describe("authenticated product-feedback ingress", () => {
  it("accepts MCP credentials only from loopback addresses", () => {
    expect(isLoopbackAddress("127.0.0.1")).toBe(true);
    expect(isLoopbackAddress("127.42.0.7")).toBe(true);
    expect(isLoopbackAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isLoopbackAddress("::1")).toBe(true);
    expect(isLoopbackAddress("10.0.0.8")).toBe(false);
    expect(isLoopbackAddress("::ffff:10.0.0.8")).toBe(false);
    expect(isLoopbackAddress(undefined)).toBe(false);
  });

  it("rejects anonymous traffic before parsing feedback", async () => {
    const server = await createServer();
    try {
      const { port } = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/feedback`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: ORIGIN,
        },
        body: JSON.stringify(createPayload()),
      });
      expect(response.status).toBe(401);
    } finally {
      server.close();
    }
  });

  it("rejects anonymous Agentation traffic", async () => {
    const server = await createServer({ agentationEnabled: true });
    try {
      const { port } = server.address() as AddressInfo;
      const response = await fetch(
        `http://127.0.0.1:${port}/api/v1/agentation/health`,
      );

      expect(response.status).toBe(401);
    } finally {
      server.close();
    }
  });

  it("returns 404 for the removed legacy POST route without creating feedback", async () => {
    const repository = new ProductFeedbackMemoryRepository();
    const server = await createServer({ repository });
    try {
      const response = await call(server, "/feedback", {
        method: "POST",
        ...jsonBody(createPayload()),
      });
      expect(response.status).toBe(404);
      await expect(
        repository.list(feedbackAccessFromSession(session("lead")), {}),
      ).resolves.toMatchObject({ total: 0, feedbacks: [] });
    } finally {
      server.close();
    }
  });

  it("partitions the inbox by user while admins see all feedback", async () => {
    const repository = new ProductFeedbackMemoryRepository();
    const server = await createServer({ repository });
    try {
      await seedLegacyFeedback(repository, "lead");
      await seedLegacyFeedback(
        repository,
        "admin",
        createPayload("Admin feedback", "page_admin"),
      );

      const lead = await call(server, "/feedback?format=internal");
      await expect(lead.json()).resolves.toMatchObject({ total: 1 });
      const admin = await call(server, "/feedback?format=internal", {
        role: "admin",
      });
      await expect(admin.json()).resolves.toMatchObject({ total: 2 });
    } finally {
      server.close();
    }
  });

  it("rejects cross-origin writes", async () => {
    const server = await createServer();
    try {
      const response = await call(server, "/feedback", {
        method: "POST",
        ...jsonBody(createPayload()),
        headers: {
          "content-type": "application/json",
          origin: "https://evil.test",
        },
      });
      expect(response.status).toBe(403);
    } finally {
      server.close();
    }
  });

  it("does not expose agentation routes without the /agentation prefix", async () => {
    const server = await createServer({ agentationEnabled: true });
    try {
      const response = await call(server, "/sessions");

      expect(response.status).toBe(404);
    } finally {
      server.close();
    }
  });

  it("rejects a cross-origin Agentation read before repository access", async () => {
    const server = await createServer({ agentationEnabled: true });
    try {
      const response = await call(server, "/agentation/health", {
        headers: { origin: "https://evil.test" },
      });

      expect(response.status).toBe(403);
    } finally {
      server.close();
    }
  });

  it("authenticates MCP health with its separate API key", async () => {
    const server = await createServer({
      agentationEnabled: true,
      agentationApiKey: AGENTATION_TEST_KEY,
    });
    try {
      const { port } = server.address() as AddressInfo;
      const response = await fetch(
        `http://127.0.0.1:${port}/api/v1/agentation/health`,
        { headers: { "x-api-key": AGENTATION_TEST_KEY } },
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        status: "ok",
        mode: "postgres",
      });
    } finally {
      server.close();
    }
  });

  it("does not let the MCP key create browser-owned sessions", async () => {
    const server = await createServer({
      agentationEnabled: true,
      agentationApiKey: AGENTATION_TEST_KEY,
    });
    try {
      const { port } = server.address() as AddressInfo;
      const response = await fetch(
        `http://127.0.0.1:${port}/api/v1/agentation/sessions`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": AGENTATION_TEST_KEY,
          },
          body: JSON.stringify({ url: `${ORIGIN}/lead/report` }),
        },
      );

      expect(response.status).toBe(403);
    } finally {
      server.close();
    }
  });

  it("supports author edits and denies hard delete to non-admins", async () => {
    const repository = new ProductFeedbackMemoryRepository();
    const server = await createServer({ repository });
    try {
      const created = await seedLegacyFeedback(repository, "lead");
      const updated = await call(server, `/feedback/${created.id}`, {
        method: "PUT",
        ...jsonBody({ comment: "Clearer description" }),
      });
      await expect(updated.json()).resolves.toMatchObject({
        id: created.id,
        message: "Clearer description",
      });

      expect(
        (await call(server, `/feedback/${created.id}`, { method: "DELETE" }))
          .status,
      ).toBe(404);
      const listed = await call(server, "/feedback?format=internal");
      const page = (await listed.json()) as {
        feedback: readonly { id: string; status: string }[];
      };
      expect(page.feedback).toContainEqual(
        expect.objectContaining({ id: created.id, status: "open" }),
      );
    } finally {
      server.close();
    }
  });

  it("keeps status changes and item deletion behind the triage role boundary", async () => {
    const repository = new ProductFeedbackMemoryRepository();
    const server = await createServer({ repository });
    try {
      const created = await seedLegacyFeedback(repository, "lead");
      expect(
        (
          await call(server, "/feedback", {
            method: "DELETE",
            role: "admin",
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await call(server, `/feedback/${created.id}/status`, {
            method: "PATCH",
            ...jsonBody({ status: "resolved" }),
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await call(server, `/feedback/${created.id}`, {
            method: "DELETE",
            role: "admin",
          })
        ).status,
      ).toBe(204);
      const inbox = await call(server, "/feedback?format=internal");
      const body = (await inbox.json()) as {
        feedback: readonly {
          capabilities: {
            editOriginal: boolean;
            triage: boolean;
            reply: boolean;
            dismiss: boolean;
            delete: boolean;
          };
        }[];
      };
      expect(body.feedback).toHaveLength(0);
    } finally {
      server.close();
    }
  });

  it("allows only triage roles to change status and keeps author edits private", async () => {
    const repository = new ProductFeedbackMemoryRepository();
    const server = await createServer({ repository });
    try {
      const created = await seedLegacyFeedback(repository, "lead");
      expect(
        (
          await call(server, `/feedback/${created.id}/status`, {
            method: "PATCH",
            role: "admin",
            ...jsonBody({ status: "in_progress" }),
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await call(server, `/feedback/${created.id}`, {
            method: "PUT",
            role: "admin",
            ...jsonBody({ comment: "Not the author" }),
          })
        ).status,
      ).toBe(404);
    } finally {
      server.close();
    }
  });

  it("requires a reason for Agentation dismissal and does not expose its mutation routes to leads", async () => {
    const server = await createServer({ agentationEnabled: true });
    try {
      const wontFix = await call(server, "/feedback/agentation_a-1/status", {
        method: "PATCH",
        role: "admin",
        ...jsonBody({ status: "wont_fix" }),
      });
      expect(wontFix.status).toBe(400);
      const emptyReason = await call(
        server,
        "/feedback/agentation_a-1/dismiss",
        { method: "POST", role: "admin", ...jsonBody({ reason: "  " }) },
      );
      expect(emptyReason.status).toBe(400);
      expect(
        (
          await call(server, "/feedback/agentation_a-1/replies", {
            method: "POST",
            ...jsonBody({ content: "  " }),
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await call(server, "/feedback/agentation_a-1/dismiss", {
            method: "POST",
            ...jsonBody({ reason: "No access" }),
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await call(server, "/feedback/agentation_a-1", {
            method: "DELETE",
          })
        ).status,
      ).toBe(404);
    } finally {
      server.close();
    }
  });
});

describe("isolated authenticated feedback list — no listener", () => {
  async function listRequest(url: unknown, serverFault = false) {
    sessions.mockResolvedValue(session("lead"));
    const repository = new ProductFeedbackMemoryRepository();
    const list = vi.spyOn(repository, "list");
    if (serverFault) list.mockRejectedValueOnce(new Error("Repository failed"));
    const handler = createAuthenticatedFeedbackHandler({
      prisma: {} as PrismaService,
      repository,
      verifySessionToken: () => session("lead"),
      sessionRevocation: { isRevoked: () => Promise.resolve(false) },
      frontendOrigin: ORIGIN,
      logger: createNullLogger(),
    });
    const request = {
      method: "GET",
      path: "/feedback",
      query: url === undefined ? {} : { url },
      cookies: { [AUTH_COOKIE_NAME]: "lead-token" },
      header: () => undefined,
      socket: { remoteAddress: "127.0.0.1" },
    } as unknown as Request;
    const status = vi.fn();
    const body = vi.fn();
    const setHeader = vi.fn();
    const response = {
      status,
      json: body,
      setHeader,
    } as unknown as ExpressResponse;
    status.mockReturnValue(response);
    body.mockReturnValue(response);
    const next = vi.fn();
    await handler.authenticate(request, response, next);
    expect(next).toHaveBeenCalledOnce();
    await handler.handle(request, response, next);
    return { status, body, setHeader, list };
  }
  it.each(["http://[", "http://[:::]"])(
    "rejects malformed query %s before persistence",
    async (url) => {
      const result = await listRequest(url);
      expect(result.status).toHaveBeenCalledWith(400);
      expect(result.body).toHaveBeenCalledWith({
        error: "invalid_request",
        message: "Invalid feedback request.",
      });
      expect(result.list).not.toHaveBeenCalled();
      expect(result.setHeader).toHaveBeenCalledWith(
        "cache-control",
        "no-store",
      );
    },
  );
  it.each([
    "/reports/r-1?feedback=focus-1",
    `${ORIGIN}/reports/r-1?feedback=focus-1`,
  ])("retains valid scoped/focused query %s", async (url) => {
    const result = await listRequest(url);
    expect(result.status).toHaveBeenCalledWith(200);
    expect(result.list).toHaveBeenCalledWith(
      expect.objectContaining({ role: "lead", userId: "lead-user" }),
      { limit: 100, url: "/reports/r-1" },
      "focus-1",
    );
    expect(result.body).toHaveBeenCalledWith({ feedback: [], total: 0 });
    expect(result.setHeader).toHaveBeenCalledWith("cache-control", "no-store");
  });
  it.each([undefined, "", ["/reports/r-1"]])(
    "keeps unfiltered admission for absent/empty/non-string %j",
    async (url) => {
      const result = await listRequest(url);
      expect(result.status).toHaveBeenCalledWith(200);
      expect(result.list).toHaveBeenCalledWith(
        expect.objectContaining({ role: "lead", userId: "lead-user" }),
        { limit: 100 },
        undefined,
      );
    },
  );
  it("keeps unexpected repository failures as server errors", async () => {
    const result = await listRequest("/reports/r-1", true);
    expect(result.status).toHaveBeenCalledWith(500);
    expect(result.body).toHaveBeenCalledWith({
      error: "server_error",
      message: "Feedback request failed.",
    });
    expect(result.setHeader).toHaveBeenCalledWith("cache-control", "no-store");
  });
});
