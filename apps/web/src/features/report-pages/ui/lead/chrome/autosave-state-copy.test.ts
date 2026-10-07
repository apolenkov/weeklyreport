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
      "Draft save failed. Use Save to retry.",
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
    pendingInput: true,
    autosaveState: "saving",
    online: true,
  } as const;

  it("announces the offline pause even while the inline editor is open", () => {
    expect(overviewSaveStatus({ ...base, online: false })).toBe(
      OFFLINE_SAVING_STATUS,
    );
  });

  it("keeps the unsaved-editor copy online and for other autosave states", () => {
    const unsaved = "Unsaved update — save or cancel the open edit";
    expect(overviewSaveStatus(base)).toBe(unsaved);
    expect(
      overviewSaveStatus({ ...base, autosaveState: "error", online: false }),
    ).toBe(unsaved);
  });

  it("falls back to autosave copy without an open editor, and to nothing without a draft", () => {
    expect(overviewSaveStatus({ ...base, pendingInput: false })).toBe(
      "Saving draft",
    );
    expect(
      overviewSaveStatus({ ...base, pendingInput: false, autosaveState: null }),
    ).toBeUndefined();
  });

  it("lets a pending plan outcome win", () => {
    expect(
      overviewSaveStatus({ ...base, outcomePending: true, online: false }),
    ).toBe("Saving plan outcome…");
  });
});
