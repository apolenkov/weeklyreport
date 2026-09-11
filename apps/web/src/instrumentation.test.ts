import { afterEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  captureRequestError: vi.fn(),
}));
const initializers = vi.hoisted(() => ({
  edge: vi.fn(),
  server: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => sdk);
vi.mock("../sentry.server.config", () => {
  initializers.server();
  return {};
});
vi.mock("../sentry.edge.config", () => {
  initializers.edge();
  return {};
});

import { onRequestError, register } from "./instrumentation";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("server instrumentation", () => {
  it("loads only the initializer for each Next.js runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    await register();

    expect(initializers.server).toHaveBeenCalledOnce();
    expect(initializers.edge).not.toHaveBeenCalled();

    vi.stubEnv("NEXT_RUNTIME", "edge");
    await register();

    expect(initializers.server).toHaveBeenCalledOnce();
    expect(initializers.edge).toHaveBeenCalledOnce();
  });

  it("forwards controlled request errors to the local SDK boundary", () => {
    const error = new Error("controlled instrumentation test error");
    const request = {
      path: "/instrumentation-test",
      method: "GET",
      headers: { "x-request-id": "test-request" },
    };
    const context = {
      routerKind: "App Router",
      routePath: "/instrumentation-test",
      routeType: "route",
    };

    onRequestError(error, request, context);

    expect(sdk.captureRequestError).toHaveBeenCalledExactlyOnceWith(
      error,
      request,
      context,
    );
  });
});
