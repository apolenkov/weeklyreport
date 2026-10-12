import assert from "node:assert/strict";
import test, { mock } from "node:test";

import type { BrowserSnapshot } from "../lead-form/browser.js";

const commands: string[][] = [];
let snapshots: BrowserSnapshot[] = [];
let failWait: Error | null = null;

const command = mock.fn((args: readonly string[]) => {
  commands.push([...args]);
  if (args[0] === "wait" && failWait) return Promise.reject(failWait);
  return Promise.resolve({});
});
const snapshot = mock.fn(() => {
  const next = snapshots.shift();
  assert(next, "unexpected extra snapshot");
  return Promise.resolve(next);
});

mock.module("../lead-form/browser.js", {
  exports: {
    command,
    snapshot,
    findRole: () => Promise.resolve({}),
    getAttr: () => Promise.resolve(""),
    refsByRole: () => [],
  },
});
const { waitSnapshot } = await import("../lead-form/helpers.js");

const page = (snapshotText: string): BrowserSnapshot => ({
  snapshot: snapshotText,
  refs: {},
});

void test("waitSnapshot waits on a DOM change between snapshots instead of re-snapshotting", async () => {
  commands.length = 0;
  snapshot.mock.resetCalls();
  snapshots = [page("loading"), page("loading"), page("ready")];
  const observed = await waitSnapshot(
    (data) => data.snapshot === "ready",
    "ready page",
  );
  assert.equal(observed.snapshot, "ready");
  assert.deepEqual(
    commands.map(([name]) => name),
    ["eval", "wait", "eval", "wait", "eval"],
  );
  assert.equal(snapshot.mock.callCount(), 3);
  assert.equal(commands[1]?.[1], "--fn");
});

void test("waitSnapshot treats a failed or timed-out wait as a reason to re-observe", async () => {
  commands.length = 0;
  failWait = new Error("Wait timed out");
  snapshots = [page("loading"), page("ready")];
  const observed = await waitSnapshot(
    (data) => data.snapshot === "ready",
    "ready page",
  );
  failWait = null;
  assert.equal(observed.snapshot, "ready");
});

void test("waitSnapshot propagates AbortError from the wait", async () => {
  commands.length = 0;
  failWait = Object.assign(new Error("aborted"), { name: "AbortError" });
  snapshots = [page("loading")];
  await assert.rejects(
    waitSnapshot(() => false, "never"),
    { name: "AbortError" },
  );
  failWait = null;
});
