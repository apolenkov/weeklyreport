import { describe, expect, it } from "vitest";

import {
  ADMIN_TAB_LABELS,
  ADMIN_TAB_QUERY_DEPENDENCIES,
  ADMIN_TABS,
  isAdminTab,
} from "./admin-tab-dependencies";

describe("admin tab query dependencies", () => {
  it.each([
    ["users", true, false],
    ["groups", true, false],
    ["products", true, false],
    ["activities", true, false],
    ["periods", false, false],
    ["reminders", true, true],
    ["reopen", false, false],
    ["jobs", false, false],
    ["actions", true, false],
    ["ai", false, false],
    ["settings", false, true],
  ] as const)(
    "%s enables snapshot=%s and settings=%s",
    (tab, snapshot, settings) => {
      expect(ADMIN_TAB_QUERY_DEPENDENCIES[tab]).toEqual({
        snapshot,
        settings,
      });
    },
  );

  it("keeps the dependency table exhaustive", () => {
    expect(Object.keys(ADMIN_TAB_QUERY_DEPENDENCIES)).toEqual(ADMIN_TABS);
    expect(Object.keys(ADMIN_TAB_LABELS)).toEqual(ADMIN_TABS);
    expect(ADMIN_TAB_LABELS.ai).toBe("AI");
  });

  it("accepts only canonical tab identifiers", () => {
    expect(isAdminTab("reminders")).toBe(true);
    expect(isAdminTab("unknown")).toBe(false);
  });
});
