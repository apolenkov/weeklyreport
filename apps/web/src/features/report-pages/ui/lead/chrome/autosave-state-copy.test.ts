import { describe, expect, it } from "vitest";

import {
  autosaveStatusCopy,
  OFFLINE_SAVING_STATUS,
} from "./autosave-state-copy";

describe("autosaveStatusCopy", () => {
  it("explains a save paused by the browser going offline", () => {
    expect(autosaveStatusCopy("saving", false)).toBe(OFFLINE_SAVING_STATUS);
  });

  it("keeps the normal copy online, and for states that are not saving", () => {
    expect(autosaveStatusCopy("saving")).toBe("Saving draft");
    expect(autosaveStatusCopy("error", false)).toBe("Draft save failed");
  });
});
