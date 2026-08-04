import path from "node:path";

import { expect, test } from "vitest";

import {
  checklistReportDirectory,
  requireCatalog,
} from "./render-checklist.ts";

test("rejects a catalog with no role or routes", () => {
  expect(() => requireCatalog("# empty", "viewer.yaml")).toThrow(
    /Invalid catalog viewer.yaml/,
  );
});

test("writes checklists under the external archive by default", () => {
  expect(checklistReportDirectory(undefined, "/Users/tester")).toBe(
    path.join("/Users/tester", "work", "customreport-archive", "manual-uat"),
  );
});

test("honours an explicit archive root", () => {
  expect(
    checklistReportDirectory("/Users/tester/audit-output", "/ignored"),
  ).toBe(path.join("/Users/tester/audit-output", "manual-uat"));
});
