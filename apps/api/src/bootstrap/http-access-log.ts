import { MS_PER_SECOND } from "@customreport/shared";
import type { NextFunction, Request, RequestHandler, Response } from "express";

import { httpRequestDurationSeconds } from "../infrastructure/metrics/metrics.registry";
import type { AppLogger } from "../lib/logger";

export const PDF_DOWNLOAD_ROUTE = "/pdfs/:file";
export const CLIENT_LOGS_ROUTE = "/api/client-logs";

const SERVER_ERROR_THRESHOLD = 500;
const CLIENT_ERROR_THRESHOLD = 400;

const UUID_SEGMENT_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

function normalizeHttpRoute(path: string): string {
  if (path.startsWith("/pdfs/")) return PDF_DOWNLOAD_ROUTE;
  if (path.startsWith("/auth/")) return "/auth/*";
  if (path.startsWith("/health/")) return path;
  if (path === "/metrics") return "/metrics";
  if (path === CLIENT_LOGS_ROUTE) return CLIENT_LOGS_ROUTE;
  return path.replaceAll(UUID_SEGMENT_RE, ":id");
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
// middleware, so /trpc/* is skipped here to avoid duplicate envelopes.
/**
 * Create Http Access Log.
 * @param logger - The logger argument.
 */
export function createHttpAccessLog(logger: AppLogger): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/trpc")) {
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
      logger[level]("http request", {
        phase: "http.request",
        method: req.method,
        path: req.path,
        status,
        duration,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });
      httpRequestDurationSeconds.observe(
        {
          method: req.method,
          route: normalizeHttpRoute(req.path),
          status_code: String(status),
        },
        duration / MS_PER_SECOND,
      );
    });
    next();
  };
}
