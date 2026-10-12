import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const INSTALLED_MARK = Symbol.for("customreport.client-logger.installed");
const originalError = console.error;
const originalWarn = console.warn;

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules();
  process.env.NEXT_PUBLIC_CLIENT_LOG_FORWARDING = "true";
  Reflect.deleteProperty(console, INSTALLED_MARK);
  console.error = vi.fn();
  console.warn = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(console, INSTALLED_MARK);
  console.error = originalError;
  console.warn = originalWarn;
  delete process.env.NEXT_PUBLIC_CLIENT_LOG_FORWARDING;
});

function postedEntries(fetchMock: ReturnType<typeof vi.fn>): unknown[] {
  const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
  const body = JSON.parse(request.body as string) as { entries: unknown[] };
  return body.entries;
}

describe("installClientLogger", () => {
  it("does not wrap console.error again after module re-instantiation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response());
    vi.stubGlobal("fetch", fetchMock);

    const firstModule = await import("./client-logger");
    firstModule.installClientLogger();
    vi.resetModules();
    const refreshedModule = await import("./client-logger");
    refreshedModule.installClientLogger();

    console.error("one error");
    await vi.advanceTimersByTimeAsync(2000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(postedEntries(fetchMock)).toHaveLength(1);
  });

  it("flushes immediately when the batch reaches 50 entries", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response());
    vi.stubGlobal("fetch", fetchMock);
    const { installClientLogger } = await import("./client-logger");
    installClientLogger();

    Array.from({ length: 50 }, (_, index) => index).forEach((index) => {
      console.error(`error-${index}`);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(postedEntries(fetchMock)).toHaveLength(50);
  });

  it("does not call the network when forwarding is disabled", async () => {
    process.env.NEXT_PUBLIC_CLIENT_LOG_FORWARDING = "false";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { installClientLogger } = await import("./client-logger");

    installClientLogger();
    console.error("not forwarded");
    await vi.advanceTimersByTimeAsync(2000);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("window capture", () => {
  async function captureListeners() {
    const listeners = new Map<string, EventListener>();
    vi.spyOn(window, "addEventListener").mockImplementation(
      (type, listener) => {
        listeners.set(type, listener as EventListener);
      },
    );
    const fetchMock = vi.fn().mockResolvedValue(new Response());
    vi.stubGlobal("fetch", fetchMock);
    const { installClientLogger } = await import("./client-logger");
    installClientLogger();
    return { listeners, fetchMock };
  }

  it.each([
    ["console-error", "console", "error"],
    ["console-warn", "console", "warn"],
    ["window-error", "window-error", "error"],
    ["unhandled-rejection", "unhandled-rejection", "error"],
  ] as const)(
    "keeps private %s data out of the forwarded batch",
    async (kind, source, level) => {
      const eventTime = 1_785_608_000_000;
      vi.setSystemTime(eventTime);
      const secret = "CLIENT_PRIVATE_MARKER";
      const privateUrl = `https://person:${secret}@weeklyreport.test/lead/report?token=${secret}#${secret}`;
      vi.stubGlobal("window", {
        location: { href: privateUrl },
        addEventListener: vi.fn(),
      });
      const { listeners, fetchMock } = await captureListeners();
      const error = new Error(`Request failed: ${secret}`);
      error.stack = `Error: ${secret}\n at ${privateUrl}`;

      if (kind === "console-error") console.error(error, { token: secret });
      if (kind === "console-warn") console.warn(secret, { password: secret });
      if (kind === "window-error") {
        listeners.get("error")?.(
          new ErrorEvent("error", {
            message: secret,
            filename: privateUrl,
            error,
          }),
        );
      }
      if (kind === "unhandled-rejection") {
        listeners.get("unhandledrejection")?.(
          Object.assign(new Event("unhandledrejection"), { reason: error }),
        );
      }
      await vi.advanceTimersByTimeAsync(2000);

      const entries = postedEntries(fetchMock);
      expect(JSON.stringify(entries)).not.toContain(secret);
      expect(entries).toMatchObject([
        {
          source,
          level,
          url: "https://weeklyreport.test/lead/report",
          ts: eventTime,
        },
      ]);
      expect(entries[0]).not.toHaveProperty("stack");
    },
  );

  it("captures window errors and unhandled rejections", async () => {
    const { listeners, fetchMock } = await captureListeners();

    listeners.get("error")?.(
      new ErrorEvent("error", {
        message: "window failed",
        filename: "screen.tsx",
        error: new Error("window failed"),
      }),
    );
    listeners.get("unhandledrejection")?.(
      new PromiseRejectionEvent("unhandledrejection", {
        promise: Promise.resolve(),
        reason: new Error("promise failed"),
      }),
    );
    await vi.advanceTimersByTimeAsync(2000);

    expect(postedEntries(fetchMock)).toMatchObject([
      { source: "window-error", message: "window-error" },
      { source: "unhandled-rejection", message: "unhandled-rejection" },
    ]);
  });

  it("flushes queued entries when the document becomes hidden", async () => {
    const { listeners, fetchMock } = await captureListeners();
    console.warn("queued warning");
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");

    listeners.get("visibilitychange")?.(new Event("visibilitychange"));
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(postedEntries(fetchMock)).toHaveLength(1);
  });
});

describe("client logger helpers", () => {
  it("rejects a new entry once the queue reaches its 500-entry cap", async () => {
    const { canEnqueue } = await import("./client-logger");

    expect(canEnqueue(499)).toBe(true);
    expect(canEnqueue(500)).toBe(false);
  });
});
