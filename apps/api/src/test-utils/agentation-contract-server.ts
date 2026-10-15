import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  AUTH_COOKIE_NAME,
  DEFAULT_ORGANIZATION_IDENTITY,
  type UserSession,
} from "@weeklyreport/shared";
import cookieParser from "cookie-parser";
import express from "express";

import { PRODUCT_FEEDBACK_JSON_LIMIT } from "../infrastructure/http/ingress-limits";
import type { PrismaService } from "../infrastructure/prisma/prisma.service";
import { clearOrgCache } from "../infrastructure/trpc/trpc.session-hydration";
import { createNullLogger } from "../lib/logger";
import { createAuthenticatedFeedbackHandler } from "../modules/product-feedback/product-feedback.handler";
import { createTestPrisma, disconnectTestPrisma } from "./prisma-test-helper";
import { ProductFeedbackMemoryRepository } from "./product-feedback.memory-repository";

const ORIGIN = "http://localhost:3000";

// Keeps the server's last stderr output so a failed connect explains itself.
const STDERR_TAIL_CHARS = 4096;

export async function connectWithStderrTail(
  client: Client,
  transport: StdioClientTransport,
  timeout: number,
) {
  let tail = "";
  transport.stderr?.on("data", (chunk: Buffer) => {
    tail = (tail + chunk.toString()).slice(-STDERR_TAIL_CHARS);
  });
  try {
    await client.connect(transport, { timeout });
  } catch (error) {
    if (!tail) throw error;
    throw new Error(`MCP server failed to connect; stderr tail:\n${tail}`, {
      cause: error,
    });
  }
}

export async function startAgentationContractServer() {
  const prisma = createTestPrisma();
  clearOrgCache();
  const actors = ["lead", "lead", "admin"].map((role) => ({
    userId: randomUUID(),
    role: role as UserSession["role"],
    name: "Upstream contract",
    email: `${randomUUID()}@example.test`,
  }));
  const organizationCreated = await prisma.$transaction(async (db) => {
    const organizationExists =
      (await db.organization.findUnique({
        where: { id: "singleton" },
        select: { id: true },
      })) !== null;
    if (!organizationExists) {
      await db.organization.create({
        data: { id: "singleton", ...DEFAULT_ORGANIZATION_IDENTITY },
      });
    }
    await db.user.createMany({
      data: actors.map((actor) => ({
        id: actor.userId,
        samlId: actor.userId,
        role: actor.role,
        name: actor.name,
        email: actor.email,
        firstName: "Upstream",
        lastName: "Contract",
      })),
    });
    return !organizationExists;
  });
  const key = randomUUID();
  const handler = createAuthenticatedFeedbackHandler({
    prisma: prisma as unknown as PrismaService,
    repository: new ProductFeedbackMemoryRepository(),
    verifySessionToken: (token) => {
      const actor = actors.find((candidate) => candidate.userId === token);
      if (!actor) throw new Error("Invalid contract-test session");
      return actor;
    },
    sessionRevocation: { isRevoked: () => Promise.resolve(false) },
    frontendOrigin: ORIGIN,
    logger: createNullLogger(),
    agentationEnabled: true,
    agentationApiKey: key,
  });
  const app = express();
  app.disable("x-powered-by");
  app.use(cookieParser());
  app.use(
    "/api/v1",
    handler.authenticate,
    express.json({ limit: PRODUCT_FEEDBACK_JSON_LIMIT }),
    handler.handle,
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((done) => server.once("listening", done));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  const client = new Client({
    name: "weeklyreport-upstream-contract",
    version: "1.0.0",
  });
  const transport = new StdioClientTransport({
    command: resolve(
      import.meta.dirname,
      "../../../../node_modules/.bin/agentation-mcp",
    ),
    args: ["server", "--mcp-only", "--http-url", `${baseUrl}/agentation`],
    cwd: resolve(import.meta.dirname, "../../../.."),
    env: { AGENTATION_API_KEY: key },
    stderr: "pipe",
  });

  async function close(initialFailures: readonly unknown[] = []) {
    const failures = [...initialFailures];
    const attempt = async (action: () => unknown): Promise<boolean> => {
      try {
        await action();
        return true;
      } catch (error: unknown) {
        failures.push(error);
        return false;
      }
    };

    if (!(await attempt(() => client.close()))) {
      await attempt(() => transport.close());
    }
    for (const cleanup of [
      () => server.closeAllConnections(),
      () =>
        new Promise<void>((done, reject) =>
          server.close((error) => (error ? reject(error) : done())),
        ),
      () =>
        prisma.agentationSession.deleteMany({
          where: {
            authorUserId: { in: actors.map((actor) => actor.userId) },
          },
        }),
      () =>
        prisma.user.deleteMany({
          where: { id: { in: actors.map((actor) => actor.userId) } },
        }),
      () =>
        organizationCreated
          ? prisma.organization.deleteMany({ where: { id: "singleton" } })
          : undefined,
      () => clearOrgCache(),
      () => disconnectTestPrisma(),
    ]) {
      await attempt(cleanup);
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) {
      throw new AggregateError(
        failures,
        "Agentation contract fixture startup or cleanup failed",
      );
    }
  }
  try {
    await connectWithStderrTail(client, transport, 4000);
  } catch (error) {
    await close([error]);
    throw error;
  }

  function request(
    path: string,
    actor?: UserSession,
    method = "GET",
    body?: unknown,
    options: { headers?: Record<string, string>; signal?: AbortSignal } = {},
  ) {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        ...(actor ? { cookie: `${AUTH_COOKIE_NAME}=${actor.userId}` } : {}),
        ...options.headers,
      },
      ...(options.signal ? { signal: options.signal } : {}),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  return { actors, prisma, client, request, close: () => close() };
}
