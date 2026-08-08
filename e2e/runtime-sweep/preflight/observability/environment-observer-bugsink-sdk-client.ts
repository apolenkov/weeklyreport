import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";

const SDK_PROBE_MESSAGE = "runtime-sweep-sdk-probe";
const API_SENTRY_PACKAGE = path.resolve(
  import.meta.dirname,
  "../../../../apps/api/node_modules/@sentry/nestjs",
);
const WEB_SENTRY_PACKAGE = path.resolve(
  import.meta.dirname,
  "../../../../apps/web/node_modules/@sentry/nextjs/package.json",
);
const requireFromE2e = createRequire(import.meta.url);
const requireFromWeb = createRequire(WEB_SENTRY_PACKAGE);

interface ProductSentryTransportOptions {
  readonly url: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly recordDroppedEvent: (...args: readonly unknown[]) => void;
}

interface ProductSentryTransportRequest {
  readonly body: string | Uint8Array;
}

interface ProductSentryTransportResponse {
  readonly statusCode?: number;
  readonly headers?: Readonly<Record<string, string | null>>;
}

interface ProductSentryTransport {
  readonly send: (
    request: ProductSentryTransportRequest,
  ) => PromiseLike<ProductSentryTransportResponse>;
  readonly flush: (timeout?: number) => PromiseLike<boolean>;
}

interface ProductSentryClient {
  readonly init: () => void;
  readonly captureException: (
    exception: unknown,
    hint?: unknown,
    scope?: ProductSentryScope,
  ) => string;
  readonly getDsn: () => unknown;
  readonly flush: (timeout?: number) => PromiseLike<boolean>;
  readonly close: (timeout?: number) => PromiseLike<boolean>;
}

interface ProductSentryScope {
  readonly setClient: (client: ProductSentryClient) => void;
  readonly setTag: (key: string, value: string) => ProductSentryScope;
  readonly captureException: (exception: unknown, hint?: unknown) => string;
}

interface ProductSentrySdk {
  readonly Client: new (
    options: Readonly<Record<string, unknown>>,
  ) => ProductSentryClient;
  readonly Scope: new () => ProductSentryScope;
  readonly createTransport: (
    options: ProductSentryTransportOptions,
    executor: (
      request: ProductSentryTransportRequest,
    ) => PromiseLike<ProductSentryTransportResponse>,
  ) => ProductSentryTransport;
  readonly defaultStackParser: unknown;
}

export interface SdkProbeContext {
  readonly now: () => number;
  readonly sleep: (milliseconds: number) => Promise<void>;
  readonly deadline: number;
  readonly pollInterval: number;
  readonly attempts: number;
}

type RawProductSentrySdk = Omit<ProductSentrySdk, "Client"> &
  Readonly<{
    readonly NodeClient?: ProductSentrySdk["Client"];
    readonly BrowserClient?: ProductSentrySdk["Client"];
  }>;

const productSdk = (
  raw: RawProductSentrySdk,
  client: ProductSentrySdk["Client"] | undefined,
): ProductSentrySdk => {
  if (client === undefined)
    throw new Error("Product Sentry client is unavailable");
  return { ...raw, Client: client };
};

const loadApiSentry = (): ProductSentrySdk => {
  const raw = requireFromE2e(API_SENTRY_PACKAGE) as RawProductSentrySdk;
  return productSdk(raw, raw.NodeClient);
};

const loadBrowserSentry = (): ProductSentrySdk => {
  const raw = requireFromWeb("@sentry/browser") as RawProductSentrySdk;
  return productSdk(raw, raw.BrowserClient);
};

export const timeoutSignal = (
  deadline: number,
  now: () => number,
): AbortSignal => {
  const remaining = deadline - now();
  if (!Number.isFinite(remaining) || remaining <= 0)
    throw new Error("Bugsink SDK probe deadline expired");
  return AbortSignal.timeout(Math.ceil(remaining));
};

const responseHeaders = (
  response: Response,
): Readonly<Record<string, string | null>> => ({
  "retry-after": response.headers.get("retry-after"),
  "x-sentry-rate-limits": response.headers.get("x-sentry-rate-limits"),
});

type MonitoredTransport = Readonly<{
  readonly factory: (
    options: ProductSentryTransportOptions,
  ) => ProductSentryTransport;
  readonly failed: () => Promise<boolean>;
}>;

const createFetchTransport = (
  sdk: ProductSentrySdk,
  fetcher: typeof fetch,
  context: SdkProbeContext,
): MonitoredTransport => {
  const failure = Promise.withResolvers<boolean>();
  return {
    factory: (options) =>
      sdk.createTransport(options, async ({ body }) => {
        try {
          const response = await fetcher(options.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-sentry-envelope",
              ...options.headers,
            },
            body:
              typeof body === "string" ? body : new TextDecoder().decode(body),
            signal: timeoutSignal(context.deadline, context.now),
          });
          if (!response.ok) {
            failure.resolve(true);
            throw new Error("Bugsink SDK transport rejected");
          }
          return {
            statusCode: response.status,
            headers: responseHeaders(response),
          };
        } catch {
          failure.resolve(true);
          throw new Error("Bugsink SDK transport failed");
        }
      }),
    failed: () =>
      Promise.race([
        failure.promise,
        new Promise<boolean>((resolve) => queueMicrotask(() => resolve(false))),
      ]),
  };
};

const remainingTimeout = (context: SdkProbeContext): number =>
  Math.max(1, Math.ceil(context.deadline - context.now()));

const safeClose = async (
  client: ProductSentryClient,
  timeout: number,
): Promise<void> => {
  await Promise.resolve(client.close(timeout)).then(
    () => true,
    () => false,
  );
};

const captureSdkCanary = async (
  sdk: ProductSentrySdk,
  dsn: string,
  fetcher: typeof fetch,
  context: SdkProbeContext,
  sdkPath: "api" | "browser",
): Promise<string> => {
  const transport = createFetchTransport(sdk, fetcher, context);
  const client = new sdk.Client({
    dsn,
    defaultIntegrations: false,
    integrations: [],
    stackParser: sdk.defaultStackParser,
    skipOpenTelemetrySetup: true,
    tracesSampleRate: 0,
    beforeSendTransaction: () => null,
    transport: transport.factory,
  });
  try {
    if (!client.getDsn()) throw new Error("Bugsink SDK did not accept DSN");
    const scope = new sdk.Scope();
    scope.setClient(client);
    scope.setTag("runtime_sweep_sdk_probe", randomUUID().replaceAll("-", ""));
    scope.setTag("runtime_sweep_sdk_path", sdkPath);
    client.init();
    const eventId = scope.captureException(new Error(SDK_PROBE_MESSAGE));
    await new Promise<void>((resolve) => setImmediate(resolve));
    const timeout = remainingTimeout(context);
    const flushed = await client.flush(timeout);
    const transportFailed = await transport.failed();
    const closed = await client.close(timeout);
    if (!eventId || !flushed || !closed || transportFailed)
      throw new Error("Bugsink SDK canary did not flush");
    return eventId;
  } catch {
    await safeClose(client, remainingTimeout(context));
    throw new Error("Bugsink SDK canary failed");
  }
};

export type ProductSdkCanaries = Readonly<{
  readonly apiEventId: string;
  readonly browserEventId: string;
}>;

export const captureProductSdkCanaries = async (
  dsn: string,
  fetcher: typeof fetch,
  context: SdkProbeContext,
): Promise<ProductSdkCanaries> => {
  const apiEventId = await captureSdkCanary(
    loadApiSentry(),
    dsn,
    fetcher,
    context,
    "api",
  );
  const browserEventId = await captureSdkCanary(
    loadBrowserSentry(),
    dsn,
    fetcher,
    context,
    "browser",
  );
  return { apiEventId, browserEventId };
};
