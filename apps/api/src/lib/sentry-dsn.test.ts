import { describe, expect, it } from "vitest";

import { parseSentryDsn, SENTRY_DSN_INVALID_MESSAGE } from "./sentry-dsn.js";

describe("parseSentryDsn", () => {
  it.each([undefined, ""])("returns undefined for disabled value %j", (dsn) => {
    expect(parseSentryDsn(dsn)).toBeUndefined();
  });

  it.each([
    "https://abcdef1234567890abcdef1234567890@sentry.example.com/42",
    "https://key@o123.ingest.sentry.io/456",
    "http://key@selfhosted.local:9000/7",
    "https://key@sentry.example.com/sentry/9",
  ])("accepts the valid DSN %j", (dsn) => {
    expect(parseSentryDsn(dsn)).toBe(dsn);
  });

  it.each([
    " ".repeat(4),
    "not-a-dsn",
    "ftp://key@sentry.example.com/42",
    "https://sentry.example.com/42",
    "https://key@/42",
    "https://key@sentry.example.com/",
    "https://key@sentry.example.com/abc",
    "https://key@sentry.example.com/42x",
  ])("rejects the malformed configured DSN %j", (dsn) => {
    expect(() => parseSentryDsn(dsn)).toThrow(
      /SENTRY_DSN must be a Sentry DSN/u,
    );
  });

  it("never echoes the rejected input in the error", () => {
    const secret = "https://p@ssw0rd@sentry.example.com/x";
    // The diagnostic is the fixed contract message — the raw value is never
    // interpolated into it.
    expect(() => parseSentryDsn(secret)).toThrow(SENTRY_DSN_INVALID_MESSAGE);
  });
});
