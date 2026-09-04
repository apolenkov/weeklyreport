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
  } = {},
): Promise<Server> {
  sessions.mockImplementation((token) => {
    if (token === "lead-token") return Promise.resolve(session("lead"));
    if (token === "admin-token") return Promise.resolve(session("admin"));
    return Promise.resolve(null);
  });
  const app = express();
  app.disable("x-powered-by");
  app.use(cookieParser());
  const handler = createAuthenticatedFeedbackHandler({
    prisma: {} as PrismaService,
    repository: new ProductFeedbackMemoryRepository(),
    verifySessionToken: () => session("lead"),
    sessionRevocation: { isRevoked: () => Promise.resolve(false) },
    frontendOrigin: ORIGIN,
    logger: createNullLogger(),
    ...options,
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

  it("derives identity from the session and stores only the pathname", async () => {
    const server = await createServer();
    try {
      const response = await call(server, "/feedback", {
        method: "POST",
        ...jsonBody(createPayload()),
      });
      expect(response.status).toBe(201);
      const created = (await response.json()) as Record<string, unknown>;
      expect(created).toMatchObject({
        projectName: "weekly-report",
        type: "change",
        message: "The row is difficult to read",
        status: "open",
        url: "/reports/one",
        authorUserId: "lead-user",
        authorName: "lead user",
        authorEmail: "lead@example.test",
        annotations: [],
      });
      expect(JSON.stringify(created)).not.toContain("secret");
    } finally {
      server.close();
    }
  });

  it("rejects client-supplied identity or product authority", async () => {
    const server = await createServer();
    try {
      const response = await call(server, "/feedback", {
        method: "POST",
        ...jsonBody({
          ...createPayload(),
          authorUserId: "spoofed-user",
          projectName: "spoofed-product",
        }),
      });
      expect(response.status).toBe(400);
    } finally {
      server.close();
    }
  });

  it("partitions the inbox by user while admins see all feedback", async () => {
    const server = await createServer();
    try {
      expect(
        (
          await call(server, "/feedback", {
            method: "POST",
            ...jsonBody(createPayload()),
          })
        ).status,
      ).toBe(201);
      expect(
        (
          await call(server, "/feedback", {
            method: "POST",
            role: "admin",
            ...jsonBody(createPayload("Admin feedback", "page_admin")),
          })
        ).status,
      ).toBe(201);

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

  it("returns one row for two requests with the same client ID", async () => {
    const server = await createServer();
    try {
      const request = {
        method: "POST",
        ...jsonBody(createPayload()),
      } as const;
      const [first, second] = await Promise.all([
        call(server, "/feedback", request),
        call(server, "/feedback", request),
      ]);
      expect([first.status, second.status]).toEqual([201, 201]);
      const [firstBody, secondBody] = (await Promise.all([
        first.json(),
        second.json(),
      ])) as [{ id: string }, { id: string }];
      expect(secondBody.id).toBe(firstBody.id);
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
    const server = await createServer();
    try {
      const createdResponse = await call(server, "/feedback", {
        method: "POST",
        ...jsonBody(createPayload()),
      });
      const created = (await createdResponse.json()) as { id: string };
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
