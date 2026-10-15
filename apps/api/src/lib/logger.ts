import { createWriteStream, mkdirSync, type WriteStream } from "node:fs";
import { join, resolve } from "node:path";

import { trace } from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import { ClsService } from "nestjs-cls";
import { z } from "zod";

import { NO_CORRELATION_ID } from "./actor-sentinels.js";

// Single source of truth for the log-level domain: the env schema validates
// `LOG_LEVEL` with this exact enum, so logger-accepted and env-accepted values
// can never drift.
export const logLevelSchema = z.enum(["debug", "info", "warn", "error"]);
type LogLevel = z.infer<typeof logLevelSchema>;

export interface AppLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): AppLogger;
  // Drains the log file; rejects if a write failed. Omit for loggers
  // without a log file.
  flush?: () => Promise<void>;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId: string;
  traceId?: string;
  spanId?: string;
  [key: string]: unknown;
}

// Context keys whose values are personal data and must never reach a log sink.
// Matched by exact key name so new PII is opted in by adding it here, not by a
// fragile substring heuristic. Org keys (`fullName`/`shortName`) stay absent.
const PII_CONTEXT_KEYS: ReadonlySet<string> = new Set([
  "recipientEmail",
  "email",
  "leadName",
  "headName",
  "userName",
  "displayName",
  "firstName",
  "lastName",
  "middleName",
]);
const REDACTION_MARKER = "[redacted]";

function redactPiiValue(
  value: unknown,
  copies: WeakMap<object, unknown>,
): unknown {
  if (value === null || typeof value !== "object") return value;
  const existing = copies.get(value);
  if (existing !== undefined) return existing;
  if (Array.isArray(value)) {
    const copy: unknown[] = value.slice();
    copies.set(value, copy);
    value.forEach((entry, index) => {
      copy[index] = redactPiiValue(entry, copies);
    });
    return copy;
  }
  // Opaque values retain their existing serialization, including Date and Error.
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;
  const copy = Object.fromEntries(Object.entries(value));
  copies.set(value, copy);
  for (const [key, entry] of Object.entries(value)) {
    copy[key] = PII_CONTEXT_KEYS.has(key)
      ? REDACTION_MARKER
      : redactPiiValue(entry, copies);
  }
  return copy;
}

function redactPiiContext(
  context: Record<string, unknown>,
): Record<string, unknown> {
  const copies = new WeakMap<object, unknown>();
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      key,
      PII_CONTEXT_KEYS.has(key)
        ? REDACTION_MARKER
        : redactPiiValue(value, copies),
    ]),
  );
}

// Canonical event fields a caller-supplied context must never be able to
// overwrite: timestamp/level/message/correlationId are the entry's identity,
// and traceId/spanId come from the active OTel span.
const RESERVED_CONTEXT_KEYS: ReadonlySet<string> = new Set([
  "timestamp",
  "level",
  "message",
  "correlationId",
  "traceId",
  "spanId",
]);

function stripReservedContext(
  context: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(context).filter(([key]) => !RESERVED_CONTEXT_KEYS.has(key)),
  );
}

// A caller-supplied context holding BigInt or circular values must not
// turn logging itself into a crash path — degrade to the envelope.
function serializeEntry(entry: LogEntry): string {
  try {
    return JSON.stringify(entry);
  } catch {
    return JSON.stringify({
      timestamp: entry.timestamp,
      level: entry.level,
      message: entry.message,
      correlationId: entry.correlationId,
      contextSerializationFailed: true,
    });
  }
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_SEVERITY: Record<LogLevel, SeverityNumber> = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};

// Consumer default for callers that omit `minLevel`; every production
// construction passes the validated LOG_LEVEL explicitly, so this covers only
// ad-hoc loggers built without a config in reach.
const DEFAULT_MIN_LEVEL: LogLevel = "info";

// Local-dev app.log: one append stream per directory, shared by every logger
// in the process. No rotation; production relies on Docker's stdout rotation.
const logStreams = new Map<string, WriteStream>();

function logStreamFor(logDir: string): WriteStream {
  const dir = resolve(logDir);
  const existing = logStreams.get(dir);
  // A failed fs stream auto-destroys; reopen rather than write into it.
  if (existing !== undefined && !existing.destroyed) return existing;
  mkdirSync(dir, { recursive: true });
  const stream = createWriteStream(join(dir, "app.log"), { flags: "a" });
  stream.on("error", (error) => {
    process.stderr.write(`[logger] file write failed: ${String(error)}\n`);
  });
  logStreams.set(dir, stream);
  return stream;
}

export interface LoggerOptions {
  readonly minLevel?: LogLevel | undefined;
  // Omit to disable file logging.
  readonly logDir?: string | undefined;
  readonly service?: string | undefined;
  // Reads correlationId from CLS; NO_CORRELATION_ID outside an active scope.
  readonly clsService?: ClsService | undefined;
}

class AppLoggerImpl implements AppLogger {
  private readonly minPriority: number;
  private readonly minLevel: LogLevel;
  private readonly baseContext: Record<string, unknown>;
  private readonly logDir: string | undefined;
  private readonly clsService: ClsService | undefined;

  constructor(
    options: LoggerOptions,
    baseContext: Record<string, unknown> = {},
    openSink = true,
  ) {
    this.minLevel = options.minLevel ?? DEFAULT_MIN_LEVEL;
    this.minPriority = LEVEL_PRIORITY[this.minLevel];
    this.logDir = options.logDir;
    this.clsService = options.clsService;
    this.baseContext = {
      ...(options.service ? { service: options.service } : {}),
      ...baseContext,
    };

    // A configured LOG_DIR fails closed here; children reuse the parent's sink.
    if (openSink && this.logDir !== undefined) logStreamFor(this.logDir);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.emit("debug", message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.emit("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.emit("warn", message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.emit("error", message, context);
  }

  child(context: Record<string, unknown>): AppLogger {
    return new AppLoggerImpl(
      {
        minLevel: this.minLevel,
        logDir: this.logDir,
        clsService: this.clsService,
      },
      { ...this.baseContext, ...context },
      false,
    );
  }

  // An empty write completes only after every earlier write; its callback
  // carries the stream's error, if any.
  flush = (): Promise<void> => {
    // The current registry entry, without reopening: a failed sink rejects.
    const stream =
      this.logDir === undefined
        ? undefined
        : logStreams.get(resolve(this.logDir));
    if (stream === undefined) return Promise.resolve();
    return new Promise((done, fail) => {
      stream.write("", (error) => {
        if (error) fail(error);
        else done();
      });
    });
  };

  // A reopen failure must not throw out of a log call; stdout keeps the entry.
  private fileSink(): WriteStream | undefined {
    if (this.logDir === undefined) return undefined;
    try {
      return logStreamFor(this.logDir);
    } catch (error) {
      process.stderr.write(`[logger] file reopen failed: ${String(error)}\n`);
      return undefined;
    }
  }

  private resolveCorrelationId(): string {
    const cls = this.clsService;
    if (cls?.isActive()) {
      const value: unknown = cls.get("correlationId");
      return typeof value === "string" ? value : NO_CORRELATION_ID;
    }
    return NO_CORRELATION_ID;
  }

  private emit(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    if (LEVEL_PRIORITY[level] < this.minPriority) {
      return;
    }

    const mergedContext = redactPiiContext({
      ...this.baseContext,
      ...context,
    });

    const spanCtx = trace.getActiveSpan()?.spanContext();
    const spanFields =
      spanCtx && trace.isSpanContextValid(spanCtx)
        ? { traceId: spanCtx.traceId, spanId: spanCtx.spanId }
        : {};

    const entry: LogEntry = {
      ...stripReservedContext(mergedContext),
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: this.resolveCorrelationId(),
      ...spanFields,
    };

    const formatted = serializeEntry(entry);

    if (level === "error") {
      process.stderr.write(`${formatted}\n`);
    } else {
      process.stdout.write(`${formatted}\n`);
    }

    // Fire-and-forget; a failed write surfaces through flush().
    this.fileSink()?.write(`${formatted}\n`);

    // Forward to OTel log provider (no-op when provider not registered).
    logs.getLogger("weeklyreport-api").emit({
      body: message,
      severityNumber: LEVEL_SEVERITY[level],
      severityText: level,
      attributes: {
        ...stripReservedContext(mergedContext),
        correlationId: entry.correlationId,
        ...(entry.traceId ? { traceId: entry.traceId } : {}),
        ...(entry.spanId ? { spanId: entry.spanId } : {}),
      },
    });
  }
}

const nullLogger: AppLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  child: () => nullLogger,
  flush: () => Promise.resolve(),
};

export function createAppLogger(options: LoggerOptions = {}): AppLogger {
  return new AppLoggerImpl(options);
}

export function createNullLogger(): AppLogger {
  return nullLogger;
}
