import type { INestApplication } from "@nestjs/common";
import type { Express, RequestHandler } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EnvConfig } from "../infrastructure/config/env.schema";
import type { PrismaService } from "../infrastructure/prisma/prisma.service";
import type { AppRouter } from "../infrastructure/trpc/trpc.router";
import type { AppLogger } from "../lib/logger";

vi.mock("node:fs", () => ({ mkdirSync: vi.fn() }));
vi.mock("@trpc/server/adapters/express", () => ({
  createExpressMiddleware: vi.fn(() => vi.fn()),
}));
vi.mock("../infrastructure/trpc/trpc.context", () => ({
  createContextFactory: vi.fn(() => vi.fn()),
}));
vi.mock("../modules/admin/index.js", () => ({
  SessionRevocationService: vi.fn(),
}));
vi.mock("../modules/auth/index.js", () => ({
  createAuthController: vi.fn(() => ({ verifySessionToken: vi.fn() })),
}));
vi.mock("../modules/pdf-export/index.js", () => ({
  createPdfDownloadHandler: vi.fn(() => vi.fn()),
}));
vi.mock("../modules/product-feedback/index.js", () => ({
  createAuthenticatedFeedbackHandler: vi.fn(() => ({
    authenticate: vi.fn(),
    handle: vi.fn(),
  })),
  ProductFeedbackPrismaRepository: vi.fn(),
}));

import { createAuthenticatedFeedbackHandler } from "../modules/product-feedback/index.js";
import { mountApiIngress } from "./api-ingress.js";

const FEEDBACK_ROUTE = "/api/v1";

function mount(env: Partial<EnvConfig>): ReturnType<typeof vi.fn> {
  const use = vi.fn();
  const logger: AppLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => logger,
  };
  const limiter: RequestHandler = vi.fn();
  mountApiIngress({
    app: { get: vi.fn(() => ({})) } as unknown as INestApplication,
    expressApp: { get: vi.fn(), use } as unknown as Express,
    env: { PDF_OUTPUT_DIR: "pdfs-test", ...env } as EnvConfig,
    logger,
    prisma: {} as PrismaService,
    appRouter: {} as AppRouter,
    trpcLimiter: limiter,
    vitalsLimiter: limiter,
    feedbackLimiter: limiter,
  });
  return use;
}

const mountedRoutes = (use: ReturnType<typeof vi.fn>): unknown[] =>
  use.mock.calls.map((call: unknown[]) => call[0]);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("mountApiIngress product-feedback ingress", () => {
  it("mounts when enabled outside production", () => {
    const use = mount({
      PRODUCT_FEEDBACK_ENABLED: true,
      NODE_ENV: "development",
    });
    expect(mountedRoutes(use)).toContain(FEEDBACK_ROUTE);
    expect(createAuthenticatedFeedbackHandler).toHaveBeenCalledOnce();
  });

  it("is not mounted when NODE_ENV=production, even if enabled", () => {
    const use = mount({
      PRODUCT_FEEDBACK_ENABLED: true,
      NODE_ENV: "production",
    });
    expect(mountedRoutes(use)).not.toContain(FEEDBACK_ROUTE);
    expect(createAuthenticatedFeedbackHandler).not.toHaveBeenCalled();
    expect(mountedRoutes(use)).toContain("/trpc");
  });
});
