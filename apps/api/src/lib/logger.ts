import { existsSync, mkdirSync } from "node:fs";
import { promises as fs, createReadStream, createWriteStream } from "node:fs";
import { join } from "node:path";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";

import type { ClsService } from "nestjs-cls";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface AppLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): AppLogger;
}

type LogEntry = {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId: string;
  [key: string]: unknown;
};

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const DEFAULT_MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const DEFAULT_MAX_AGE_DAYS = 30;
const ACTIVE_LOG_FILENAME = "app.log";
const ARCHIVE_PREFIX = "app.log.";
const ARCHIVE_SUFFIX = ".gz";

export type LoggerOptions = {
  /** Minimum log level to emit. Default: 'info'. */
  minLevel?: LogLevel;
  /** Directory for the active log file and gzip archives. If omitted, file logging is disabled. */
  logDir?: string;
  /**
   * Legacy: maximum number of files retained.
   * @deprecated use `maxAgeDays` instead. Retained only for back-compat;
   * `maxAgeDays` (default 30) takes precedence when both are set.
   */
  maxFiles?: number;
  /** Service name included in every log entry. */
  service?: string;
  /**
   * When provided, every log entry's correlationId is read from this CLS store
   * (key 'correlationId'). Falls back to 'no-context' outside an active scope.
   */
  clsService?: ClsService;
  /** Rotate threshold in bytes for the active log file. Default 50 MB. */
  maxBytes?: number;
  /** Archive retention in days (gzip files older than this are unlinked). Default 30. */
  maxAgeDays?: number;
};

type ResolvedFileOpts = {
  maxBytes: number;
  maxAgeDays: number;
};

// Serialize file work per-logger (per-process per-logDir really) so concurrent
// emit() calls do not interleave appendFile + rotation. Fire-and-forget at the
// call site is preserved by chaining onto a shared promise.
type FileSink = {
  logDir: string;
  opts: ResolvedFileOpts;
  queue: Promise<void>;
};

async function pruneOldArchives(
  logDir: string,
  maxAgeDays: number,
): Promise<void> {
  if (maxAgeDays < 0) return;
  const cutoff = Date.now() - maxAgeDays * 86_400_000;
  const entries = await fs.readdir(logDir).catch(() => [] as string[]);
  await Promise.all(
    entries
      .filter((f) => f.startsWith(ARCHIVE_PREFIX) && f.endsWith(ARCHIVE_SUFFIX))
      .map(async (f) => {
        const p = join(logDir, f);
        const st = await fs.stat(p).catch(() => null);
        if (!st) return;
        if (st.mtimeMs <= cutoff) {
          await fs.unlink(p).catch(() => undefined);
        }
      }),
  );
}

async function rotateIfNeeded(
  activePath: string,
  logDir: string,
  opts: ResolvedFileOpts,
): Promise<void> {
  const stats = await fs.stat(activePath).catch(() => null);
  if (!stats) return;
  if (stats.size < opts.maxBytes) {
    // Even when not rotating, take the chance to prune stale archives so a
    // long-lived process eventually drops old files.
    await pruneOldArchives(logDir, opts.maxAgeDays);
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archivePath = join(
    logDir,
    `${ARCHIVE_PREFIX}${stamp}${ARCHIVE_SUFFIX}`,
  );

  await pipeline(
    createReadStream(activePath),
    createGzip(),
    createWriteStream(archivePath),
  );
  // truncate keeps the inode/handle valid for any open writers and is faster
  // than unlink + recreate.
  await fs.truncate(activePath, 0);

  await pruneOldArchives(logDir, opts.maxAgeDays);
}

function enqueueWrite(sink: FileSink, entry: LogEntry): void {
  const activePath = join(sink.logDir, ACTIVE_LOG_FILENAME);
  sink.queue = sink.queue
    .then(() => rotateIfNeeded(activePath, sink.logDir, sink.opts))
    .then(() => fs.appendFile(activePath, JSON.stringify(entry) + "\n"))
    .catch((err) => {
      process.stderr.write(`[logger] file write failed: ${String(err)}\n`);
    });
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
    this.minLevel = options.minLevel ?? "info";
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
      this.fileSink = {
        logDir: this.logDir,
        opts: { maxBytes: this.maxBytes, maxAgeDays: this.maxAgeDays },
        queue: Promise.resolve(),
      };
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

  private resolveCorrelationId(): string {
    const cls = this.clsService;
    if (cls && cls.isActive()) {
      return cls.get<string>("correlationId") ?? "no-context";
    }
    return "no-context";
  }

  private emit(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    if (LEVEL_PRIORITY[level] < this.minPriority) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: this.resolveCorrelationId(),
      ...this.baseContext,
      ...context,
    };

    const formatted = JSON.stringify(entry);

    if (level === "error") {
      process.stderr.write(formatted + "\n");
    } else {
      process.stdout.write(formatted + "\n");
    }

    if (this.fileSink) {
      // Fire-and-forget: enqueueWrite chains onto the sink's serialized queue
      // and swallows errors via the catch inside enqueueWrite.
      enqueueWrite(this.fileSink, entry);
    }
  }
}

/** No-op logger for testing or when logging is disabled. */
class NullLogger implements AppLogger {
  debug(): void {
    /* noop */
  }
  info(): void {
    /* noop */
  }
  warn(): void {
    /* noop */
  }
  error(): void {
    /* noop */
  }
  child(): AppLogger {
    return this;
  }
}

export function createAppLogger(options: LoggerOptions = {}): AppLogger {
  return new AppLoggerImpl(options);
}

export function createNullLogger(): AppLogger {
  return new NullLogger();
}
