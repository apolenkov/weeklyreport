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
import { createAuthenticatedSitepingHandler } from "./product-feedback.handler";
import { ProductFeedbackMemoryRepository } from "./product-feedback.memory-repository";

vi.mock("../../lib/human-session", () => ({
  resolveHumanSession: vi.fn(),
}));

const ORIGIN = "http://localhost:3000";
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

const payload = {
  projectName: "spoofed",
  type: "bug",
  message: "The row is difficult to read",
  url: "/reports/one?token=secret#row",
  urlPattern: null,
  viewport: "1440x900",
  userAgent: "test-browser",
  authorName: "Spoofed Name",
  authorEmail: "spoofed@example.test",
  clientId: "client_one",
  annotations: [],
  screenshotDataUrl: null,
  screenshotRegion: null,
  diagnostics: null,
} as const;

async function createServer(role: UserSession["role"]): Promise<Server> {
  sessions.mockResolvedValue(session(role));
  const app = express();
  app.disable("x-powered-by");
  app.use(cookieParser());
  const handler = createAuthenticatedSitepingHandler({
    prisma: {} as PrismaService,
    repository: new ProductFeedbackMemoryRepository(),
    verifySessionToken: () => session(role),
    sessionRevocation: { isRevoked: () => Promise.resolve(false) },
    frontendOrigin: ORIGIN,
    logger: createNullLogger(),
  });
  app.use(
    "/api/siteping",
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
  method: string,
  body?: Record<string, unknown>,
  options: {
    authenticated?: boolean;
    origin?: string;
    focusId?: string;
    query?: string;
  } = {},
): Promise<Response> {
  const { port } = server.address() as AddressInfo;
  return fetch(`http://127.0.0.1:${port}/api/siteping${options.query ?? ""}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(options.authenticated === false
        ? {}
        : { cookie: `${AUTH_COOKIE_NAME}=test-token` }),
      ...(method === "GET" ? {} : { origin: options.origin ?? ORIGIN }),
      ...(options.focusId ? { "x-siteping-focus-id": options.focusId } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

afterEach(() => {
  sessions.mockReset();
});

describe("authenticated SitePing ingress", () => {
  it("rejects anonymous traffic before feedback parsing", async () => {
    const server = await createServer("lead");
    try {
      const response = await call(server, "POST", payload, {
        authenticated: false,
      });
      expect(response.status).toBe(401);
    } finally {
      server.close();
    }
  });

  it("uses server identity/product and pathname-only scope", async () => {
    const server = await createServer("lead");
    try {
      const created = await call(server, "POST", payload);
      expect(created.status).toBe(201);
      const response = (await created.json()) as Record<string, unknown>;
      expect(response).toMatchObject({
        projectName: "weekly-report",
        authorName: "lead user",
        authorEmail: "lead@example.test",
        status: "open",
        url: "/reports/one",
      });
      expect(JSON.stringify(response)).not.toContain("secret");
    } finally {
      server.close();
    }
  });

  it("returns one record for two concurrent same-author submissions", async () => {
    const server = await createServer("lead");
    try {
      const [first, second] = await Promise.all([
        call(server, "POST", payload),
        call(server, "POST", payload),
      ]);
      expect([first.status, second.status]).toEqual([201, 201]);
      const [firstBody, secondBody] = (await Promise.all([
        first.json(),
        second.json(),
      ])) as [{ id: string }, { id: string }];
      expect(secondBody.id).toBe(firstBody.id);
      const listed = await call(server, "GET");
      expect(listed.headers.get("cache-control")).toBe("no-store");
      await expect(listed.json()).resolves.toMatchObject({ total: 1 });
    } finally {
      server.close();
    }
  });

  it("includes an authorized deep-link target outside the first 20", async () => {
    const server = await createServer("lead");
    try {
      const oldest = await call(server, "POST", {
        ...payload,
        clientId: "deep_link_oldest",
      });
      const oldestBody = (await oldest.json()) as { id: string };
      for (let index = 0; index < 20; index += 1) {
        expect(
          (
            await call(server, "POST", {
              ...payload,
              clientId: `deep_link_newer_${index}`,
            })
          ).status,
        ).toBe(201);
      }

      const listed = await call(server, "GET", undefined, {
        focusId: oldestBody.id,
        query: "?projectName=weekly-report&limit=20&url=%2Freports%2Fone",
      });
      const page = (await listed.json()) as {
        feedbacks: readonly { id: string }[];
        total: number;
      };
      expect(page.feedbacks).toHaveLength(20);
      expect(page.feedbacks[0]?.id).toBe(oldestBody.id);
      expect(page.total).toBe(21);
    } finally {
      server.close();
    }
  });

  it("persists valid screenshot, region, and diagnostics", async () => {
    const server = await createServer("viewer");
    try {
      const response = await call(server, "POST", {
        ...payload,
        clientId: "client_capture",
        screenshotDataUrl: "data:image/png;base64,AA==",
        screenshotRegion: { xPct: 0.1, yPct: 0.2, wPct: 0.3, hPct: 0.4 },
        diagnostics: {
          console: [
            {
              level: "error",
              timestamp: "2026-09-03T10:00:00.000Z",
              message: "Request failed",
            },
          ],
          network: [
            {
              url: "/api/report?period=current",
              method: "GET",
              status: 500,
              durationMs: 25,
              timestamp: "2026-09-03T10:00:00.000Z",
            },
          ],
        },
      });
      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toMatchObject({
        screenshotUrl: "data:image/png;base64,AA==",
        screenshotRegion: { xPct: 0.1, yPct: 0.2, wPct: 0.3, hPct: 0.4 },
        diagnostics: {
          console: [{ level: "error" }],
          network: [{ status: 500 }],
        },
      });
    } finally {
      server.close();
    }
  });

  it("rejects malformed capture fields", async () => {
    const server = await createServer("viewer");
    try {
      const response = await call(server, "POST", {
        ...payload,
        clientId: "client_bad_capture",
        screenshotDataUrl: "https://example.test/image.png",
      });
      expect(response.status).toBe(400);
    } finally {
      server.close();
    }
  });

  it("rejects cross-origin writes", async () => {
    const server = await createServer("lead");
    try {
      expect(
        (await call(server, "POST", payload, { origin: "https://evil.test" }))
          .status,
      ).toBe(403);
    } finally {
      server.close();
    }
  });

  it("lets an author resolve and delete their own feedback", async () => {
    const server = await createServer("lead");
    try {
      const created = await call(server, "POST", payload);
      const feedback = (await created.json()) as { id: string };
      expect(
        (
          await call(server, "PATCH", {
            id: feedback.id,
            projectName: "weekly-report",
            status: "resolved",
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await call(server, "DELETE", {
            id: feedback.id,
            projectName: "weekly-report",
          })
        ).status,
      ).toBe(200);
    } finally {
      server.close();
    }
  });

  it("allows scoped bulk deletion for every authenticated role", async () => {
    const server = await createServer("admin");
    try {
      expect((await call(server, "POST", payload)).status).toBe(201);
      const response = await call(server, "DELETE", {
        projectName: "weekly-report",
        deleteAll: true,
      });
      expect(response.status).toBe(200);
    } finally {
      server.close();
    }

    const leadServer = await createServer("lead");
    try {
      expect((await call(leadServer, "POST", payload)).status).toBe(201);
      const response = await call(leadServer, "DELETE", {
        projectName: "weekly-report",
        deleteAll: true,
      });
      expect(response.status).toBe(200);
    } finally {
      leadServer.close();
    }
  });
});
