"use client";

// Captures browser console.error/warn, window error events and unhandled
// promise rejections, batches them, and POSTs to /api/client-logs so all
// debug data lives in apps/api/.logs/app.log alongside server entries.
//
// Dev-only by default — installCLientLogger() is a no-op when
// NEXT_PUBLIC_CLIENT_LOG_FORWARDING is not 'true'. Enable via
// .env.development by default; opt-in in prod.

type Level = "debug" | "info" | "warn" | "error";

interface Entry {
  level: Level;
  message: string;
  source: "console" | "window-error" | "unhandled-rejection";
  url?: string;
  stack?: string;
  ts: number;
}

const FLUSH_MS = 2000;
const FLUSH_AT_COUNT = 50;
const MAX_QUEUE = 500;

let installed = false;
const queue: Entry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function safeStringify(arg: unknown): string {
  if (arg instanceof Error) return arg.message;
  if (typeof arg === "string") return arg;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function enqueue(entry: Entry) {
  if (queue.length >= MAX_QUEUE) return;
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

export function installClientLogger(): void {
  if (installed) return;
  if (typeof window === "undefined") return;
  if (process.env.NEXT_PUBLIC_CLIENT_LOG_FORWARDING !== "true") return;
  installed = true;

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

  // Flush on tab hide/unload.
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
}
