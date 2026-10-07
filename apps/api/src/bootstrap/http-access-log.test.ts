import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { metricsRegistry } from "../infrastructure/metrics/metrics.registry.js";
import type { AppLogger } from "../lib/logger.js";
import {
  ADMIN_QUEUES_ROUTE,
  CLIENT_LOGS_ROUTE,
  createHttpAccessLog,
  normalizeHttpRoute,
  PDF_DOWNLOAD_ROUTE,
  UNKNOWN_HTTP_ROUTE,
} from "./http-access-log.js";

describe("normalizeHttpRoute", () => {
  it.each([
    ["/health", "/health"],
    ["/health/live", "/health/live"],
    ["/health/ready", "/health/ready"],
    ["/health/arbitrary", "/health/*"],
    ["/auth/saml/callback", "/auth/*"],
    ["/pdfs/report-secret.pdf", PDF_DOWNLOAD_ROUTE],
    ["/admin/queues", ADMIN_QUEUES_ROUTE],
    ["/admin/queues/api/jobs/123", ADMIN_QUEUES_ROUTE],
    [CLIENT_LOGS_ROUTE, CLIENT_LOGS_ROUTE],
    ["/metrics", "/metrics"],
  ])("maps %s to the bounded route label %s", (path, expected) => {
    expect(normalizeHttpRoute(path)).toBe(expected);
  });

  it("collapses arbitrary non-UUID paths to one bounded fallback", () => {
    const routes = new Set(
      Array.from({ length: 100 }, (_, index) =>
        normalizeHttpRoute(`/attacker-controlled/${String(index)}`),
      ),
    );

    expect(routes).toEqual(new Set([UNKNOWN_HTTP_ROUTE]));
  });
});

describe("createHttpAccessLog — tRPC mount boundary", () => {
  function createLogger(): AppLogger & { warn: ReturnType<typeof vi.fn> } {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
    };
    logger.child.mockReturnValue(logger);
    return logger;
  }

  async function listen(app: express.Express): Promise<Server> {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    return server;
  }

  async function close(server: Server): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  const buildApp = (logger: AppLogger): express.Express => {
    const app = express();
    app.use(createHttpAccessLog(logger));
    // Express mount semantics: "/trpc" covers /trpc and /trpc/*, nothing else.
    app.use("/trpc", (_req, res) => {
      res.sendStatus(200);
    });
    return app;
  };

  beforeEach(() => {
    metricsRegistry.resetMetrics();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips adapter-owned /trpc and /trpc/* requests", async () => {
    const logger = createLogger();
    const server = await listen(buildApp(logger));
    const { port } = server.address() as AddressInfo;
    const get = (path: string): Promise<Response> =>
      fetch(`http://127.0.0.1:${port}${path}`);

    try {
      await expect(get("/trpc")).resolves.toMatchObject({ status: 200 });
      await expect(get("/trpc/report.byId")).resolves.toMatchObject({
        status: 200,
      });

      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
      expect(await metricsRegistry.metrics()).not.toContain(
        'route="/unmatched"',
      );
    } finally {
      await close(server);
    }
  });

  it("envelopes /trpcFoo and /trpc-admin once each as /unmatched 404", async () => {
    const logger = createLogger();
    const server = await listen(buildApp(logger));
    const { port } = server.address() as AddressInfo;
    const get = (path: string): Promise<Response> =>
      fetch(`http://127.0.0.1:${port}${path}`);

    try {
      await expect(get("/trpcFoo")).resolves.toMatchObject({ status: 404 });
      await expect(get("/trpc-admin")).resolves.toMatchObject({ status: 404 });

      const envelopes = vi
        .mocked(logger.warn)
        .mock.calls.filter(
          ([, fields]) =>
            (fields as { path?: string }).path === UNKNOWN_HTTP_ROUTE,
        );
      expect(envelopes).toHaveLength(2);
      expect(envelopes[0]?.[1]).toMatchObject({
        method: "GET",
        path: UNKNOWN_HTTP_ROUTE,
        status: 404,
      });
      const metrics = await metricsRegistry.metrics();
      expect(
        metrics
          .split("\n")
          .filter((line) =>
            line.startsWith("http_request_duration_seconds_count"),
          ),
      ).toEqual([
        'http_request_duration_seconds_count{method="GET",route="/unmatched",status_code="404"} 2',
      ]);
    } finally {
      await close(server);
    }
  });
});
