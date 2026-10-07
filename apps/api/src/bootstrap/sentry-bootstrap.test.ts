import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nestjs", () => ({
  init: vi.fn(),
  isInitialized: vi.fn(() => false),
  close: vi.fn(() => Promise.resolve(true)),
}));

import * as Sentry from "@sentry/nestjs";

import { initializeSentry } from "./sentry-bootstrap.js";

const VALID_DSN = "https://key@o123.ingest.sentry.io/456";

describe("initializeSentry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SENTRY_DSN;
    process.env.NODE_ENV = "test";
  });

  it.each([undefined, ""])(
    "stays disabled without calling Sentry.init when SENTRY_DSN is %j",
    (dsn) => {
      if (dsn === undefined) delete process.env.SENTRY_DSN;
      else process.env.SENTRY_DSN = dsn;

      initializeSentry();

      expect(Sentry.init).not.toHaveBeenCalled();
    },
  );

  it("initializes the SDK for a valid configured DSN", () => {
    process.env.SENTRY_DSN = VALID_DSN;

    initializeSentry();

    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: VALID_DSN,
        tracesSampleRate: 0,
        enableOpenTelemetrySetup: false,
        environment: "test",
      }),
    );
  });

  it.each([
    " ".repeat(4),
    "not-a-dsn",
    "ftp://key@host/1",
    "https://key@host/x",
  ])("rejects malformed configured SENTRY_DSN %j before Sentry.init", (dsn) => {
    process.env.SENTRY_DSN = dsn;

    expect(() => initializeSentry()).toThrow(
      /SENTRY_DSN must be a Sentry DSN/u,
    );
    expect(Sentry.init).not.toHaveBeenCalled();
  });
});
