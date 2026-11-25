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
