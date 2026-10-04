import assert from "node:assert/strict";
import test from "node:test";

import { keyEvents } from "../lead-form/press.js";

void test("key events never carry a native virtual key code", () => {
  for (const spec of ["Escape", "ArrowDown", "Control+Enter", "f", "Space"]) {
    for (const event of keyEvents(spec)) {
      assert.equal("nativeVirtualKeyCode" in event, false, spec);
    }
  }
});

void test("character keys type text and chords stay raw", () => {
  const [typed] = keyEvents("f");
  assert.deepEqual(
    { type: typed.type, text: typed.text, modifiers: typed.modifiers },
    { type: "keyDown", text: "f", modifiers: 0 },
  );
  const [chord, release] = keyEvents("Control+Enter");
  assert.deepEqual(
    { type: chord.type, text: chord.text, modifiers: chord.modifiers },
    { type: "rawKeyDown", text: undefined, modifiers: 2 },
  );
  assert.equal(release.type, "keyUp");
});

void test("digits type their text", () => {
  const [typed] = keyEvents("7");
  assert.deepEqual(
    { code: typed.code, vk: typed.windowsVirtualKeyCode, text: typed.text },
    { code: "Digit7", vk: 55, text: "7" },
  );
});

void test("editing keys carry commands and Shift extends the selection", () => {
  assert.deepEqual(keyEvents("Backspace")[0].commands, ["deleteBackward"]);
  assert.deepEqual(keyEvents("Shift+Home")[0].commands, [
    "moveToBeginningOfLineAndModifySelection",
  ]);
});

void test("unsupported keys and modifiers are rejected", () => {
  assert.throws(() => keyEvents("F13"), /Unsupported E2E key/u);
  assert.throws(() => keyEvents("Hyper+a"), /Unsupported E2E key modifier/u);
});
