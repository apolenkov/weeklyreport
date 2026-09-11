import { existsSync, mkdirSync } from "node:fs";

import { trace } from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import { ClsService } from "nestjs-cls";
import { z } from "zod";

import { NO_CORRELATION_ID } from "./actor-sentinels.js";
import { type FileSink, processFileSink } from "./logger-file-sink.js";

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
  // Drains the file sink; rejects if any pending write failed. Omit for
  // loggers without a file sink.
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

function redactPiiContext(
  context: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) =>
      PII_CONTEXT_KEYS.has(key) ? [key, REDACTION_MARKER] : [key, value],
    ),
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
const DEFAULT_MAX_BYTES_MB = 50;
const BYTES_PER_KB = 1024;
const KB_PER_MB = 1024;
const DEFAULT_MAX_BYTES = DEFAULT_MAX_BYTES_MB * KB_PER_MB * BYTES_PER_KB;
const DEFAULT_MAX_AGE_DAYS = 30;

export interface LoggerOptions {
  readonly minLevel?: LogLevel | undefined;
  // Omit to disable file logging.
  readonly logDir?: string | undefined;
  readonly service?: string | undefined;
  // Reads correlationId from CLS; NO_CORRELATION_ID outside an active scope.
  readonly clsService?: ClsService | undefined;
  readonly maxBytes?: number | undefined;
  readonly maxAgeDays?: number | undefined;
}

class AppLoggerImpl implements AppLogger {
  private readonly minPriority: number;
  private readonly minLevel: LogLevel;
  private readonly baseContext: Record<string, unknown>;
  private readonly logDir: string | undefined;
  private readonly clsService: ClsService | undefined;
  private readonly maxBytes: number;
  private readonly maxAgeDays: number;
  private readonly fileSink: FileSink | undefined;

  constructor(
    options: LoggerOptions,
    baseContext: Record<string, unknown> = {},
    inheritedSink?: FileSink,
  ) {
    this.minLevel = options.minLevel ?? DEFAULT_MIN_LEVEL;
    this.minPriority = LEVEL_PRIORITY[this.minLevel];
    this.logDir = options.logDir;
    this.clsService = options.clsService;
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    this.maxAgeDays = options.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;
    this.baseContext = {
      ...(options.service ? { service: options.service } : {}),
      ...baseContext,
    };

    if (this.logDir && !existsSync(this.logDir)) {
      // Acceptable sync call: runs once at construction, not on the hot path.
      mkdirSync(this.logDir, { recursive: true });
    }

    if (inheritedSink) {
      this.fileSink = inheritedSink;
    } else if (this.logDir) {
      this.fileSink = processFileSink(this.logDir, {
        maxBytes: this.maxBytes,
        maxAgeDays: this.maxAgeDays,
      });
    }
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
        maxBytes: this.maxBytes,
        maxAgeDays: this.maxAgeDays,
      },
      { ...this.baseContext, ...context },
      this.fileSink,
    );
  }

  flush = async (): Promise<void> => {
    await this.fileSink?.flush();
  };

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

    const formatted = JSON.stringify(entry);

    if (level === "error") {
      process.stderr.write(`${formatted}\n`);
    } else {
      process.stdout.write(`${formatted}\n`);
    }

    if (this.fileSink) {
      // Fire-and-forget; the sink serializes writes and records failures for flush.
      this.fileSink.enqueue(entry);
    }

    // Forward to OTel log provider (no-op when provider not registered).
    logs.getLogger("customreport-api").emit({
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
