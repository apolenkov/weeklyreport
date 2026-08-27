import assert from "node:assert/strict";
import test from "node:test";

import { classifyStructuralProbe } from "./exemplary-structure-probe.ts";

const observation = (
  overrides: Partial<Parameters<typeof classifyStructuralProbe>[0]> = {},
): Parameters<typeof classifyStructuralProbe>[0] => ({
  acceptedReports: 0,
  overflowReports: 1,
  unintendedReports: 0,
  configurationErrors: [],
  ...overrides,
});

void test("a caught one-step overflow with a clean boundary is REAL", () => {
  assert.equal(classifyStructuralProbe(observation()), "REAL");
});

void test("an uncaught planted overflow is VACUOUS", () => {
  assert.equal(
    classifyStructuralProbe(observation({ overflowReports: 0 })),
    "VACUOUS",
  );
});

void test("resolver or effective-config failures are CONFIG", () => {
  assert.equal(
    classifyStructuralProbe(
      observation({ configurationErrors: ["resolver failed"] }),
    ),
    "CONFIG",
  );
});

void test("a rejected boundary or cross-rule report is NOISE", () => {
  assert.equal(
    classifyStructuralProbe(observation({ acceptedReports: 1 })),
    "NOISE",
  );
  assert.equal(
    classifyStructuralProbe(observation({ unintendedReports: 1 })),
    "NOISE",
  );
});
