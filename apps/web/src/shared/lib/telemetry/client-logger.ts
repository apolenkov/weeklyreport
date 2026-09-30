"use client";

// Batches browser console/window errors to /api/client-logs.
// Dev-only by default — no-op unless NEXT_PUBLIC_CLIENT_LOG_FORWARDING is 'true'.

import { sanitizeClientLogUrl } from "@customreport/shared";

import { webEnv } from "../runtime/web-env";

type Level = "debug" | "info" | "warn" | "error";

interface Entry {
  level: Level;
  message: string;
  source: "console" | "window-error" | "unhandled-rejection";
  url?: string | undefined;
  ts: number;
}

const FLUSH_MS = 2000;
const FLUSH_AT_COUNT = 50;
const MAX_QUEUE = 500;
const INSTALLED_MARK = Symbol.for("customreport.client-logger.installed");

// Mutable by design: a batching buffer producers push into and flush drains;
// patchConsole reassigns console.error/warn because intercepting the global is
// the module's whole purpose. The flush handle lives in a single field holder
// so the module keeps its intentional lifecycle state without a `let` binding.
const queue: Entry[] = [];
const flushTimer: { current: ReturnType<typeof setTimeout> | null } = {
  current: null,
};

export function canEnqueue(queueLength: number): boolean {
  return queueLength < MAX_QUEUE;
}

function enqueue(entry: Entry) {
  if (!canEnqueue(queue.length)) return;
  queue.push(entry);
  if (queue.length >= FLUSH_AT_COUNT) {
    void flush();
  } else {
    flushTimer.current ??= setTimeout(() => void flush(), FLUSH_MS);
  }
}

async function flush() {
  if (flushTimer.current) {
    clearTimeout(flushTimer.current);
    flushTimer.current = null;
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
      message: "console",
      source: "console",
      url: sanitizeClientLogUrl(window.location.href),
      ts: Date.now(),
    });
    origError(...args);
  };

  console.warn = (...args: unknown[]) => {
    enqueue({
      level: "warn",
      message: "console",
      source: "console",
      url: sanitizeClientLogUrl(window.location.href),
      ts: Date.now(),
    });
    origWarn(...args);
  };
}

function registerWindowListeners(): void {
  window.addEventListener("error", (event) => {
    enqueue({
      level: "error",
      message: "window-error",
      source: "window-error",
      url: sanitizeClientLogUrl(event.filename || window.location.href),
      ts: Date.now(),
    });
  });

  window.addEventListener("unhandledrejection", () => {
    enqueue({
      level: "error",
      message: "unhandled-rejection",
      source: "unhandled-rejection",
      url: sanitizeClientLogUrl(window.location.href),
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
