import assert from "node:assert/strict";
import test from "node:test";

import { parseMutationAllowlist } from "./mutation-allowlist.mjs";

test("accepts a reviewed procedure justification", () => {
  assert.deepEqual(
    parseMutationAllowlist(
      JSON.stringify({
        "admin.retiredMutation":
          "The compatibility endpoint always rejects and intentionally has no UI consumer.",
      }),
    ),
    {
      "admin.retiredMutation":
        "The compatibility endpoint always rejects and intentionally has no UI consumer.",
    },
  );
});

test("rejects generated placeholder justifications", () => {
  assert.throws(
    () =>
      parseMutationAllowlist(
        JSON.stringify({
          "admin.missing": "TODO: justify or wire a consumer",
        }),
      ),
    /Invalid mutation allowlist justification/,
  );
});

test("rejects malformed procedure paths", () => {
  assert.throws(
    () =>
      parseMutationAllowlist(
        JSON.stringify({
          missing: "This reason is long enough but the key has no namespace.",
        }),
      ),
    /Invalid mutation allowlist procedure/,
  );
});
