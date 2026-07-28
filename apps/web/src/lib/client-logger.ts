"use client";

// Batches browser console/window errors to /api/client-logs.
// Dev-only by default — no-op unless NEXT_PUBLIC_CLIENT_LOG_FORWARDING is 'true'.

import { webEnv } from "./web-env";

type Level = "debug" | "info" | "warn" | "error";

interface Entry {
  level: Level;
  message: string;
  source: "console" | "window-error" | "unhandled-rejection";
  url?: string | undefined;
  stack?: string | undefined;
  ts: number;
}

const FLUSH_MS = 2000;
const FLUSH_AT_COUNT = 50;
const MAX_QUEUE = 500;
const INSTALLED_MARK = Symbol.for("customreport.client-logger.installed");

// Mutable by design: a batching buffer producers push into and flush drains;
// patchConsole reassigns console.error/warn because intercepting the global is
// the module's whole purpose.
const queue: Entry[] = [];
// eslint-disable-next-line no-restricted-syntax -- enqueue schedules the batch flush and flush clears the handle; module-level timer state is intentional.
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function safeStringify(arg: unknown): string {
  if (arg instanceof Error) return arg.message;
  if (typeof arg === "string") return arg;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

export function canEnqueue(queueLength: number): boolean {
  return queueLength < MAX_QUEUE;
}

function enqueue(entry: Entry) {
  if (!canEnqueue(queue.length)) return;
  queue.push(entry);
  if (queue.length >= FLUSH_AT_COUNT) {
    void flush();
  } else {
    flushTimer ??= setTimeout(() => void flush(), FLUSH_MS);
  }
}

async function flush() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (queue.length === 0) return;
  const batch = queue.splice(0);
  try {
    await fetch("/api/client-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: batch }),
      keepalive: true,
    });
  } catch {
    // Best-effort: drop on failure to avoid storming the server when the
    // network is the original cause of the error.
  }
}

function patchConsole(): void {
  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);

  console.error = (...args: unknown[]) => {
    enqueue({
      level: "error",
      message: args.map(safeStringify).join(" "),
      source: "console",
      url: window.location.href,
      stack: args.find((a): a is Error => a instanceof Error)?.stack,
      ts: Date.now(),
    });
    origError(...args);
  };

  console.warn = (...args: unknown[]) => {
    enqueue({
      level: "warn",
      message: args.map(safeStringify).join(" "),
      source: "console",
      url: window.location.href,
      ts: Date.now(),
    });
    origWarn(...args);
  };
}

function registerWindowListeners(): void {
  window.addEventListener("error", (event) => {
    enqueue({
      level: "error",
      message: event.message,
      source: "window-error",
      url: event.filename || window.location.href,
      stack: event.error instanceof Error ? event.error.stack : undefined,
      ts: Date.now(),
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason: unknown = event.reason;
    enqueue({
      level: "error",
      message: safeStringify(reason),
      source: "unhandled-rejection",
      url: window.location.href,
      stack: reason instanceof Error ? reason.stack : undefined,
      ts: Date.now(),
    });
  });

  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
}

export function installClientLogger(): void {
  const loggerConsole = console as Console & {
    [INSTALLED_MARK]?: true;
  };
  if (loggerConsole[INSTALLED_MARK]) return;
  if (typeof window === "undefined") return;
  if (!webEnv.clientLogForwarding()) return;
  Object.defineProperty(loggerConsole, INSTALLED_MARK, {
    configurable: true,
    value: true,
  });

  patchConsole();
  registerWindowListeners();
}
