import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { IncomingHttpHeaders, Server } from "node:http";
import { request } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AUTH_COOKIE_NAME, type UserSession } from "@customreport/shared";
import type { INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";
import express, { type RequestHandler } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EnvConfig } from "../infrastructure/config/env.schema";
import type { PrismaService } from "../infrastructure/prisma/prisma.service";
import type { AppRouter } from "../infrastructure/trpc/trpc.router";
import { createNullLogger } from "../lib/logger";
import { createAuthController } from "../modules/auth/index";
import { mountApiIngress } from "./api-ingress";

const JOB_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const AUTH_JWT_SECRET = "pdf-download-route-session-secret-123";

const session: UserSession = {
  userId: USER_ID,
  email: "head@example.test",
  name: "Head One",
  role: "head",
  activeReportId: null,
  activeReportSectionId: null,
};

interface HttpResponse {
  status: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
}

interface PdfJob {
  status: string;
  filePath: string;
  reportId: string;
  generation: number;
  requestedBy: string;
}

interface Fixture {
  app: express.Express;
  root: string;
  cookie: string;
  findJob: ReturnType<typeof vi.fn>;
}

async function listen(app: express.Express): Promise<Server> {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  return server;
}

function close(server: Server): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function get(
  port: number,
  path: string,
  cookie?: string,
): Promise<HttpResponse> {
  return new Promise<HttpResponse>((resolve, reject) => {
    const clientReq = request(
      {
        host: "127.0.0.1",
        port,
        path,
        method: "GET",
        ...(cookie ? { headers: { cookie } } : {}),
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
        res.on("error", reject);
      },
    );
    clientReq.on("error", reject);
    clientReq.end();
  });
}

function makeFixture(job: PdfJob | null): Fixture {
  const root = mkdtempSync(join(tmpdir(), "pdf-download-route-"));
  const pdfDir = join(root, "pdfs");
  mkdirSync(pdfDir);
  const findJob = vi.fn(() => Promise.resolve(job));
  const prisma = {
    user: {
      findUnique: vi.fn(() => Promise.resolve({ isActive: true })),
    },
    organization: {
      findUnique: vi.fn(() =>
        Promise.resolve({ shortName: "PEO", fullName: "Product Team" }),
      ),
    },
    pdfExportJob: { findUnique: findJob },
  } as unknown as PrismaService;
  const sessionRevocation = { isRevoked: vi.fn(() => Promise.resolve(false)) };
  const nestApp = {
    get: () => sessionRevocation,
  } as unknown as INestApplication;
  const env = {
    AUTH_JWT_SECRET,
    FRONTEND_URL: "http://localhost:3000",
    NODE_ENV: "test",
    PDF_OUTPUT_DIR: pdfDir,
    PRODUCT_FEEDBACK_ENABLED: false,
  } as unknown as EnvConfig;
  const passThrough: RequestHandler = (_req, _res, next) => next();
  const app = express();
  app.disable("x-powered-by");
  app.use(cookieParser());

  mountApiIngress({
    app: nestApp,
    expressApp: app,
    env,
    logger: createNullLogger(),
    prisma,
    appRouter: {} as AppRouter,
    trpcLimiter: passThrough,
    vitalsLimiter: passThrough,
    feedbackLimiter: passThrough,
  });

  const authController = createAuthController(env);
  const cookieHeader =
    authController.issueSessionCookie(session).setCookieHeader;

  return {
    app,
    root,
    cookie: cookieHeader.split(";", 1)[0] ?? `${AUTH_COOKIE_NAME}=`,
    findJob,
  };
}

afterEach(() => {
  // Every fixture owns a unique temporary root; tests register their roots
  // here so an assertion or request failure cannot leave a PDF behind.
  for (const root of fixtureRoots) {
    rmSync(root, { recursive: true, force: true });
  }
  fixtureRoots.clear();
});

const fixtureRoots = new Set<string>();

function ownFixture(job: PdfJob | null): Fixture {
  const fixture = makeFixture(job);
  fixtureRoots.add(fixture.root);
  return fixture;
}

function completedJob(): PdfJob {
  return {
    status: "completed",
    filePath: `/pdfs/${JOB_ID}.pdf`,
    reportId: "33333333-3333-4333-8333-333333333333",
    generation: 1,
    requestedBy: USER_ID,
  };
}

describe("mounted PDF download ingress", () => {
  it("returns 401 before consulting the job store without a session cookie", async () => {
    const fixture = ownFixture(completedJob());
    const server = await listen(fixture.app);
    const { port } = server.address() as AddressInfo;

    try {
      const response = await get(port, `/pdfs/${JOB_ID}.pdf`);

      expect(response.status).toBe(401);
      expect(response.body).toEqual(Buffer.alloc(0));
      expect(fixture.findJob).not.toHaveBeenCalled();
    } finally {
      await close(server);
    }
  });

  it("returns 404 for an authenticated request whose job row is missing", async () => {
    const fixture = ownFixture(null);
    const server = await listen(fixture.app);
    const { port } = server.address() as AddressInfo;

    try {
      const response = await get(port, `/pdfs/${JOB_ID}.pdf`, fixture.cookie);

      expect(response.status).toBe(404);
      expect(response.body).toEqual(Buffer.alloc(0));
      expect(fixture.findJob).toHaveBeenCalledWith({
        where: { id: JOB_ID },
        select: {
          status: true,
          filePath: true,
          reportId: true,
          generation: true,
          requestedBy: true,
        },
      });
    } finally {
      await close(server);
    }
  });

  it("streams a completed PDF with 200 for the authenticated requester", async () => {
    const job = completedJob();
    const fixture = ownFixture(job);
    const bytes = Buffer.from("%PDF-1.7\nmounted-route-bytes");
    writeFileSync(
      join(fixture.root, "pdfs", `${JOB_ID}-g${job.generation}.pdf`),
      bytes,
    );
    const server = await listen(fixture.app);
    const { port } = server.address() as AddressInfo;

    try {
      const response = await get(port, `/pdfs/${JOB_ID}.pdf`, fixture.cookie);

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toBe("application/pdf");
      expect(response.headers["content-disposition"]).toBe("attachment");
      expect(response.body).toEqual(bytes);
    } finally {
      await close(server);
    }
  });
});
