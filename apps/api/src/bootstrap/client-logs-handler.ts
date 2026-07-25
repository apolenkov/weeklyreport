import type { Request, RequestHandler, Response } from "express";

import type { AppLogger } from "../lib/logger";

const NO_CONTENT = 204;

// Bounds on the client-log forwarder payload — a misbehaving browser tab must
// not be able to grow one log line, or the batch, without limit.
const MAX_CLIENT_LOG_BATCH_SIZE = 100;
const MAX_CLIENT_LOG_MESSAGE_LENGTH = 2000;
const MAX_CLIENT_LOG_SOURCE_LENGTH = 64;
const MAX_CLIENT_LOG_URL_LENGTH = 500;
const MAX_CLIENT_LOG_STACK_LENGTH = 4000;
const MAX_CLIENT_LOG_USER_AGENT_LENGTH = 200;

type ClientLogLevel = "debug" | "info" | "warn" | "error";

function coerceLevel(value: unknown): ClientLogLevel {
  return value === "debug" ||
    value === "info" ||
    value === "warn" ||
    value === "error"
    ? value
    : "info";
}

function clampString(value: unknown, max: number): string | undefined {
  return typeof value === "string" ? value.slice(0, max) : undefined;
}

// Browser → server log forwarder. Captures console.error/warn, window.onerror
// and unhandledrejection from the web app into the same rotating app.log so all
// debug data lives in one file. `enabled` is dev-only by default.
/**
 * Create Client Logs Handler.
 * @param deps - The deps argument.
 */
export function createClientLogsHandler(deps: {
  logger: AppLogger;
  enabled: boolean;
}): RequestHandler {
  const { logger, enabled } = deps;
  return (req: Request, res: Response) => {
    if (!enabled) {
      res.sendStatus(NO_CONTENT);
      return;
    }
    const body = req.body as { entries?: unknown };
    const entries = Array.isArray(body.entries) ? body.entries : [];
    for (const raw of entries.slice(0, MAX_CLIENT_LOG_BATCH_SIZE)) {
      if (!raw || typeof raw !== "object") continue;
      const e = raw as Record<string, unknown>;
      const level = coerceLevel(e.level);
      const message =
        typeof e.message === "string"
          ? e.message.slice(0, MAX_CLIENT_LOG_MESSAGE_LENGTH)
          : "<non-string>";
      logger[level](`client: ${message}`, {
        phase: "web.client",
        source: clampString(e.source, MAX_CLIENT_LOG_SOURCE_LENGTH),
        url: clampString(e.url, MAX_CLIENT_LOG_URL_LENGTH),
        stack: clampString(e.stack, MAX_CLIENT_LOG_STACK_LENGTH),
        ts: e.ts,
        ua: req.get("user-agent")?.slice(0, MAX_CLIENT_LOG_USER_AGENT_LENGTH),
        ip: req.ip,
      });
    }
    res.sendStatus(NO_CONTENT);
  };
}
