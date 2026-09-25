import { describe, expect, it } from "vitest";

import { sanitizeNext } from "./safe-next";

const FALLBACK = "/head/dashboard";

describe("sanitizeNext — same-origin redirect validation", () => {
  it("accepts a same-origin relative path", () => {
    expect(sanitizeNext("/lead/report", FALLBACK)).toBe("/lead/report");
  });

  it("preserves the query string and hash of a same-origin path", () => {
    expect(sanitizeNext("/admin?tab=products#top", FALLBACK)).toBe(
      "/admin?tab=products#top",
    );
  });

  it("rejects the backslash bypass (slash then backslash)", () => {
    expect(sanitizeNext(String.raw`/\evil.com`, FALLBACK)).toBe(FALLBACK);
  });

  it("rejects the scheme-relative bypass //evil.com", () => {
    expect(sanitizeNext("//evil.com", FALLBACK)).toBe(FALLBACK);
  });

  it.each([
    "/.//evil.com",
    "/%2e//evil.com",
    "/%2E%2E//evil.com",
    String.raw`/./\evil.com`,
    String.raw`/.\/evil.com`,
    "/a/../..//evil.com",
  ])("rejects the dot-segment normalization bypass %s", (candidate) => {
    expect(sanitizeNext(candidate, FALLBACK)).toBe(FALLBACK);
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
