import type { AdminActionLogEvent } from "@weeklyreport/shared";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  matchesActionLogSearch,
  serializeActionLogEvent,
} from "./action-log-model";

const EVENT: AdminActionLogEvent = {
  id: "action-1",
  createdAt: "2026-08-14T10:15:30.000Z",
  userId: "admin-user",
  role: "admin",
  procedure: "admin.updateUser",
  targetId: "target-user",
  status: "fail",
  reason: "BAD_REQUEST",
  ip: "127.0.0.1",
  correlationId: "request-1",
  durationMs: 18,
};

describe("matchesActionLogSearch", () => {
  beforeAll(() => {
    vi.stubEnv("TZ", "UTC");
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    "2026-08-14T10:15",
    "Aug 14, 2026, 10:15 AM",
    "Admin: Update User",
    "Error",
    "BAD_REQUEST",
    "request-1",
  ])("matches the loaded row by %s", (needle) => {
    expect(matchesActionLogSearch(EVENT, needle)).toBe(true);
  });

  it("is case-insensitive and excludes a non-matching row", () => {
    expect(matchesActionLogSearch(EVENT, "ADMIN: UPDATE USER")).toBe(true);
    expect(matchesActionLogSearch(EVENT, "not present")).toBe(false);
  });

  it("reapplies the same active search after a loaded page is appended", () => {
    const firstPage = [{ ...EVENT, id: "action-1", userId: "first-user" }];
    const secondPage = [{ ...EVENT, id: "action-2", userId: "second-user" }];
    const needle = "second-user";

    expect(
      firstPage.filter((row) => matchesActionLogSearch(row, needle)),
    ).toEqual([]);
    expect(
      [...firstPage, ...secondPage].filter((row) =>
        matchesActionLogSearch(row, needle),
      ),
    ).toEqual(secondPage);
  });
});

describe("serializeActionLogEvent", () => {
  it("copies the exact allowlist in deterministic order", () => {
    expect(serializeActionLogEvent(EVENT)).toBe(
      JSON.stringify(
        {
          id: "action-1",
          createdAt: "2026-08-14T10:15:30.000Z",
          userId: "admin-user",
          role: "admin",
          procedure: "admin.updateUser",
          targetId: "target-user",
          status: "fail",
          reason: "BAD_REQUEST",
          ip: "127.0.0.1",
          correlationId: "request-1",
          durationMs: 18,
        },
        null,
        2,
      ),
    );
  });

  it("ignores a runtime field outside the allowlist", () => {
    const unsafeEvent = { ...EVENT, rawPayload: { secret: true } };

    expect(serializeActionLogEvent(unsafeEvent)).not.toContain("rawPayload");
    expect(serializeActionLogEvent(unsafeEvent)).not.toContain("secret");
  });
});
