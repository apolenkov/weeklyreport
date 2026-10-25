import {
  INVISIBLE_TEXT_MESSAGE,
  NULL_BYTES_MESSAGE,
  SAFE_TEXT_MAX_LENGTH,
} from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import {
  buildActivityItemSave,
  buildProductItemSave,
  collectItemErrors,
  collectItemStatusErrors,
  resolveInitialItem,
} from "./item-edit-dialog-helpers";

describe("item description contract", () => {
  const validate = (trimmed: string) =>
    collectItemErrors({
      trimmed,
      isActivityParent: true,
      availableStages: [],
      effectiveStageNames: [],
    });

  it("accepts the minimum and maximum server-supported text", () => {
    expect(validate("X")).toEqual({});
    expect(validate("X".repeat(500))).toEqual({});
  });

  it("keeps invalid descriptions in the editor before mutating the draft", () => {
    expect(validate("").text).toBe("Description is required");
    expect(validate("X".repeat(501)).text).toBe(
      "Description must be 500 characters or fewer.",
    );
    expect(validate("\u200B").text).toBeDefined();
    expect(validate("text\u0000").text).toBeDefined();
  });
});

describe("item author resolution", () => {
  it("uses the real user name when present", () => {
    const item = resolveInitialItem({
      item: null,
      week: "current",
      seedProduct: undefined,
      currentUserName: "Alex Lead",
    });
    expect(item.author).toBe("Alex Lead");
  });

  it("never fabricates a synthetic author when the user name is absent", () => {
    const initial = resolveInitialItem({
      item: null,
      week: "current",
      seedProduct: undefined,
      currentUserName: undefined,
    });
    expect(initial.author).toBe("");

    const activitySave = buildActivityItemSave({
      item: null,
      trimmed: "work",
      status: "in-progress",
      currentUserName: undefined,
      priorityRank: null,
      trimmedPausedReason: "",
      trimmedNextStepText: "",
      selectedActivity: undefined,
      initial,
      activityId: "act-1",
    });
    expect(activitySave.author).toBe("");

    const productSave = buildProductItemSave({
      item: null,
      trimmed: "work",
      status: "in-progress",
      currentUserName: undefined,
      priorityRank: null,
      trimmedPausedReason: "",
      trimmedNextStepText: "",
      product: { id: "p1", name: "Portal" },
      effectiveStageNames: [],
    });
    expect(productSave.author).toBe("");
  });
});

// The server's safeText refuses invisible-only text and null bytes, so the
// editor refuses them before the draft autosave instead of rewriting the value.
describe("item status text follows the server safeText rule", () => {
  it("requires a non-blank pause reason", () => {
    expect(
      collectItemStatusErrors({
        status: "paused",
        trimmedNextStepText: "",
        trimmedPausedReason: "",
      }).pausedReason,
    ).toBe("A reason is required to pause an item.");
  });

  it("rejects an invisible-only pause reason with the shared visible-content message", () => {
    expect(
      collectItemStatusErrors({
        status: "paused",
        trimmedNextStepText: "",
        trimmedPausedReason: "\u200B",
      }).pausedReason,
    ).toBe(INVISIBLE_TEXT_MESSAGE);
  });

  it("rejects a pause reason containing a null byte", () => {
    expect(
      collectItemStatusErrors({
        status: "paused",
        trimmedNextStepText: "",
        trimmedPausedReason: "blocked\u0000upstream",
      }).pausedReason,
    ).toBe(NULL_BYTES_MESSAGE);
  });

  it("measures the pause reason in code points like the server schema", () => {
    expect(
      collectItemStatusErrors({
        status: "paused",
        trimmedNextStepText: "",
        trimmedPausedReason: "😀".repeat(SAFE_TEXT_MAX_LENGTH),
      }),
    ).toEqual({});
    expect(
      collectItemStatusErrors({
        status: "paused",
        trimmedNextStepText: "",
        trimmedPausedReason: "😀".repeat(SAFE_TEXT_MAX_LENGTH + 1),
      }).pausedReason,
    ).toBe(`Pause reason must be ${SAFE_TEXT_MAX_LENGTH} characters or fewer.`);
  });

  it("refuses an invisible-only next step instead of dropping it", () => {
    expect(
      collectItemStatusErrors({
        status: "in-progress",
        trimmedNextStepText: "\u200B",
        trimmedPausedReason: "",
      }).nextStepText,
    ).toBe("Text must contain visible characters");
    expect(
      collectItemStatusErrors({
        status: "in-progress",
        trimmedNextStepText: "",
        trimmedPausedReason: "",
      }),
    ).toEqual({});
  });
});
