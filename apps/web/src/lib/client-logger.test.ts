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
  vi.unstubAllGlobals();
  Reflect.deleteProperty(console, INSTALLED_MARK);
  console.error = originalError;
  console.warn = originalWarn;
  delete process.env.NEXT_PUBLIC_CLIENT_LOG_FORWARDING;
});

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
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(request.body as string) as { entries: unknown[] };
    expect(body.entries).toHaveLength(1);
  });
});
