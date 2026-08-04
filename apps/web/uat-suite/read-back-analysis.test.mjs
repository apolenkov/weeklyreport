import assert from "node:assert/strict";
import test from "node:test";

import { navigationKind } from "./read-back-analysis.mjs";

test("accepts global location navigation", () => {
  assert.equal(
    navigationKind(["location", "href"], "global", true),
    "location.href",
  );
  assert.equal(
    navigationKind(["window", "location", "replace"], "global", false),
    "location.replace",
  );
});

test("accepts refresh only from a resolved Next router", () => {
  assert.equal(
    navigationKind(["router", "refresh"], "next-router", false),
    "router.refresh",
  );
  assert.equal(navigationKind(["router", "refresh"], "local", false), null);
});

test("rejects suffix lookalikes and shadowed globals", () => {
  assert.equal(
    navigationKind(["draft", "location", "href"], "global", true),
    null,
  );
  assert.equal(navigationKind(["location", "href"], "local", true), null);
});
