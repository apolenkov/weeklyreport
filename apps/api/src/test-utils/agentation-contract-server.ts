import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";

import { AUTH_COOKIE_NAME, type UserSession } from "@customreport/shared";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import cookieParser from "cookie-parser";
import express from "express";

import { PRODUCT_FEEDBACK_JSON_LIMIT } from "../infrastructure/http/ingress-limits";
import type { PrismaService } from "../infrastructure/prisma/prisma.service";
import { createNullLogger } from "../lib/logger";
import { createAuthenticatedFeedbackHandler } from "../modules/product-feedback/product-feedback.handler";
import { ProductFeedbackMemoryRepository } from "../modules/product-feedback/product-feedback.memory-repository";
import { createTestPrisma, disconnectTestPrisma } from "./prisma-test-helper";

const ORIGIN = "http://localhost:3000";

export async function startAgentationContractServer() {
  const prisma = createTestPrisma();
  const actors = ["lead", "lead", "admin"].map((role) => ({
    userId: randomUUID(),
    role: role as UserSession["role"],
    name: "Upstream contract",
    email: `${randomUUID()}@example.test`,
  }));
  await prisma.user.createMany({
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

  async function close() {
    await client.close();
    server.closeAllConnections();
    await new Promise<void>((done, reject) =>
      server.close((error) => (error ? reject(error) : done())),
    );
    await prisma.agentationSession.deleteMany({
      where: { authorUserId: { in: actors.map((actor) => actor.userId) } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: actors.map((actor) => actor.userId) } },
    });
    await disconnectTestPrisma();
  }
  try {
    await client.connect(transport, { timeout: 4000 });
  } catch (error) {
    await close();
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
  return { actors, prisma, client, request, close };
}
