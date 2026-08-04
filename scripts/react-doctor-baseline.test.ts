import assert from "node:assert/strict";
import test from "node:test";

import type { ReactDoctorBaselineEntry } from "./react-doctor-baseline.ts";
import {
  compareReactDoctorBaseline,
  reactDoctorBaselineIsCurrent,
} from "./react-doctor-baseline.ts";

const accepted: ReactDoctorBaselineEntry = {
  id: "src/example.tsx::1:1::react-doctor/example::digest",
  file: "src/example.tsx",
  rule: "example",
  verdict: "overturn",
  rationale: "The repository contract makes this diagnostic inapplicable.",
};

void test("accepts an exact terminal baseline", () => {
  const diff = compareReactDoctorBaseline([accepted], [accepted]);
  assert.equal(reactDoctorBaselineIsCurrent(diff), true);
});

void test("rejects added, removed, duplicate, drifted, and unjustified entries", () => {
  const invalid = { ...accepted, rationale: "" };
  const changed = { ...accepted, file: "src/changed.tsx" };
  const added = {
    id: "src/new.tsx::1:1::react-doctor/new::digest",
    file: "src/new.tsx",
    rule: "new",
  };
  const diff = compareReactDoctorBaseline(
    [invalid, invalid, { ...accepted, id: "removed" }],
    [changed, changed, added],
  );

  assert.deepEqual(diff.duplicateBaselineIds, [accepted.id]);
  assert.deepEqual(diff.duplicateCurrentIds, [accepted.id]);
  assert.deepEqual(diff.added, [added]);
  assert.deepEqual(
    diff.removed.map(({ id }) => id),
    ["removed"],
  );
  assert.deepEqual(diff.metadataDrift, [changed, changed]);
  assert.equal(diff.invalidEntries.length, 2);
  assert.equal(reactDoctorBaselineIsCurrent(diff), false);
});
