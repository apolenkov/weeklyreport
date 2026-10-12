import type { AddressInfo } from "node:net";

import type { INestApplication } from "@nestjs/common";
import { TRPCError } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import {
  AUTH_COOKIE_NAME,
  DEFAULT_ORGANIZATION_IDENTITY,
  type UserSession,
} from "@weeklyreport/shared";
import cookieParser from "cookie-parser";
import express from "express";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createNullLogger } from "../../lib/logger.js";
import {
  AdminPrismaRepository,
  SnapshotAdminService,
} from "../../modules/admin/index.js";
import { createAuthController } from "../../modules/auth/index.js";
import { createNullAuditLogger } from "../../test-utils/audit-logger.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
  TEST_IDS,
} from "../../test-utils/prisma-test-helper.js";
import { createStubAppRouterDeps } from "../../test-utils/stub-app-router-deps.js";
import { createRequireHeadGuard } from "../bullmq/bull-board.module.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { createContextFactory } from "./trpc.context.js";
import { createAppRouter } from "./trpc.router.js";

// A head's session cookie must stop working as head the moment an admin
// demotes them: role comes from the database on every request, not from the
// JWT (jwt-session-integrity). Real DB, real cookie, real guard and context.
const env = {
  NODE_ENV: "test",
  AUTH_DEV_MODE: false,
  AUTH_JWT_SECRET: "role-demotion-session-secret-0123456789",
  PDF_EXPORT_JWT_SECRET: "role-demotion-pdf-export-secret-0123456789",
} as const;
const ADMIN_ID = "a0000000-0000-4000-a000-0000000000ad";

const prisma = createTestPrisma();
const notRevoked = { isRevoked: () => Promise.resolve(false) };
const nestApp = {
  get: (token: unknown) => (token === PrismaService ? prisma : notRevoked),
} as unknown as INestApplication;

const headSession: UserSession = {
  userId: TEST_IDS.head,
  email: "head@test.local",
  name: "Test Head",
  role: "head",
  reportingGroupId: TEST_IDS.group,
  activeReportId: null,
  activeReportSectionId: null,
};

async function queuesStatus(cookie: string): Promise<number> {
  const app = express();
  app.disable("x-powered-by");
  app.use(cookieParser());
  app.use(
    "/admin/queues",
    createRequireHeadGuard({
      verifySessionToken: (t) =>
        createAuthController(env).verifySessionToken(t),
      prisma: prisma as unknown as PrismaService,
      sessionRevocation: notRevoked,
      sessionCookieName: AUTH_COOKIE_NAME,
    }),
    (_req, res) => {
      res.sendStatus(200);
    },
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const { port } = server.address() as AddressInfo;
    const response = await fetch(
      `http://127.0.0.1:${String(port)}/admin/queues`,
      {
        headers: { cookie },
      },
    );
    return response.status;
  } finally {
    server.close();
  }
}

describe("role demotion takes effect on an existing session cookie (integration)", () => {
  beforeEach(async () => {
    await cleanDatabase();
    await seedTestData(prisma);
    await prisma.organization.create({
      data: { id: "singleton", ...DEFAULT_ORGANIZATION_IDENTITY },
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("rejects the demoted head's cookie on headProcedure and /admin/queues", async () => {
    const { token } = createAuthController(env).issueSessionCookie(headSession);
    const cookie = `${AUTH_COOKIE_NAME}=${token}`;
    const createContext = createContextFactory(
      nestApp,
      createNullLogger(),
      env,
    );
    const headCall = async () => {
      const ctx = await createContext({
        req: { cookies: { [AUTH_COOKIE_NAME]: token }, headers: {} },
      } as unknown as CreateExpressContextOptions);
      return createAppRouter(
        createStubAppRouterDeps({
          prisma,
          activityService: { getLiveActivity: () => Promise.resolve([]) },
        }),
      )
        .createCaller(ctx)
        .activity.live();
    };

    // Control: while still a head, the same cookie is accepted on both paths.
    await expect(headCall()).resolves.toEqual([]);
    await expect(queuesStatus(cookie)).resolves.toBe(200);

    const admin = createAppRouter(
      createStubAppRouterDeps({
        prisma,
        snapshotAdminService: new SnapshotAdminService(
          new AdminPrismaRepository(prisma as never),
          createNullLogger(),
        ),
      }),
    ).createCaller({
      session: {
        ...headSession,
        userId: ADMIN_ID,
        email: "admin@test.local",
        role: "admin",
      },
      logger: createNullLogger(),
      auditLogger: createNullAuditLogger(),
      ip: "test-ip",
      isPdfExport: false,
      pdfReportId: null,
    });
    await admin.admin.saveUser({
      id: TEST_IDS.head,
      email: "head@test.local",
      name: "Test Head",
      lastName: "Test",
      firstName: "Head",
      middleName: null,
      position: null,
      role: "lead",
      reportingGroupId: TEST_IDS.group,
      isActive: true,
    });

    await expect(headCall()).rejects.toMatchObject({
      constructor: TRPCError,
      code: "FORBIDDEN",
    });
    await expect(queuesStatus(cookie)).resolves.toBe(403);
  });
});
