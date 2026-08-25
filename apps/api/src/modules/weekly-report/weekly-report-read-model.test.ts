import { describe, expect, it } from "vitest";

import { requireLiveGroupName } from "./weekly-report-read-model.js";

const GROUP_ID = "a0000000-0000-4000-8000-000000000301";

describe("requireLiveGroupName", () => {
  it("returns the batched human-readable group name", () => {
    expect(
      requireLiveGroupName(
        GROUP_ID,
        new Map([[GROUP_ID, "Finance Platforms"]]),
      ),
    ).toBe("Finance Platforms");
  });

  it("fails loud when a grouped live section has no matching metadata", () => {
    expect(() => requireLiveGroupName(GROUP_ID, new Map())).toThrow(
      /has no name/,
    );
  });

  it("keeps an ungrouped section explicitly unlabeled", () => {
    expect(requireLiveGroupName(null, new Map())).toBeNull();
  });
});
