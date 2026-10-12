import assert from "node:assert/strict";
import { mock, test } from "node:test";

const calls: string[] = [];
let execute: (args: readonly string[]) => Promise<Record<string, unknown>>;
mock.module(new URL("../lead-form/browser.ts", import.meta.url).href, {
  exports: {
    command: async (args: readonly string[]) => {
      calls.push(args[0] ?? "");
      return execute(args);
    },
  },
});
const { assertFocused } = await import("../lead-form/focus.js");

for (const mode of [
  "reject",
  "serialize",
  "diagnostic",
  "abort",
  "non-error",
  "success",
] as const) {
  void test(mode, async () => {
    calls.length = 0;
    const original = new Error("original focus timeout");
    if (mode === "abort") original.name = "AbortError";
    const failure: unknown =
      mode === "non-error" ? "original non-error" : original;
    execute = async (args) => {
      await Promise.resolve();
      if (args[0] === "wait") {
        if (mode !== "success") throw failure;
        return {};
      }
      if (mode === "reject") throw new Error("secondary diagnostic failure");
      if (mode === "serialize") return { result: 1n };
      return {
        result:
          mode === "success" ? "Inspect" : { marker: "diagnostic available" },
      };
    };
    let caught: unknown;
    try {
      await assertFocused("Inspect", "fixture-session");
    } catch (error) {
      caught = error;
    }
    // Sanity proves the canonical physical module mock drove the real helper;
    // a loader failure is not a product RED.
    assert.deepEqual(
      calls,
      mode === "abort" || mode === "non-error" ? ["wait"] : ["wait", "eval"],
    );
    if (mode === "success") assert.equal(caught, undefined);
    else assert.equal(caught, failure);
    if (mode === "diagnostic")
      assert.match(original.message, /diagnostic available/u);
    if (mode === "reject" || mode === "serialize")
      assert.equal(original.message, "original focus timeout");
  });
}
