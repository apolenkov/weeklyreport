import { describe, expect, it, vi } from "vitest";

import {
  assertRuntimeObservabilityReadiness,
  readRuntimeObservabilityConfig,
  type RuntimeObservabilityConfig,
} from "./runtime-observability-readiness.ts";

const config: RuntimeObservabilityConfig = {
  otelEndpoint: "http://otel.test:4318/",
  bugsink: {
    dsn: `http://${"a".repeat(32)}@bugsink.test/1`,
    apiToken: "b".repeat(40),
  },
  loki: {
    pushUrl: "http://loki.test/loki/api/v1/push",
    queryUrl: "http://loki.test/loki/api/v1/query_range",
  },
};

const response = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const requestUrl = (input: RequestInfo | URL): URL =>
  input instanceof URL
    ? input
    : new URL(typeof input === "string" ? input : input.url);

const storeResponse = (init: RequestInit | undefined): Response => {
  const body = typeof init?.body === "string" ? init.body : "{}";
  const eventId = JSON.parse(body) as { event_id: string };
  return response({ id: eventId.event_id });
};

const projectResponse = (projectReads: { count: number }): Response => {
  projectReads.count += 1;
  const count = projectReads.count > 1 ? 1 : 0;
  return response({
    slug: "runtime-sweep",
    digested_event_count: count,
    stored_event_count: count,
  });
};

const lokiResponse = (url: URL): Response => {
  const probeId = url.searchParams
    .get("query")
    ?.match(/runtime_sweep_probe_id="([^"]+)"/u)?.[1];
  return response({
    status: "success",
    data: {
      result: [
        { values: [["1", `runtime-sweep-probe ${probeId ?? "missing"}`]] },
      ],
    },
  });
};

const successfulFetcher = (): typeof fetch => {
  const projectReads = { count: 0 };
  const implementation = (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = requestUrl(input);
    if (url.hostname === "otel.test") return Promise.resolve(response({}));
    if (url.pathname.endsWith("/store/"))
      return Promise.resolve(storeResponse(init));
    if (url.pathname.includes("/projects/"))
      return Promise.resolve(projectResponse(projectReads));
    if (url.pathname.endsWith("/push"))
      return Promise.resolve(new Response(null, { status: 204 }));
    return Promise.resolve(lokiResponse(url));
  };
  return vi.fn(implementation);
};

describe("runtime observability readiness", () => {
  it("requires every observer endpoint without storing a silent default", () => {
    expect(() => readRuntimeObservabilityConfig({})).toThrow(
      "OTEL_EXPORTER_OTLP_ENDPOINT",
    );
  });

  it("proves OTel ingestion plus queryable Bugsink and Loki probes", async () => {
    await expect(
      assertRuntimeObservabilityReadiness(config, successfulFetcher()),
    ).resolves.toMatchObject({
      otel: "live",
      bugsink: "live",
      loki: "live",
    });
  });

  it("fails closed when an observer is unreachable", async () => {
    const fetcher = vi.fn(() => Promise.reject(new Error("offline")));
    await expect(
      assertRuntimeObservabilityReadiness(config, fetcher),
    ).rejects.toThrow("offline");
  });
});
