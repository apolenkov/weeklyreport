import { appendFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

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
  [key: string]: unknown;
};

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export type LoggerOptions = {
  /** Minimum log level to emit. Default: 'info'. */
  minLevel?: LogLevel;
  /** Directory for rotated log files. If omitted, file logging is disabled. */
  logDir?: string;
  /** Maximum number of daily log files to retain. Default: 14. */
  maxFiles?: number;
  /** Service name included in every log entry. */
  service?: string;
};

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function pruneOldFiles(logDir: string, maxFiles: number): void {
  const files = readdirSync(logDir)
    .filter((f) => f.endsWith('.log'))
    .sort();

  const excess = files.length - maxFiles;

  for (let i = 0; i < excess; i++) {
    unlinkSync(join(logDir, files[i]!));
  }
}

function writeToFile(logDir: string, entry: LogEntry, maxFiles: number): void {
  const filename = `customreport-${formatDate(new Date())}.log`;
  const filepath = join(logDir, filename);

  appendFileSync(filepath, JSON.stringify(entry) + '\n');
  pruneOldFiles(logDir, maxFiles);
}

class AppLoggerImpl implements AppLogger {
  private readonly minPriority: number;
  private readonly baseContext: Record<string, unknown>;
  private readonly logDir: string | undefined;
  private readonly maxFiles: number;

  constructor(options: LoggerOptions, baseContext: Record<string, unknown> = {}) {
    this.minPriority = LEVEL_PRIORITY[options.minLevel ?? 'info'];
    this.logDir = options.logDir;
    this.maxFiles = options.maxFiles ?? 14;
    this.baseContext = {
      ...(options.service ? { service: options.service } : {}),
      ...baseContext,
    };

    if (this.logDir && !existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.emit('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.emit('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.emit('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.emit('error', message, context);
  }

  child(context: Record<string, unknown>): AppLogger {
    const childLogger = new AppLoggerImpl(
      {
        minLevel: Object.entries(LEVEL_PRIORITY).find(
          ([, v]) => v === this.minPriority,
        )?.[0] as LogLevel,
        logDir: this.logDir,
        maxFiles: this.maxFiles,
      },
      { ...this.baseContext, ...context },
    );

    return childLogger;
  }

  private emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LEVEL_PRIORITY[level] < this.minPriority) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.baseContext,
      ...context,
    };

    const formatted = JSON.stringify(entry);

    if (level === 'error') {
      process.stderr.write(formatted + '\n');
    } else {
      process.stdout.write(formatted + '\n');
    }

    if (this.logDir) {
      writeToFile(this.logDir, entry, this.maxFiles);
    }
  }
}

/** No-op logger for testing or when logging is disabled. */
class NullLogger implements AppLogger {
  debug(): void { /* noop */ }
  info(): void { /* noop */ }
  warn(): void { /* noop */ }
  error(): void { /* noop */ }
  child(): AppLogger { return this; }
}

export function createAppLogger(options: LoggerOptions = {}): AppLogger {
  return new AppLoggerImpl(options);
}

export function createNullLogger(): AppLogger {
  return new NullLogger();
}
