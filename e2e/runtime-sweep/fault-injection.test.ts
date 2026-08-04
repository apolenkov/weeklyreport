import type { Route } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";

import type {
  FaultDeclaration,
  FaultRouteHandler,
  FaultRouteRegistrar,
} from "./fault-injection.ts";
import { installFault, withFault } from "./fault-injection.ts";

function declaration(mode: FaultDeclaration["mode"]): FaultDeclaration {
  if (mode === "network-timeout" || mode === "request-aborted") {
    return {
      id: mode,
      mode,
      urlPattern: "**/trpc/report.save",
      operation: "save-report",
      expectation: {
        userVisibleMessage: "The request failed. Your data is safe.",
        statusRole: "alert",
        recovery: mode === "network-timeout" ? "retry" : "reload",
        persistedState: "unchanged",
      },
      response: null,
      abortCode: mode === "network-timeout" ? "timedout" : "aborted",
    };
  }
  return {
    id: mode,
    mode,
    urlPattern: "**/trpc/report.save",
    operation: "save-report",
    expectation: {
      userVisibleMessage: "The request failed. Your data is safe.",
      statusRole: "alert",
      recovery: mode === "auth-forbidden" ? "none" : "reauthenticate",
      persistedState: "unchanged",
    },
    response: {
      status:
        mode === "auth-forbidden"
          ? 403
          : mode === "http-4xx"
            ? 422
            : mode === "http-5xx"
              ? 503
              : 401,
      body: JSON.stringify({ error: { message: "Request rejected" } }),
      headers: { "content-type": "application/json" },
    },
    abortCode: null,
  };
}

function registrar(): {
  registrar: FaultRouteRegistrar;
  handlers: FaultRouteHandler[];
  routeCalls: number;
  unrouteCalls: number;
} {
  const handlers: FaultRouteHandler[] = [];
  const state = { routeCalls: 0, unrouteCalls: 0 };
  const registrar: FaultRouteRegistrar = {
    route: (_urlPattern, handler) => {
      state.routeCalls += 1;
      handlers.push(handler);
      return Promise.resolve();
    },
    unroute: (_urlPattern, handler) => {
      state.unrouteCalls += 1;
      expect(handlers).toContain(handler);
      return Promise.resolve();
    },
  };
  return {
    registrar,
    handlers,
    get routeCalls() {
      return state.routeCalls;
    },
    get unrouteCalls() {
      return state.unrouteCalls;
    },
  };
}

describe("runtime fault injection", () => {
  it.each([
    ["auth-missing", 401],
    ["auth-expired", 401],
    ["auth-forbidden", 403],
    ["http-4xx", 422],
    ["http-5xx", 503],
  ] as const)("fulfills a scoped %s fault", async (mode, status) => {
    const harness = registrar();
    const installed = await installFault(harness.registrar, declaration(mode));
    const fulfill = vi.fn(() => Promise.resolve());
    const abort = vi.fn(() => Promise.resolve());
    const route = { fulfill, abort } as unknown as Route;

    const [handler] = harness.handlers;
    if (!handler) throw new Error("fault handler was not installed");
    await handler(route);
    await installed.teardown();

    expect(fulfill).toHaveBeenCalledWith({
      status,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: { message: "Request rejected" } }),
    });
    expect(abort).not.toHaveBeenCalled();
    expect(harness.routeCalls).toBe(1);
    expect(harness.unrouteCalls).toBe(1);
  });

  it.each([
    ["network-timeout", "timedout"],
    ["request-aborted", "aborted"],
  ] as const)("aborts a %s request with %s", async (mode, code) => {
    const harness = registrar();
    await installFault(harness.registrar, declaration(mode));
    const fulfill = vi.fn(() => Promise.resolve());
    const abort = vi.fn(() => Promise.resolve());

    const [handler] = harness.handlers;
    if (!handler) throw new Error("fault handler was not installed");
    await handler({ fulfill, abort } as unknown as Route);

    expect(abort).toHaveBeenCalledWith(code);
    expect(fulfill).not.toHaveBeenCalled();
  });

  it("always tears down after the action, including action failures", async () => {
    const harness = registrar();
    const actionFailure = new Error("action failed");

    await expect(
      withFault(harness.registrar, declaration("http-5xx"), () =>
        Promise.reject(actionFailure),
      ),
    ).rejects.toBe(actionFailure);
    expect(harness.routeCalls).toBe(1);
    expect(harness.unrouteCalls).toBe(1);
  });
});
