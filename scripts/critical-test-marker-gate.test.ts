import assert from "node:assert/strict";
import test from "node:test";

import { findCriticalTestMarkers } from "./critical-test-marker-gate.ts";

const scenario = (name: string, body: () => void) => void test(name, body);
const reasons = (source: string) =>
  findCriticalTestMarkers(source, "fixture.test.ts").map(
    (marker) => marker.reason,
  );

scenario("accepts an unconditional executable test", () => {
  assert.deepEqual(
    reasons('test("works", async () => expect(1).toBe(1));'),
    [],
  );
});

scenario("rejects todo, skip, fixme, and focused markers", () => {
  for (const source of [
    'test.todo("later");',
    'it.skip("later", () => {});',
    'test.fixme("later", () => {});',
    'describe.only("focused", () => {});',
    'test.skipIf(process.platform === "win32")("later", () => {});',
    'it.runIf(Boolean(process.env.RUN))("conditional", () => {});',
    'fit("focused", () => {});',
    'xdescribe("disabled", () => {});',
  ]) {
    assert.ok(
      reasons(source).some(
        (reason) =>
          reason.startsWith("focused or disabled test function") ||
          reason.startsWith("advisory test marker"),
      ),
      source,
    );
  }
});

scenario("rejects a critical file with no direct executable test", () => {
  assert.deepEqual(reasons("export const helper = () => true;"), [
    "file has no directly registered executable tests",
  ]);
});

scenario("inspects parameterized test callbacks", () => {
  assert.deepEqual(
    reasons(
      'it.each([1, 2])("x %s", (value) => { if (value === 1) return; expect(value).toBe(2); });',
    ),
    ["test callback has a conditional early return"],
  );
});

scenario("rejects returns inside conditional control-flow forms", () => {
  for (const source of [
    'test("x", () => { switch (mode) { case "off": return; } expect(1).toBe(1); });',
    'test("x", () => { for (const item of values) { if (!item) return; } expect(1).toBe(1); });',
    'test("x", () => { try { expect(1).toBe(1); } catch { return; } });',
  ]) {
    assert.deepEqual(reasons(source), [
      "test callback has a conditional early return",
    ]);
  }
});

scenario("rejects conditional registration and early-return bypasses", () => {
  assert.deepEqual(reasons('if (enabled) test("x", () => {});'), [
    "test registration is conditional",
  ]);
  assert.deepEqual(
    reasons('test("x", () => { if (!enabled) return; expect(1).toBe(1); });'),
    ["test callback has a conditional early return"],
  );
});

scenario("ignores returns inside helpers nested in a test", () => {
  assert.deepEqual(
    reasons(
      'test("x", () => { const helper = () => { if (!enabled) return; }; helper(); });',
    ),
    [],
  );
});
