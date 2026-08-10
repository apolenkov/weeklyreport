import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateCheckScripts,
  type DiscoveryInput,
  packageTestReferences,
  validateRepositoryTestOwnership,
} from "./discovery.ts";

const BASE: DiscoveryInput = {
  currentPaths: [
    "scripts/owned.test.ts",
    "scripts/gates/repository-tests/discovery.test.ts",
  ],
  manifest: [
    {
      path: "scripts/gates/repository-tests/discovery.test.ts",
      owner: "discovery",
    },
  ],
  packageTestReferences: [
    { path: "scripts/owned.test.ts", script: "lint:owned" },
  ],
  aggregateScripts: ["lint:owned"],
};

void test("accepts one manifest owner and one package owner per test", () => {
  assert.equal(validateRepositoryTestOwnership(BASE).currentCount, 2);
  assert.equal(
    packageTestReferences({
      "lint:owned": "node --test scripts/owned.test.ts",
    })[0]?.path,
    "scripts/owned.test.ts",
  );
  assert.deepEqual(
    aggregateCheckScripts('{ script: "lint:owned", what: "probe" }'),
    ["lint:owned"],
  );
});

void test("rejects a current test with no owner", () => {
  assert.throws(
    () =>
      validateRepositoryTestOwnership({
        ...BASE,
        currentPaths: [...BASE.currentPaths, "scripts/missing-owner.test.ts"],
      }),
    /missing repository-test owner: scripts\/missing-owner\.test\.ts/,
  );
});

void test("rejects duplicate manifest ownership", () => {
  const duplicate = BASE.manifest[0];
  assert.ok(duplicate);
  assert.throws(
    () =>
      validateRepositoryTestOwnership({
        ...BASE,
        manifest: [...BASE.manifest, duplicate],
      }),
    /duplicate repository-test manifest owner: scripts\/gates\/repository-tests\/discovery\.test\.ts/,
  );
});

void test("rejects stale manifest ownership", () => {
  assert.throws(
    () =>
      validateRepositoryTestOwnership({
        ...BASE,
        manifest: [
          ...BASE.manifest,
          { path: "scripts/removed.test.ts", owner: "stale" },
        ],
      }),
    /stale repository-test manifest entry: scripts\/removed\.test\.ts/,
  );
});

void test("rejects a package script that the aggregate gate never runs", () => {
  assert.throws(
    () =>
      validateRepositoryTestOwnership({
        ...BASE,
        aggregateScripts: [],
      }),
    /missing repository-test owner: scripts\/owned\.test\.ts/,
  );
});

void test("rejects overlapping manifest and aggregate package ownership", () => {
  assert.throws(
    () =>
      validateRepositoryTestOwnership({
        ...BASE,
        manifest: [
          ...BASE.manifest,
          { path: "scripts/owned.test.ts", owner: "duplicate" },
        ],
      }),
    /duplicate repository-test owners: scripts\/owned\.test\.ts/,
  );
});
