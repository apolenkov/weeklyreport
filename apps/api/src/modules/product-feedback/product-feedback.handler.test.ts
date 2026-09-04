import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import { AUTH_COOKIE_NAME, type UserSession } from "@customreport/shared";
import cookieParser from "cookie-parser";
import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PRODUCT_FEEDBACK_JSON_LIMIT } from "../../infrastructure/http/ingress-limits";
import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { resolveHumanSession } from "../../lib/human-session";
import { createNullLogger } from "../../lib/logger";
import {
  createAuthenticatedFeedbackHandler,
  isLoopbackAddress,
} from "./product-feedback.handler";
import { ProductFeedbackMemoryRepository } from "./product-feedback.memory-repository";
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
  const server = app.listen(0);
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

  it("supports comment edits and non-destructive close", async () => {
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
      ).toBe(204);
      const listed = await call(server, "/feedback?format=internal");
      const page = (await listed.json()) as {
        feedback: readonly { id: string; status: string }[];
      };
      expect(page.feedback).toContainEqual(
        expect.objectContaining({ id: created.id, status: "wont_fix" }),
      );
    } finally {
      server.close();
    }
  });
});
