import assert from "node:assert/strict";
import test from "node:test";

import { Prisma } from "@prisma/client";
import {
  draftSaveSchema,
  MAX_RECORDS_PER_SECTION_SAVE,
} from "@weeklyreport/shared";

import { ACTIVITY_ID, buildSectionItemLimitData } from "./overlay-items.js";
import { parseE2eScenario } from "./reset.js";

const SECTION_ID = "a0000000-0000-4000-8000-000000000401";

void test("scenario profiles reject unknown and mismatched preparation before effects", () => {
  assert.equal(parseE2eScenario("demo", undefined), undefined);
  assert.equal(parseE2eScenario("minimal", undefined), undefined);
  assert.equal(
    parseE2eScenario("demo", "section-item-limit"),
    "section-item-limit",
  );
  assert.equal(
    parseE2eScenario("minimal", "archived-fill-only"),
    "archived-fill-only",
  );
  assert.throws(
    () => parseE2eScenario("minimal", "section-item-limit"),
    /requires the demo seed/u,
  );
  assert.throws(
    () => parseE2eScenario("demo", "archived-fill-only"),
    /requires the minimal seed/u,
  );
  for (const scenario of ["unknown", "", null, false]) {
    assert.throws(
      () => parseE2eScenario("demo", scenario),
      /Unknown E2E scenario/u,
    );
  }
});

void test("section item-limit fillers reach the canonical cap with valid own Activity work", () => {
  const existingCount = 7;
  const items = buildSectionItemLimitData(SECTION_ID, existingCount);
  assert.equal(items.length + existingCount, MAX_RECORDS_PER_SECTION_SAVE);
  assert.equal(
    new Set(items.map(({ stableId }) => stableId)).size,
    items.length,
  );
  const validated = draftSaveSchema.parse({
    reportSectionId: SECTION_ID,
    version: 1,
    projectStatuses: [],
    items,
    risks: [],
    decisions: [],
  });
  for (const [index, item] of items.entries()) {
    const parsed = validated.items[index];
    assert(parsed);
    assert.equal(item.reportSectionId, SECTION_ID);
    assert.equal(parsed.activityId, ACTIVITY_ID);
    assert.equal(parsed.projectId, null);
    assert.equal(parsed.type, "current");
    assert.equal(parsed.workflowStatus, "in_progress");
    assert.deepEqual(parsed.stageNames, []);
    assert.equal(item.priorityRank, null);
    assert.equal(item.resolution, Prisma.DbNull);
    assert.equal(item.pausedReason, null);
    assert.equal(item.nextStepText, null);
  }
  assert.equal(
    buildSectionItemLimitData(SECTION_ID, 0).length,
    MAX_RECORDS_PER_SECTION_SAVE,
  );
  assert.deepEqual(
    buildSectionItemLimitData(SECTION_ID, MAX_RECORDS_PER_SECTION_SAVE),
    [],
  );
});

void test("section item-limit preparation rejects invalid baseline counts", () => {
  for (const count of [-1, 0.5, Number.NaN, MAX_RECORDS_PER_SECTION_SAVE + 1]) {
    assert.throws(
      () => buildSectionItemLimitData(SECTION_ID, count),
      /baseline item count/u,
    );
  }
});
