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

    filter.catch(error, makeHost());

    expect(captureException).toHaveBeenCalledWith(error);
  });

  it("captures non-HttpException errors (unhandled rejects)", () => {
    const filter = new SentryExceptionFilter(httpAdapter as never);
    const captureException = vi.mocked(Sentry.captureException);
    const error = new Error("unexpected");

    filter.catch(error, makeHost());

    expect(captureException).toHaveBeenCalledWith(error);
  });

  it("does not capture client errors (4xx)", () => {
    const filter = new SentryExceptionFilter(httpAdapter as never);
    const captureException = vi.mocked(Sentry.captureException);

    filter.catch(new HttpException("nope", 400), makeHost());

    expect(captureException).not.toHaveBeenCalled();
  });
});
