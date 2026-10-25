import type {
  IncomingMessage,
  RequestListener,
  RequestOptions,
  Server,
} from "node:http";
import { createRequire } from "node:module";

import {
  context,
  logs,
  metrics,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import type {
  InMemorySpanExporter,
  ReadableSpan,
} from "@opentelemetry/sdk-trace";
import { PrismaInstrumentation } from "@prisma/instrumentation";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { shutdownOtel, startOtel } from "./otel.bootstrap.js";

const { exporters } = vi.hoisted(() => ({
  exporters: [] as InMemorySpanExporter[],
}));

// Replace only the collector boundary; bootstrap, SDK and HTTP patches are real.
vi.mock("@opentelemetry/exporter-trace-otlp-http", async () => {
  const { InMemorySpanExporter } = await import("@opentelemetry/sdk-trace");
  return {
    OTLPTraceExporter: class extends InMemorySpanExporter {
      constructor() {
        super();
        exporters.push(this);
      }
    },
  };
});

const require = createRequire(import.meta.url);
const servers = new Set<Server>();
const instrumentationCalls: unknown[][] = [];
const queryPath =
  "/trpc/report%3Fquery?input=%7B%22q%22%3A%22private-marker%22%7D&arbitrary=private-marker&repeat=one&repeat=two&empty=";

beforeAll(() => {
  vi.stubEnv("OTEL_SDK_DISABLED", "false");
  vi.stubEnv("OTEL_METRICS_EXPORTER", "none");
  vi.stubEnv("OTEL_LOGS_EXPORTER", "none");
  vi.stubEnv("OTEL_BSP_SCHEDULE_DELAY", "1");
  for (const prototype of [
    HttpInstrumentation.prototype,
    ExpressInstrumentation.prototype,
    PrismaInstrumentation.prototype,
  ]) {
    instrumentationCalls.push(vi.spyOn(prototype, "enable").mock.contexts);
  }
  if (
    !startOtel({ OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector.invalid" })
      .started
  ) {
    throw new Error("Expected tracing to start");
  }
});

beforeEach(() => {
  exporters[0]?.reset();
});

afterEach(async () => {
  for (const server of servers) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  servers.clear();
});

afterAll(async () => {
  await shutdownOtel();
  for (const instrumentation of new Set(instrumentationCalls.flat())) {
    if (
      instrumentation instanceof HttpInstrumentation ||
      instrumentation instanceof ExpressInstrumentation ||
      instrumentation instanceof PrismaInstrumentation
    ) {
      instrumentation.disable();
    }
  }
  instrumentationCalls.length = 0;
  exporters.length = 0;
  context.disable();
  metrics.disable();
  propagation.disable();
  trace.disable();
  logs.disable();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function listen(handler: RequestListener, host = "127.0.0.1") {
  const http = require("node:http") as typeof import("node:http");
  const server = http.createServer(handler);
  servers.add(server);
  await new Promise<void>((resolve) => server.listen(0, host, resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected a TCP address");
  }
  return address.port;
}

async function request(
  port: number,
  path: string,
  destination: Pick<RequestOptions, "host" | "hostname"> = {
    hostname: "127.0.0.1",
  },
) {
  const http = require("node:http") as typeof import("node:http");
  return new Promise<number | undefined>((resolve, reject) => {
    const outgoing = http.get(
      { ...destination, port, path, agent: false },
      (response) => {
        response.resume();
        response.on("end", () => resolve(response.statusCode));
        response.on("error", reject);
      },
    );
    outgoing.on("error", reject);
  });
}

async function finishedSpans(count: number): Promise<ReadableSpan[]> {
  await vi.waitFor(() => {
    expect(exporters[0]?.getFinishedSpans()).toHaveLength(count);
  });
  return exporters[0]?.getFinishedSpans() ?? [];
}

function expectPrivateQueryRemoved(spans: ReadableSpan[]): void {
  for (const span of spans) {
    expect(span.ended).toBe(true);
    expect(JSON.stringify(span.attributes)).not.toContain("private-marker");
    for (const key of ["http.url", "http.target", "url.full"]) {
      if (typeof span.attributes[key] === "string") {
        expect(span.attributes[key]).not.toContain("?");
      }
    }
    expect(span.attributes["url.query"] ?? "").toBe("");
  }
}

describe("HTTP span query privacy through startOtel", () => {
  it("strips incoming and outgoing queries without changing requests or propagation", async () => {
    let incoming: IncomingMessage | undefined;
    const port = await listen((req, res) => {
      incoming = req;
      res.writeHead(204).end();
    });

    expect(await request(port, queryPath)).toBe(204);
    const spans = await finishedSpans(2);
    const client = spans.find((span) => span.kind === SpanKind.CLIENT);
    const server = spans.find((span) => span.kind === SpanKind.SERVER);
    if (!client || !server) throw new Error("Expected client and server spans");
    expect(incoming?.url).toBe(queryPath);
    expect(client.attributes["url.full"]).toBe(
      `http://127.0.0.1:${port}/trpc/report%3Fquery`,
    );
    expect(server.attributes["url.path"]).toBe("/trpc/report%3Fquery");
    for (const span of spans) {
      expect(span.attributes["http.request.method"]).toBe("GET");
      expect(span.attributes["http.response.status_code"]).toBe(204);
    }
    expect(server.spanContext().traceId).toBe(client.spanContext().traceId);
    expect(server.parentSpanContext?.spanId).toBe(client.spanContext().spanId);
    expect(incoming?.headers.traceparent).toBe(
      `00-${client.spanContext().traceId}-${client.spanContext().spanId}-01`,
    );
    expectPrivateQueryRemoved(spans);
  });

  it("preserves query-free incoming and outgoing URL attributes", async () => {
    const port = await listen((_req, res) => res.writeHead(200).end());
    expect(await request(port, "/health/live")).toBe(200);
    const spans = await finishedSpans(2);
    expect(
      spans.find((span) => span.kind === SpanKind.CLIENT)?.attributes[
        "url.full"
      ],
    ).toBe(`http://127.0.0.1:${port}/health/live`);
    expect(
      spans.find((span) => span.kind === SpanKind.SERVER)?.attributes,
    ).not.toHaveProperty("url.query");
    expectPrivateQueryRemoved(spans);
  });

  it.each(["//reports/current", "//reports/current?arbitrary=private-marker"])(
    "preserves a double-slash origin-form path %s",
    async (path) => {
      let receivedPath: string | undefined;
      const port = await listen((req, res) => {
        receivedPath = req.url;
        res.writeHead(204).end();
      });

      expect(await request(port, path)).toBe(204);
      const spans = await finishedSpans(2);
      const client = spans.find((span) => span.kind === SpanKind.CLIENT);
      expect(receivedPath).toBe(path);
      expect(client?.attributes["url.full"]).toBe(
        `http://127.0.0.1:${port}//reports/current`,
      );
      expect(client?.attributes["http.request.method"]).toBe("GET");
      expect(client?.attributes["http.response.status_code"]).toBe(204);
      expectPrivateQueryRemoved(spans);
    },
  );

  it.each([
    { host: "127.0.0.1" },
    { host: "127.0.0.2", hostname: "127.0.0.1" },
    { host: "127.0.0.1", hostname: "" },
  ])(
    "preserves the host destination and explicit port for %j",
    async (destination) => {
      let incoming: IncomingMessage | undefined;
      const port = await listen((req, res) => {
        incoming = req;
        res.writeHead(200).end();
      });

      expect(await request(port, queryPath, destination)).toBe(200);
      const spans = await finishedSpans(2);
      const client = spans.find((span) => span.kind === SpanKind.CLIENT);
      expect(incoming?.url).toBe(queryPath);
      expect(incoming?.headers.host).toBe(`127.0.0.1:${port}`);
      expect(client?.attributes["server.address"]).toBe("127.0.0.1");
      expect(client?.attributes["server.port"]).toBe(port);
      expect(client?.attributes["url.full"]).toBe(
        `http://127.0.0.1:${port}/trpc/report%3Fquery`,
      );
      expectPrivateQueryRemoved(spans);
    },
  );

  it.each([
    {
      path: "http://user:fixture-password@target.example/report?arbitrary=private-marker",
      expectedPath: "/report",
    },
    {
      path: "http://user:fixture-password@target.example:65536/report?arbitrary=private-marker",
      expectedPath: "/",
    },
  ])(
    "omits userinfo from an absolute-form request path %j",
    async ({ path, expectedPath }) => {
      let receivedPath: string | undefined;
      const port = await listen((req, res) => {
        receivedPath = req.url;
        res.writeHead(200).end();
      });

      expect(await request(port, path)).toBe(200);
      const spans = await finishedSpans(2);
      const client = spans.find((span) => span.kind === SpanKind.CLIENT);
      expect(receivedPath).toBe(path);
      expect(client?.attributes["url.full"]).toBe(
        `http://127.0.0.1:${port}${expectedPath}`,
      );
      expect(
        JSON.stringify(spans.map((span) => span.attributes)),
      ).not.toContain("fixture-password");
      expectPrivateQueryRemoved(spans);
    },
  );

  it("strips queries when the server response emits an error and the client aborts", async () => {
    let receivedPath: string | undefined;
    const port = await listen((req, res) => {
      receivedPath = req.url;
      res.on("error", () => undefined);
      res.emit("error", new Error("fixture server failure"));
      res.destroy();
    });

    await expect(request(port, queryPath)).rejects.toThrow("socket hang up");
    expect(receivedPath).toBe(queryPath);
    const spans = await finishedSpans(2);
    expect(spans.map((span) => span.status.code)).toEqual([
      SpanStatusCode.ERROR,
      SpanStatusCode.ERROR,
    ]);
    expectPrivateQueryRemoved(spans);
  });

  it.each([
    { protocol: "ftp:", port: 80 },
    { protocol: "http:", port: 65_536 },
  ])(
    "strips queries on synchronous native request rejection %j",
    async (option) => {
      const http = require("node:http") as typeof import("node:http");
      const options = { ...option, hostname: "127.0.0.1", path: queryPath };
      expect(() => http.get(options)).toThrow();
      expect(options.path).toBe(queryPath);
      const spans = await finishedSpans(1);
      expect(spans[0]?.kind).toBe(SpanKind.CLIENT);
      expect(spans[0]?.status.code).toBe(SpanStatusCode.ERROR);
      expectPrivateQueryRemoved(spans);
    },
  );

  it("keeps the IPv6 destination and path while stripping outgoing queries", async () => {
    const port = await listen((_req, res) => res.writeHead(200).end(), "::1");
    expect(await request(port, queryPath, { hostname: "::1" })).toBe(200);
    const spans = await finishedSpans(2);
    expect(
      spans.find((span) => span.kind === SpanKind.CLIENT)?.attributes[
        "url.full"
      ],
    ).toBe(`http://[::1]:${port}/trpc/report%3Fquery`);
    expectPrivateQueryRemoved(spans);
  });
});
