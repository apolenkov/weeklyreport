import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { resolveOpenSpecProvenance } from "./openspec-provenance-resolver.ts";

const fixture = (): string => {
  const root = mkdtempSync(path.join(tmpdir(), "openspec-provenance-"));
  const writeSpec = (relative: string, content: string): void => {
    const file = path.join(root, relative, "spec.md");
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  };
  mkdirSync(path.join(root, "openspec", "changes"), { recursive: true });
  writeSpec(
    "openspec/specs/stable-capability",
    "### Requirement: Stable marker\nDecision ALPHA-17 is durable.",
  );
  writeSpec(
    "openspec/specs/live-capability",
    "### Requirement: Live delta\nDecision SHARED-9 remains active.",
  );
  writeSpec(
    "openspec/specs/second-capability",
    "### Requirement: Second marker\nDecision SHARED-9 is also named here.",
  );
  writeSpec(
    "openspec/changes/archive/old-change/specs/archived-capability",
    "Decision ARCHIVED-1 is not live provenance.",
  );
  return root;
};

void test("resolves one live capability directly from the tree", () => {
  const result = resolveOpenSpecProvenance("stable-capability", fixture());
  assert.equal(result.status, "resolved");
  assert.equal(result.candidate.capability, "stable-capability");
});

void test("returns unresolved when only an archived spec contains the marker", () => {
  assert.deepEqual(resolveOpenSpecProvenance("ARCHIVED-1", fixture()), {
    status: "unresolved",
    reference: "ARCHIVED-1",
  });
});

void test("does not resolve a deleted active-change path from incidental text", () => {
  assert.deepEqual(
    resolveOpenSpecProvenance("openspec/changes/deleted-change", fixture()),
    {
      status: "unresolved",
      reference: "openspec/changes/deleted-change",
    },
  );
});

void test("returns every candidate when a marker is ambiguous", () => {
  const result = resolveOpenSpecProvenance("SHARED-9", fixture());
  assert.equal(result.status, "ambiguous");
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.capability),
    ["live-capability", "second-capability"],
  );
});

void test("fails closed when a durable capability has no readable spec", () => {
  const root = fixture();
  rmSync(path.join(root, "openspec", "specs", "stable-capability", "spec.md"));
  assert.throws(
    () => resolveOpenSpecProvenance("stable-capability", root),
    /ENOENT/,
  );
});
