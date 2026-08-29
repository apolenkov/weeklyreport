import { describe, expect, it } from "vitest";

import {
  ACTION_LOG_IDS,
  ACTION_LOG_ROWS,
  REMINDER_POLICY_IDS,
} from "../simple/seed-simple.access-and-policies.js";
import { PROJECT_ACTIVITY_IDS } from "../simple/seed-simple.activities.js";

describe("seed journey scope ownership", () => {
  it("full-profile activity ids are non-empty and deterministic", () => {
    expect(PROJECT_ACTIVITY_IDS.length).toBeGreaterThan(0);
    expect(new Set(PROJECT_ACTIVITY_IDS).size).toBe(
      PROJECT_ACTIVITY_IDS.length,
    );
  });

  it("full-profile action log and policy ids are unique and non-empty", () => {
    expect(ACTION_LOG_IDS.length).toBeGreaterThanOrEqual(21);
    expect(new Set(ACTION_LOG_IDS).size).toBe(ACTION_LOG_IDS.length);
    expect(REMINDER_POLICY_IDS.length).toBeGreaterThan(0);
    expect(new Set(REMINDER_POLICY_IDS).size).toBe(REMINDER_POLICY_IDS.length);
  });

  it("provides stable, safe, multi-page action-log rows", () => {
    expect(ACTION_LOG_ROWS).toHaveLength(ACTION_LOG_IDS.length);
    expect(
      ACTION_LOG_ROWS.map(({ createdAt }) => createdAt.toISOString()),
    ).toEqual(
      ACTION_LOG_ROWS.map((_, index) =>
        new Date(Date.UTC(2026, 7, 14, 12, -index)).toISOString(),
      ),
    );
    for (const row of ACTION_LOG_ROWS) {
      expect(row.reason === null || /^[A-Z_]+$/.test(row.reason)).toBe(true);
    }
  });

  it("keeps the profile-owned ids inside the deterministic seed ranges", () => {
    // The journey asserts existence by these ids; an id outside the owned
    // ranges would come from unrelated residue and the check would be void.
    for (const id of PROJECT_ACTIVITY_IDS) {
      expect(id).toMatch(/^a0000000-0000-4000-8000-00000000ca[0-9a-f]{2}$/);
    }
    for (const id of ACTION_LOG_IDS) {
      expect(id).toMatch(/^a0000000-0000-4000-8000-000000000e[0-9a-f]{2}$/);
    }
  });
});
