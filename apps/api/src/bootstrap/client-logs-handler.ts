import type { Request, RequestHandler, Response } from "express";
import { z } from "zod";

import { type AppLogger, logLevelSchema } from "../lib/logger";

const NO_CONTENT = 204;

// Bounds on the client-log forwarder payload — a misbehaving browser tab must
// not be able to grow one log line, or the batch, without limit.
const MAX_CLIENT_LOG_BATCH_SIZE = 100;
const MAX_CLIENT_LOG_MESSAGE_LENGTH = 2000;
const MAX_CLIENT_LOG_URL_LENGTH = 500;
const MAX_CLIENT_LOG_STACK_LENGTH = 4000;
const MAX_CLIENT_LOG_USER_AGENT_LENGTH = 200;
const MAX_JAVASCRIPT_TIMESTAMP_MS = 8_640_000_000_000_000;

const clientLogEntrySchema = z
  .object({
    level: logLevelSchema,
    message: z.string().max(MAX_CLIENT_LOG_MESSAGE_LENGTH),
    source: z.enum(["console", "window-error", "unhandled-rejection"]),
    url: z.string().max(MAX_CLIENT_LOG_URL_LENGTH).optional(),
    stack: z.string().max(MAX_CLIENT_LOG_STACK_LENGTH).optional(),
    ts: z.number().int().nonnegative().max(MAX_JAVASCRIPT_TIMESTAMP_MS),
  })
  .strict();
type ClientLogEntry = z.infer<typeof clientLogEntrySchema>;

export function parseClientLogEntry(value: unknown): ClientLogEntry | null {
  const result = clientLogEntrySchema.safeParse(value);
  return result.success ? result.data : null;
}

// Browser → server log forwarder. Captures console.error/warn, window.onerror
// and unhandledrejection from the web app into the same rotating app.log so all
// debug data lives in one file. `enabled` is dev-only by default.
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
    const body: unknown = req.body;
    const rawEntries =
      body !== null &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      "entries" in body &&
      Array.isArray(body.entries)
        ? body.entries
        : [];
    const entries = rawEntries
      .slice(0, MAX_CLIENT_LOG_BATCH_SIZE)
      .map(parseClientLogEntry)
      .filter((entry) => entry !== null);

    entries.forEach((entry) => {
      logger[entry.level](`client: ${entry.message}`, {
        phase: "web.client",
        source: entry.source,
        url: entry.url,
        stack: entry.stack,
        ts: entry.ts,
        ua: req.get("user-agent")?.slice(0, MAX_CLIENT_LOG_USER_AGENT_LENGTH),
        ip: req.ip,
      });
    });
    res.sendStatus(NO_CONTENT);
  };
}
