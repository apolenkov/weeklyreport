import type { ArgumentsHost } from "@nestjs/common";
import { HttpException, InternalServerErrorException } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nestjs", () => ({
  captureException: vi.fn(),
}));

import { SentryExceptionFilter } from "./sentry-exception.filter.js";

beforeEach(() => {
  vi.clearAllMocks();
  // captureException returns the generated event id; the filter ignores it.
  vi.mocked(Sentry.captureException).mockImplementation(() => "test-event-id");
});

// BaseExceptionFilter delegates the response write to the http adapter; a fake
// with the two methods the base class calls is enough here.
const httpAdapter = {
  isHeadersSent: () => false,
  reply: vi.fn(),
  end: vi.fn(),
};

function makeHost(): ArgumentsHost {
  const response = {};
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({}),
    }),
    getArgByIndex: (index: number) => (index === 1 ? response : undefined),
    getArgs: () => [null, response],
    getType: () => "http",
    switchToRpc: () => undefined,
    switchToWs: () => undefined,
  } as unknown as ArgumentsHost;
}

describe("SentryExceptionFilter", () => {
  it("captures server errors (>= 500) in Sentry", () => {
    const filter = new SentryExceptionFilter(httpAdapter as never);
    const captureException = vi.mocked(Sentry.captureException);
    const error = new InternalServerErrorException("boom");
    const host = makeHost();

    filter.catch(error, host);

    expect(captureException).toHaveBeenCalledWith(error);
    // Delegation is asserted without freezing the framework's response body.
    expect(httpAdapter.reply).toHaveBeenCalledExactlyOnceWith(
      host.getArgByIndex(1),
      expect.anything(),
      500,
    );
  });

  it("captures non-HttpException errors (unhandled rejects)", () => {
    const filter = new SentryExceptionFilter(httpAdapter as never);
    const captureException = vi.mocked(Sentry.captureException);
    const error = new Error("unexpected");
    const host = makeHost();

    filter.catch(error, host);

    expect(captureException).toHaveBeenCalledWith(error);
    expect(httpAdapter.reply).toHaveBeenCalledExactlyOnceWith(
      host.getArgByIndex(1),
      expect.anything(),
      500,
    );
  });

  it("does not capture client errors (4xx)", () => {
    const filter = new SentryExceptionFilter(httpAdapter as never);
    const captureException = vi.mocked(Sentry.captureException);
    const host = makeHost();

    filter.catch(new HttpException("nope", 400), host);

    expect(captureException).not.toHaveBeenCalled();
    expect(httpAdapter.reply).toHaveBeenCalledExactlyOnceWith(
      host.getArgByIndex(1),
      expect.anything(),
      400,
    );
  });

  it("still answers when the reporter itself throws", () => {
    const filter = new SentryExceptionFilter(httpAdapter as never);
    vi.mocked(Sentry.captureException).mockImplementationOnce(() => {
      throw new Error("sentry unavailable");
    });
    const host = makeHost();

    expect(() => filter.catch(new Error("unexpected"), host)).not.toThrow();
    expect(httpAdapter.reply).toHaveBeenCalledExactlyOnceWith(
      host.getArgByIndex(1),
      expect.anything(),
      500,
    );
  });

  it("reports a duck-typed 4xx object, which carries no authoritative status", () => {
    const filter = new SentryExceptionFilter(httpAdapter as never);
    const captureException = vi.mocked(Sentry.captureException);
    const host = makeHost();

    expect(() =>
      filter.catch({ statusCode: 404, message: "not found" }, host),
    ).not.toThrow();

    expect(captureException).toHaveBeenCalledOnce();
    expect(httpAdapter.reply).toHaveBeenCalledOnce();
  });
});
