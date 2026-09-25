import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import type { INestApplication } from "@nestjs/common";
import type { Request, RequestHandler, Response } from "express";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../infrastructure/prisma/prisma.service";
import type { AppLogger } from "../lib/logger";
import type { AutoCarryOverOutcome } from "../modules/carry-over/index.js";

vi.mock("../modules/auth/index.js", () => ({
  createAuthController: vi.fn(() => ({})),
  createSamlStrategy: vi.fn(),
  createSamlStrategyOptions: vi.fn(),
  hasSamlEnv: vi.fn(() => false),
  mountAuthRoutes: vi.fn(),
}));

vi.mock("./lead-workspace-provisioner", () => ({
  createProvisionLeadWorkspace: vi.fn(() => vi.fn()),
}));

vi.mock("../lib/audit-logger", () => ({
  createAuditLogger: vi.fn(() => ({})),
}));

import { mountAuthRoutes as mockedMountAuthRoutes } from "../modules/auth/index.js";
import { mountAuthIngress } from "./auth-ingress.js";

let terminalHits: string[] = [];

function createLogger(): AppLogger {
  const logger: AppLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => logger,
  };
  return logger;
}

async function listen(app: express.Express): Promise<Server> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  return server;
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

beforeEach(() => {
  terminalHits = [];
  vi.mocked(mockedMountAuthRoutes).mockImplementation((expressApp) => {
    expressApp.get("/auth/dev-login", (_req, res) => {
      terminalHits.push("dev-login");
      res.sendStatus(200);
    });
    expressApp.post("/auth/logout", (_req, res) => {
      terminalHits.push("logout");
      res.sendStatus(200);
    });
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("mountAuthIngress", () => {
  it.each([
    ["GET", "/auth/dev-login", "dev-login"],
    ["POST", "/auth/logout", "logout"],
  ] as const)(
    "rate-limits %s %s before the terminal handler",
    async (method, path, terminal) => {
      const app = express();
      const limiterPaths: string[] = [];
      const authLimiter = vi.fn<RequestHandler>(
        (req: Request, res: Response) => {
          limiterPaths.push(req.path);
          res.status(429).send("rate limited");
        },
      );
      const autoCarryOver = vi.fn(
        (targetReportId: string): Promise<AutoCarryOverOutcome> =>
          Promise.resolve({
            status: "skipped",
            targetReportId,
            reason: "no-prior-period",
          }),
      );

      mountAuthIngress({
        app: {} as INestApplication,
        expressApp: app,
        logger: createLogger(),
        prisma: {} as PrismaService,
        autoCarryOver,
        authLimiter,
      });

      const server = await listen(app);
      const { port } = server.address() as AddressInfo;

      try {
        const response = await fetch(`http://127.0.0.1:${port}${path}`, {
          method,
        });

        expect(response.status).toBe(429);
        expect(limiterPaths).toEqual([path.slice("/auth".length)]);
        expect(terminalHits).not.toContain(terminal);
      } finally {
        await close(server);
      }
    },
  );
});
