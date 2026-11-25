import { describe, expect, it } from "vitest";

import {
  autosaveReadinessCopy,
  autosaveStatusCopy,
  OFFLINE_SAVING_STATUS,
  overviewSaveStatus,
} from "./autosave-state-copy";

describe("autosaveReadinessCopy", () => {
  it("explains a save paused while the browser is offline", () => {
    expect(autosaveReadinessCopy("saving", false)).toContain(
      "paused while you’re offline",
    );
  });

  it("keeps the normal readiness copy online and for other states", () => {
    expect(autosaveReadinessCopy("saving")).toBe("Draft changes are saving.");
    expect(autosaveReadinessCopy("saving", true)).toBe(
      "Draft changes are saving.",
    );
    expect(autosaveReadinessCopy("error", false)).toBe(
      "Draft save failed. Use Retry to save again.",
    );
    expect(autosaveReadinessCopy("idle", false)).toBe("Draft is saved.");
  });
});

describe("autosaveStatusCopy", () => {
  it("explains a save paused by the browser going offline", () => {
    expect(autosaveStatusCopy("saving", false)).toBe(OFFLINE_SAVING_STATUS);
  });

  it("keeps the normal copy online, and for states that are not saving", () => {
    expect(autosaveStatusCopy("saving")).toBe("Saving draft");
    expect(autosaveStatusCopy("error", false)).toBe("Draft save failed");
  });
});

describe("overviewSaveStatus", () => {
  const base = {
    outcomePending: false,
    unsavedCount: 1,
    autosaveState: "saving",
    online: true,
  } as const;

  it("announces the offline pause even while the inline editor is open", () => {
    expect(overviewSaveStatus({ ...base, online: false })).toBe(
      OFFLINE_SAVING_STATUS,
    );
  });

  it("gives running and failed saves priority over the unsaved count", () => {
    expect(overviewSaveStatus({ ...base, unsavedCount: 2 })).toBe("Saving…");
    expect(
      overviewSaveStatus({ ...base, autosaveState: "error", unsavedCount: 2 }),
    ).toBe("Some changes are not saved");
  });
  it.each([
    [0, "All changes saved"],
    [1, "1 unsaved change"],
    [3, "3 unsaved changes"],
  ] as const)("counts %i unsaved records", (unsavedCount, label) => {
    expect(
      overviewSaveStatus({ ...base, autosaveState: "idle", unsavedCount }),
    ).toBe(label);
  });
});
