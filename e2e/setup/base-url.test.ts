import assert from "node:assert/strict";
import test from "node:test";

import { parseE2eBaseUrl } from "./base-url.js";

void test("defaults to the local source run", () => {
  assert.equal(parseE2eBaseUrl(""), "http://localhost:3000");
});

void test("accepts a stand origin", () => {
  assert.equal(
    parseE2eBaseUrl("http://localhost:8080"),
    "http://localhost:8080",
  );
});

void test("rejects paths, other schemes and garbage", () => {
  for (const bad of ["http://localhost:8080/app", "ftp://x", "nope"]) {
    assert.throws(() => parseE2eBaseUrl(bad), /E2E_BASE_URL/);
  }
});
