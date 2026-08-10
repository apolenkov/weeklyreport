import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseTranscript, sha256Bytes } from "./driver-results-transcript.ts";

const timeline = {
  startedAt: "2026-08-04T10:00:00.000Z",
  endedAt: "2026-08-04T10:05:00.000Z",
  routes: [
    {
      route: "/lead/report",
      enteredAt: "2026-08-04T10:00:00.000Z",
      leftAt: "2026-08-04T10:02:00.000Z",
    },
    {
      route: "/lead/history",
      enteredAt: "2026-08-04T10:02:00.000Z",
      leftAt: "2026-08-04T10:05:00.000Z",
    },
  ],
} as const;

const record = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  attemptId: "attempt-1",
  timestamp: "2026-08-04T10:00:30.000Z",
  tool: "browser_console_messages",
  route: "/lead/report",
  ...overrides,
});

const bytesFor = (...records: readonly unknown[]): Uint8Array =>
  Buffer.from(`${records.map((value) => JSON.stringify(value)).join("\n")}\n`);

const parse = (bytes: Uint8Array) =>
  parseTranscript({
    path: path.join(import.meta.dirname, "transcript.jsonl"),
    bytes,
    attemptId: "attempt-1",
    timeline,
  });

describe("strict runtime driver transcript", () => {
  it("returns exact input bytes and digest for valid records", () => {
    const bytes = bytesFor(record());
    const parsed = parse(bytes);

    expect(parsed.text).toBe(new TextDecoder().decode(bytes));
    expect(Array.from(parsed.bytes)).toEqual(Array.from(bytes));
    expect(parsed.digest).toBe(sha256Bytes(bytes));
    expect(parsed.records).toHaveLength(1);
  });

  it.each([
    ["foreign attempt", record({ attemptId: "attempt-2" })],
    [
      "outside overall timeline",
      record({ timestamp: "2026-08-04T10:06:00.000Z" }),
    ],
    [
      "outside route interval",
      record({
        timestamp: "2026-08-04T10:02:30.000Z",
        route: "/lead/report",
      }),
    ],
    ["unknown tool", record({ tool: "browser_dialogs" })],
    ["non-ISO timestamp", record({ timestamp: "2026-08-04 10:00:30" })],
    ["extra field", record({ detail: "unbound" })],
  ])("rejects %s", (_name, value) => {
    expect(() => parse(bytesFor(value))).toThrow();
  });

  it("rejects duplicate records and malformed JSON lines", () => {
    const duplicate = record();
    expect(() => parse(bytesFor(duplicate, duplicate))).toThrow(/duplicate/iu);
    expect(() => parse(Buffer.from('{"attemptId":"attempt-1"}\n'))).toThrow(
      /invalid transcript record/iu,
    );
    expect(() => parse(Buffer.from("not json\n"))).toThrow(/valid JSON/iu);
  });

  it("rejects empty and blank transcript lines", () => {
    expect(() => parse(Buffer.from("\n"))).toThrow(/no records/iu);
    expect(() => parse(Buffer.from(`${JSON.stringify(record())}\n\n`))).toThrow(
      /empty/iu,
    );
  });
});
