import { describe, expect, it } from "vitest";

import { undoRefusal } from "./overview-undo";
const clear = { saving: false, editing: false, reply: false, changed: false };
describe.each(["record", "next step", "risk", "decision"])(
  "Undo after deleting a %s",
  () => {
    it.each([
      ["saving", "Still saving. Try Undo in a moment."],
      ["editing", "Can’t undo while a form is open. Save or cancel it first."],
      [
        "reply",
        "Can’t undo while its discussion has an unsent reply. Send or clear it first.",
      ],
      ["changed", "Can’t undo: this work changed after that."],
    ] as const)("refuses %s", (guard, message) =>
      expect(undoRefusal({ ...clear, [guard]: true })).toBe(message),
    );
    it("permits an unchanged confirmed object", () =>
      expect(undoRefusal(clear)).toBeNull());
  },
);

describe("Undo of an answer or move", () => {
  it.each([
    [
      "editing",
      "Can’t undo while this item is being edited. Save or cancel first.",
    ],
    [
      "reply",
      "Can’t undo while a reply is being written in its discussion. Send or clear it first.",
    ],
    ["changed", "Can’t undo: this item changed after that."],
  ] as const)("explains %s without applying the inverse", (guard, message) => {
    expect(
      undoRefusal({
        ...clear,
        [guard]: true,
        ownEditor: guard === "editing",
        deletion: false,
      }),
    ).toBe(message);
  });
  it("checks the return destination before restoring an occurrence", () => {
    expect(undoRefusal({ ...clear, changed: true, occupied: "current" })).toBe(
      "Can’t undo: This week already has this item.",
    );
  });
});
