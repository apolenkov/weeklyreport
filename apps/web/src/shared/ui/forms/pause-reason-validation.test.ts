import {
  draftSaveSchema,
  INVISIBLE_TEXT_MESSAGE,
  NULL_BYTES_MESSAGE,
  SAFE_TEXT_MAX_LENGTH,
  safeText,
} from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import {
  getPauseReasonError,
  PAUSE_REASON_REQUIRED_MESSAGE,
} from "./pause-reason-validation";

const PAUSED_ITEM_BASE = {
  projectId: "11111111-1111-4111-8111-111111111111",
  type: "current" as const,
  text: "Ship feature X",
  tag: "feature",
  workflowStatus: "paused" as const,
  carriedOver: false,
  stageNames: ["Development"],
};

// The real autosave contract: one rejected item drops the whole draft save.
const parseDraftWithPausedReason = (pausedReason: string) =>
  draftSaveSchema.safeParse({
    reportSectionId: "22222222-2222-4222-8222-222222222222",
    version: 1,
    projectStatuses: [],
    items: [{ ...PAUSED_ITEM_BASE, pausedReason }],
    risks: [],
    decisions: [],
  });

const LENGTH_MESSAGE = `Pause reason must be ${SAFE_TEXT_MAX_LENGTH} characters or fewer.`;

// The prompt mirrors the server write rule exactly: acceptance, null bytes and
// the length metric must agree, or one prompt value rejects the whole draft.
describe("pause reason parity with the server write schema", () => {
  it.each([
    "blocked upstream",
    "Привет мир",
    "👩\u200D💻 waiting",
    "e\u0301",
    "\u200Bblocked",
    "A".repeat(SAFE_TEXT_MAX_LENGTH),
    "😀".repeat(SAFE_TEXT_MAX_LENGTH),
    "漢".repeat(SAFE_TEXT_MAX_LENGTH),
  ])("accepts %j on both sides", (reason) => {
    expect(getPauseReasonError(reason)).toBeUndefined();
    expect(parseDraftWithPausedReason(reason).success).toBe(true);
  });

  it.each([
    ["", PAUSE_REASON_REQUIRED_MESSAGE],
    [" ".repeat(3), PAUSE_REASON_REQUIRED_MESSAGE],
    // U+FEFF is ECMAScript whitespace: trimming leaves nothing to persist.
    ["\uFEFF", PAUSE_REASON_REQUIRED_MESSAGE],
    ["\u200B\u200B", INVISIBLE_TEXT_MESSAGE],
    ["blocked\u0000upstream", NULL_BYTES_MESSAGE],
    ["A".repeat(SAFE_TEXT_MAX_LENGTH + 1), LENGTH_MESSAGE],
    ["😀".repeat(SAFE_TEXT_MAX_LENGTH + 1), LENGTH_MESSAGE],
  ])("rejects %j on both sides", (reason, message) => {
    expect(getPauseReasonError(reason)).toBe(message);
    expect(parseDraftWithPausedReason(reason).success).toBe(false);
  });

  it("matches the server's safeText predicate for the trimmed value", () => {
    const samples = [
      "",
      " ",
      "blocked upstream",
      "\u200B",
      "\u0000",
      "😀".repeat(SAFE_TEXT_MAX_LENGTH),
      "😀".repeat(SAFE_TEXT_MAX_LENGTH + 1),
    ];
    for (const value of samples) {
      expect(getPauseReasonError(value) === undefined).toBe(
        safeText().safeParse(value.trim()).success,
      );
    }
  });
});
