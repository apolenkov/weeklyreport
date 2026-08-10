import { describe, expect, it } from "vitest";

import type { RequestFailureRecord, ResponseRecord } from "./evidence-types.ts";
import { isExpectedObservabilityAbort } from "./expected-observability-abort.ts";

const BUGSINK_DSN = "http://runtime@bugsink.test/1";
const BASE_RECORD: RequestFailureRecord = {
  requestId: "observability-request",
  url: "http://bugsink.test/api/1/envelope/?sentry_version=7&sentry_key=runtime&sentry_client=sentry.javascript.browser%2F10.22.0",
  method: "POST",
  resourceType: "fetch",
  failure: "net::ERR_ABORTED",
  startedAt: "2026-08-08T00:00:00.000Z",
  endedAt: "2026-08-08T00:00:00.001Z",
  durationMs: 1,
};
const SUCCESSFUL_RESPONSE: ResponseRecord = {
  requestId: BASE_RECORD.requestId,
  url: BASE_RECORD.url,
  method: BASE_RECORD.method,
  resourceType: BASE_RECORD.resourceType,
  status: 200,
  ok: true,
  startedAt: BASE_RECORD.startedAt,
  endedAt: BASE_RECORD.endedAt,
  durationMs: BASE_RECORD.durationMs,
  correlationId: null,
};

describe("expected observability abort", () => {
  it("recognizes the browser Sentry envelope abort", () => {
    expect(
      isExpectedObservabilityAbort(
        BASE_RECORD,
        [SUCCESSFUL_RESPONSE],
        BUGSINK_DSN,
      ),
    ).toBe(true);
  });

  it("recognizes the Next.js browser Sentry envelope abort", () => {
    const nextjsRecord = {
      ...BASE_RECORD,
      url: BASE_RECORD.url.replace(
        "sentry.javascript.browser%2F10.22.0",
        "sentry.javascript.nextjs%2F10.68.0",
      ),
    };

    expect(
      isExpectedObservabilityAbort(
        nextjsRecord,
        [{ ...SUCCESSFUL_RESPONSE, url: nextjsRecord.url }],
        BUGSINK_DSN,
      ),
    ).toBe(true);
  });

  it.each([
    ["connection refused", { failure: "net::ERR_CONNECTION_REFUSED" }],
    ["extended abort text", { failure: "net::ERR_ABORTED: cancelled" }],
    [
      "missing sentry client",
      {
        url: "http://bugsink.test/api/1/envelope/?sentry_version=7&sentry_key=runtime",
      },
    ],
    [
      "empty sentry client",
      {
        url: "http://bugsink.test/api/1/envelope/?sentry_version=7&sentry_key=runtime&sentry_client=",
      },
    ],
    [
      "foreign origin",
      {
        url: "https://attacker.example/api/1/envelope/?sentry_version=7&sentry_key=runtime&sentry_client=sentry.javascript.browser%2F10.22.0",
      },
    ],
    [
      "wrong project",
      {
        url: "http://bugsink.test/api/2/envelope/?sentry_version=7&sentry_key=runtime&sentry_client=sentry.javascript.browser%2F10.22.0",
      },
    ],
    [
      "wrong public key",
      {
        url: "http://bugsink.test/api/1/envelope/?sentry_version=7&sentry_key=foreign&sentry_client=sentry.javascript.browser%2F10.22.0",
      },
    ],
    [
      "wrong protocol version",
      {
        url: "http://bugsink.test/api/1/envelope/?sentry_version=8&sentry_key=runtime&sentry_client=sentry.javascript.browser%2F10.22.0",
      },
    ],
    [
      "wrong client",
      {
        url: "http://bugsink.test/api/1/envelope/?sentry_version=7&sentry_key=runtime&sentry_client=product-client%2F1.0.0",
      },
    ],
    [
      "server Sentry client",
      {
        url: "http://bugsink.test/api/1/envelope/?sentry_version=7&sentry_key=runtime&sentry_client=sentry.javascript.node%2F10.68.0",
      },
    ],
    [
      "wrong endpoint",
      {
        url: "http://bugsink.test/api/1/store/?sentry_version=7&sentry_key=runtime&sentry_client=sentry.javascript.browser%2F10.22.0",
      },
    ],
    [
      "product transport",
      {
        url: "http://bugsink.test/trpc/report.get?sentry_version=7&sentry_key=runtime&sentry_client=sentry.javascript.browser%2F10.22.0",
      },
    ],
    ["wrong method", { method: "GET" }],
    ["XHR transport", { resourceType: "xhr" }],
  ] as const)("rejects %s", (_label, overrides) => {
    expect(
      isExpectedObservabilityAbort(
        { ...BASE_RECORD, ...overrides },
        [SUCCESSFUL_RESPONSE],
        BUGSINK_DSN,
      ),
    ).toBe(false);
  });

  it("fails closed without a configured Bugsink DSN", () => {
    expect(
      isExpectedObservabilityAbort(
        BASE_RECORD,
        [SUCCESSFUL_RESPONSE],
        undefined,
      ),
    ).toBe(false);
  });

  it("requires a matching successful response", () => {
    expect(isExpectedObservabilityAbort(BASE_RECORD, [], BUGSINK_DSN)).toBe(
      false,
    );
    expect(
      isExpectedObservabilityAbort(
        BASE_RECORD,
        [{ ...SUCCESSFUL_RESPONSE, ok: false, status: 503 }],
        BUGSINK_DSN,
      ),
    ).toBe(false);
    expect(
      isExpectedObservabilityAbort(
        BASE_RECORD,
        [{ ...SUCCESSFUL_RESPONSE, requestId: "different-envelope-request" }],
        BUGSINK_DSN,
      ),
    ).toBe(false);
  });

  it("does not let one response bless a second identical failure", () => {
    const second = {
      ...BASE_RECORD,
      requestId: "second-observability-request",
    };

    expect(
      isExpectedObservabilityAbort(
        BASE_RECORD,
        [SUCCESSFUL_RESPONSE],
        BUGSINK_DSN,
      ),
    ).toBe(true);
    expect(
      isExpectedObservabilityAbort(second, [SUCCESSFUL_RESPONSE], BUGSINK_DSN),
    ).toBe(false);
  });

  it("fails closed when one failure has duplicate matching responses", () => {
    expect(
      isExpectedObservabilityAbort(
        BASE_RECORD,
        [SUCCESSFUL_RESPONSE, { ...SUCCESSFUL_RESPONSE }],
        BUGSINK_DSN,
      ),
    ).toBe(false);
  });
});
