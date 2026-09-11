import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  formatTimestamp,
  humanizeProcedure,
  statusLabel,
} from "./action-log-format";

// `formatTimestamp` renders in the viewer's zone, so the expected strings only
// hold with the zone pinned; each block restores the ambient TZ afterwards.
// `vi.stubEnv` restores an originally-unset TZ by deleting the key, which a
// plain save/reassign cannot do (`process.env` stringifies `undefined`).
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
    ["2026-07-26T09:05:00.000Z", "26.07.2026, 09:05"],
    ["2026-01-02T23:45:00.000Z", "02.01.2026, 23:45"],
    ["2026-12-31T00:00:00.000Z", "31.12.2026, 00:00"],
    ["2026-03-09T00:07:00.000Z", "09.03.2026, 00:07"],
  ])("renders %s as %s", (input, expected) => {
    expect(formatTimestamp(input)).toBe(expected);
  });
});

describe("formatTimestamp across a day boundary", () => {
  withTimeZone("America/New_York");

  it("rolls the local date back when the UTC instant is past midnight", () => {
    expect(formatTimestamp("2026-12-31T00:00:00.000Z")).toBe(
      "30.12.2026, 19:00",
    );
  });

  it("keeps a two-digit local hour past noon", () => {
    expect(formatTimestamp("2026-01-02T23:45:00.000Z")).toBe(
      "02.01.2026, 18:45",
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
