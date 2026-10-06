import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  formatTimestamp,
  humanizeProcedure,
  shortId,
  statusLabel,
} from "./action-log-format";

// `formatTimestamp` renders in the viewer's zone, so the expected strings only
// hold with the zone pinned; each block restores the ambient TZ afterwards.
// `vi.stubEnv` restores an originally-unset TZ by deleting the key, which a
// plain save/reassign cannot do (`process.env` stringifies `undefined`).
// ICU separates the meridiem with a narrow no-break space; compare on plain spaces.
const plain = (value: string): string => value.replaceAll(/\s/g, " ");

function withTimeZone(timeZone: string): void {
  beforeAll(() => {
    vi.stubEnv("TZ", timeZone);
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });
}

describe("formatTimestamp in UTC", () => {
  withTimeZone("UTC");

  it.each([
    ["2026-07-26T09:05:00.000Z", "Jul 26, 2026, 9:05 AM"],
    ["2026-01-02T23:45:00.000Z", "Jan 2, 2026, 11:45 PM"],
    ["2026-12-31T00:00:00.000Z", "Dec 31, 2026, 12:00 AM"],
    ["2026-03-09T00:07:00.000Z", "Mar 9, 2026, 12:07 AM"],
  ])("renders %s as %s", (input, expected) => {
    expect(plain(formatTimestamp(input))).toBe(expected);
  });
});

describe("formatTimestamp across a day boundary", () => {
  withTimeZone("America/New_York");

  it("rolls the local date back when the UTC instant is past midnight", () => {
    expect(plain(formatTimestamp("2026-12-31T00:00:00.000Z"))).toBe(
      "Dec 30, 2026, 7:00 PM",
    );
  });

  it("keeps a two-digit local hour past noon", () => {
    expect(plain(formatTimestamp("2026-01-02T23:45:00.000Z"))).toBe(
      "Jan 2, 2026, 6:45 PM",
    );
  });
});

describe("formatTimestamp on unusable input", () => {
  it.each([[""], ["not a date"], ["2026-13-45T99:99:99Z"]])(
    "renders %o as the hyphen sentinel",
    (input) => {
      expect(formatTimestamp(input)).toBe("-");
    },
  );
});

describe("statusLabel", () => {
  it("maps both durable statuses", () => {
    expect(statusLabel("success")).toBe("OK");
    expect(statusLabel("fail")).toBe("Error");
  });
});

describe("humanizeProcedure", () => {
  it("preserves the existing two-segment label", () => {
    expect(humanizeProcedure("admin.updateUser")).toBe("Admin: Update User");
  });

  it.each([
    ["admin.aiProvider.activate", "Admin · AI Provider: Activate"],
    ["admin.aiProvider.candidate", "Admin · AI Provider: Candidate"],
    [
      "admin.reminderPolicy.recovery.retryFailed",
      "Admin · Reminder Policy · Recovery: Retry Failed",
    ],
  ])("keeps every segment in %s", (procedure, expected) => {
    expect(humanizeProcedure(procedure)).toBe(expected);
  });

  it.each(["admin", "admin..activate", ".activate"])(
    "leaves malformed procedure %s unchanged",
    (procedure) => {
      expect(humanizeProcedure(procedure)).toBe(procedure);
    },
  );
});

describe("shortId", () => {
  it("keeps short ids whole and shows the distinctive tail of long ones", () => {
    expect(shortId("singleton")).toBe("singleton");
    expect(shortId("a0000000-0000-4000-8000-000000000401")).toBe("…00000401");
  });
});
