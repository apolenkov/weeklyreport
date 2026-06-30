import { describe, expect, it } from "vitest";

import { sanitizeNext } from "./safe-next";

const FALLBACK = "/head/dashboard";

describe("sanitizeNext — same-origin redirect validation", () => {
  it("accepts a same-origin relative path", () => {
    expect(sanitizeNext("/lead/report", FALLBACK)).toBe("/lead/report");
  });

  it("preserves the query string and hash of a same-origin path", () => {
    expect(sanitizeNext("/reports?tab=published#top", FALLBACK)).toBe(
      "/reports?tab=published#top",
    );
  });

  it("rejects the backslash bypass (slash then backslash)", () => {
    expect(sanitizeNext(String.raw`/\evil.com`, FALLBACK)).toBe(FALLBACK);
  });

  it("rejects the scheme-relative bypass //evil.com", () => {
    expect(sanitizeNext("//evil.com", FALLBACK)).toBe(FALLBACK);
  });

  it("rejects an absolute off-origin URL", () => {
    expect(sanitizeNext("https://evil.com", FALLBACK)).toBe(FALLBACK);
  });

  it("rejects a leading-backslash target", () => {
    expect(sanitizeNext(String.raw`\evil.com`, FALLBACK)).toBe(FALLBACK);
  });

  it("falls back when the target is empty or absent", () => {
    expect(sanitizeNext("", FALLBACK)).toBe(FALLBACK);
    expect(sanitizeNext(null, FALLBACK)).toBe(FALLBACK);
  });
});
