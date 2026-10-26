// Loaded after Sentry but before API composition so the SDK patches HTTP before
// Nest/Express/Prisma. Collector absence or start failure never blocks boot.

import { format } from "node:url";

import { type Attributes, propagation } from "@opentelemetry/api";
import {
  CompositePropagator,
  type ExportResult,
  W3CTraceContextPropagator,
} from "@opentelemetry/core";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ParentBasedSampler,
  type ReadableSpan,
  type SpanExporter,
  TraceIdRatioBasedSampler,
} from "@opentelemetry/sdk-trace";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_URL_FULL,
  ATTR_URL_QUERY,
} from "@opentelemetry/semantic-conventions";
import { PrismaInstrumentation } from "@prisma/instrumentation";
import { SentryPropagator } from "@sentry/opentelemetry";

import { errorMessage } from "../../lib/error-message.js";
import { parseOtlpEndpoint } from "../../lib/otlp-endpoint.js";

export type OtelBootstrapResult =
  | {
      started: true;
      reason: "enabled";
      samplingRatio: number;
      endpoint: string;
    }
  | { started: false; reason: "disabled-flag" }
  | { started: false; reason: "no-endpoint" }
  | { started: false; reason: "start-failed" };

const DEFAULT_TRACES_SAMPLING_RATIO = 1.0;

// env.schema declares OTEL_SERVICE_NAME/_VERSION optional, so the bootstrap
// supplies the service identity spans are attributed to when they are unset.
const DEFAULT_SERVICE_NAME = "weeklyreport-api";
const DEFAULT_SERVICE_VERSION = "dev";

const samplingRatioFor = (rawRatio: string | undefined): number => {
  if (rawRatio?.trim().length === 0)
    throw new Error("OTEL_TRACES_SAMPLER_ARG must not be blank");
  const samplingRatio =
    rawRatio === undefined ? DEFAULT_TRACES_SAMPLING_RATIO : Number(rawRatio);
  if (!Number.isFinite(samplingRatio) || samplingRatio < 0 || samplingRatio > 1)
    throw new Error(
      `OTEL_TRACES_SAMPLER_ARG must be a number between 0 and 1; received ${JSON.stringify(rawRatio)}`,
    );
  return samplingRatio;
};

export function decideOtelBootstrap(
  env: NodeJS.ProcessEnv = process.env,
): OtelBootstrapResult {
  if ((env.OTEL_SDK_DISABLED ?? "").toLowerCase() === "true") {
    return { started: false, reason: "disabled-flag" };
  }
  // Same contract as env.schema: whitespace means unset, a malformed
  // nonblank endpoint throws before any exporter is constructed.
  const endpoint = parseOtlpEndpoint(env.OTEL_EXPORTER_OTLP_ENDPOINT);
  if (endpoint === undefined) {
    return { started: false, reason: "no-endpoint" };
  }
  const samplingRatio = samplingRatioFor(env.OTEL_TRACES_SAMPLER_ARG);
  return { started: true, reason: "enabled", samplingRatio, endpoint };
}

// CompositePropagator.extract is left-to-right; last match wins. W3C last so
// traceparent beats sentry-trace; SentryPropagator bridges sentry-trace-only.
export function createTraceContextPropagator(): CompositePropagator {
  return new CompositePropagator({
    propagators: [new SentryPropagator(), new W3CTraceContextPropagator()],
  });
}

// sdk-trace 3.x keeps any AnyValue on span attributes and the OTLP transformer
// serializes nested objects as kvlistValue; pre-3.x runtimes dropped non-primitive
// values. Third-party instrumentations can pass such payloads, so keep the
// collector edge limited to primitive values and arrays of primitives.
const isExportableAttributeValue = (value: unknown): boolean => {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (!Array.isArray(value)) return false;
  return value.every(
    (entry) =>
      typeof entry === "string" ||
      typeof entry === "number" ||
      typeof entry === "boolean",
  );
};

// Both span and link attribute maps accept the same AnyValue payload in
// sdk-trace 3.x: links pass through cleanAttributes (Span.mjs addLink,
// Tracer.mjs startSpan), so nested objects and null survive there too. Events
// are already safe because addEvent applies cleanSimpleAttributes.
const deleteUnexportableAttributes = (attributes: Attributes): void => {
  for (const key of Object.keys(attributes)) {
    const value: unknown = attributes[key];
    if (!isExportableAttributeValue(value)) {
      delete attributes[key];
    }
  }
};

class SpanAttributePrivacyExporter implements SpanExporter {
  constructor(private readonly exporter: SpanExporter) {}

  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void,
  ): void {
    // The batch processor has already ended and owns these spans; removing
    // unsafe values here is the last point before serialization.
    for (const span of spans) {
      deleteUnexportableAttributes(span.attributes);
      for (const link of span.links) {
        if (link.attributes) {
          deleteUnexportableAttributes(link.attributes);
        }
      }
    }
    this.exporter.export(spans, resultCallback);
  }

  shutdown(): Promise<void> {
    return this.exporter.shutdown();
  }
}

class OtelLifecycle {
  private sdk: NodeSDK | null = null;

  install(sdk: NodeSDK): void {
    this.sdk = sdk;
  }

  async shutdown(): Promise<void> {
    await this.sdk?.shutdown();
  }
}

const otelLifecycle = new OtelLifecycle();

export const shutdownOtel = (): Promise<void> => otelLifecycle.shutdown();

// Starts the OpenTelemetry SDK, or records why it stayed off.
export function startOtel(
  env: NodeJS.ProcessEnv = process.env,
): OtelBootstrapResult {
  // Always register (even when export is off) so BullMQ inject/extract speaks
  // W3C traceparent, not the default no-op. SDK start re-registers the same
  // composite via textMapPropagator.
  propagation.setGlobalPropagator(createTraceContextPropagator());

  const decision = decideOtelBootstrap(env);
  if (!decision.started) {
    return decision;
  }

  const base = decision.endpoint.replace(/\/$/, "");
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: env.OTEL_SERVICE_NAME ?? DEFAULT_SERVICE_NAME,
    [ATTR_SERVICE_VERSION]: env.OTEL_SERVICE_VERSION ?? DEFAULT_SERVICE_VERSION,
  });

  const sdk = new NodeSDK({
    resource,
    // ParentBased keeps a sampled-in parent; a bare ratio re-dices every span
    // and can drop the api hop from a browser-kept trace.
    sampler: new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(decision.samplingRatio),
    }),
    traceExporter: new SpanAttributePrivacyExporter(
      new OTLPTraceExporter({ url: `${base}/v1/traces` }),
    ),
    // Explicit processors stop the SDK from building an env-driven OTLP log
    // provider; the SDK registers this one as the single global logger provider.
    logRecordProcessors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({ url: `${base}/v1/logs` }),
      }),
    ],
    // Metrics are application-owned (Prometheus scrape), so the SDK must not
    // create an env-driven meter provider.
    metricReaders: [],
    // Browser→api shared trace id; W3C-wins precedence in createTraceContextPropagator.
    textMapPropagator: createTraceContextPropagator(),
    instrumentations: [
      // Start hooks also cover native request errors that precede requestHook.
      new HttpInstrumentation({
        startIncomingSpanHook: (request) =>
          request.url?.includes("?") ? { [ATTR_URL_QUERY]: "" } : {},
        startOutgoingSpanHook: (request) => ({
          [ATTR_URL_FULL]: format({
            protocol: request.protocol ?? "http:",
            hostname: request.hostname || request.host || "localhost",
            port: request.port,
            pathname: request.path?.startsWith("/")
              ? request.path.split("?")[0]
              : (URL.parse(request.path ?? "/", "http://localhost")?.pathname ??
                "/"),
            slashes: true,
          }),
        }),
      }),
      new ExpressInstrumentation(),
      new PrismaInstrumentation(),
    ],
  });

  try {
    sdk.start();
  } catch (error) {
    // Non-fatal: api should still boot if the collector is unreachable. The
    // SDK failed to start, so the reported result must not claim "started",
    // and no shutdown handler may be registered for it.
    process.stderr.write(`[otel] start failed: ${errorMessage(error)}\n`);
    return { started: false, reason: "start-failed" };
  }

  // The SDK owns the global tracer, meter and logger providers now; shutdown
  // drains every provider it created from the explicit configuration above.
  otelLifecycle.install(sdk);

  return decision;
}
