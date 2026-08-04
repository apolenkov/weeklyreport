import { describe, expect, it } from "vitest";

import { parseClientLogEntry } from "./client-logs-handler";

const validEntry = {
  level: "error",
  message: "Request failed",
  source: "console",
  url: "https://customreport.test/lead/report",
  stack: "Error: Request failed",
  ts: 1_785_608_000_000,
} as const;

describe("parseClientLogEntry", () => {
  it("accepts the complete browser event contract", () => {
    expect(parseClientLogEntry(validEntry)).toEqual(validEntry);
  });

  it.each([
    ["structured timestamp", { ...validEntry, ts: { value: 1 } }],
    ["non-finite timestamp", { ...validEntry, ts: Number.POSITIVE_INFINITY }],
    ["oversized message", { ...validEntry, message: "x".repeat(2001) }],
    ["unknown field", { ...validEntry, credentials: "secret" }],
  ])("rejects %s", (_label, entry) => {
    expect(parseClientLogEntry(entry)).toBeNull();
  });
});
