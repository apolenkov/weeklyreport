import { MS_PER_SECOND } from "@customreport/shared";
import type { NextFunction, Request, RequestHandler, Response } from "express";

import { httpRequestDurationSeconds } from "../infrastructure/metrics/metrics.registry";
import type { AppLogger } from "../lib/logger";

export const PDF_DOWNLOAD_ROUTE = "/pdfs/:file";
export const CLIENT_LOGS_ROUTE = "/api/client-logs";
export const ADMIN_QUEUES_ROUTE = "/admin/queues/*";
export const UNKNOWN_HTTP_ROUTE = "/unmatched";

const SERVER_ERROR_THRESHOLD = 500;
const CLIENT_ERROR_THRESHOLD = 400;

const EXACT_HTTP_ROUTES = new Map<string, string>([
  ["/health", "/health"],
  ["/health/live", "/health/live"],
  ["/health/ready", "/health/ready"],
  ["/admin/queues", ADMIN_QUEUES_ROUTE],
  ["/metrics", "/metrics"],
  [CLIENT_LOGS_ROUTE, CLIENT_LOGS_ROUTE],
]);

const HTTP_ROUTE_PREFIXES = [
  { prefix: "/pdfs/", route: PDF_DOWNLOAD_ROUTE },
  { prefix: "/auth/", route: "/auth/*" },
  { prefix: "/health/", route: "/health/*" },
  { prefix: "/admin/queues/", route: ADMIN_QUEUES_ROUTE },
] as const;

export function normalizeHttpRoute(path: string): string {
  return (
    EXACT_HTTP_ROUTES.get(path) ??
    HTTP_ROUTE_PREFIXES.find(({ prefix }) => path.startsWith(prefix))?.route ??
    UNKNOWN_HTTP_ROUTE
  );
}

type AccessLogLevel = "error" | "warn" | "debug" | "info";

// 4xx/5xx → warn/error so they surface in info-level prod logs; health probes →
// debug (high-frequency, low signal); other 2xx/3xx → info so successful
// non-tRPC requests stay visible in prod.
function selectAccessLevel(
  status: number,
  isHealthPath: boolean,
): AccessLogLevel {
  if (status >= SERVER_ERROR_THRESHOLD) return "error";
  if (status >= CLIENT_ERROR_THRESHOLD) return "warn";
  return isHealthPath ? "debug" : "info";
}

// HTTP access log for everything outside the tRPC adapter (/auth, /pdfs,
// /health, /metrics, /admin/queues). tRPC has its own procedure-level
// middleware, so the /trpc mount is skipped here to avoid duplicate envelopes.
// The skip must match Express's mount semantics exactly: "/trpc" itself and
// "/trpc/…" are adapter-owned, while siblings like "/trpcFoo" are ordinary
// unmatched routes that still need an access envelope and a histogram sample.
const isTrpcPath = (path: string): boolean =>
  path === "/trpc" || path.startsWith("/trpc/");

export function createHttpAccessLog(logger: AppLogger): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (isTrpcPath(req.path)) {
      next();
      return;
    }
    const start = performance.now();
    res.on("finish", () => {
      const duration = Math.round(performance.now() - start);
      const status = res.statusCode;
      const isHealthPath =
        req.path === "/health" || req.path.startsWith("/health/");
      const level = selectAccessLevel(status, isHealthPath);
      const route = normalizeHttpRoute(req.path);
      logger[level]("http request", {
        phase: "http.request",
        method: req.method,
        path: route,
        status,
        duration,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });
      httpRequestDurationSeconds.observe(
        {
          method: req.method,
          route,
          status_code: String(status),
        },
        duration / MS_PER_SECOND,
      );
    });
    next();
  };
}
