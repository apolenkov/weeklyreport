import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { test } from "vitest";

const sqlText = readFileSync(
  new URL("../../../deploy/local-prod/provision-users.sql", import.meta.url),
  "utf8",
);

const executableLines = sqlText
  .split(/\r?\n/u)
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("--"));

const indexOfLine = (pattern: RegExp): number =>
  executableLines.findIndex((line) => pattern.test(line));

test.each([
  ["first", executableLines[0], "BEGIN;"],
  ["last", executableLines.at(-1), "COMMIT;"],
] as const)(
  "local stand psql stdin keeps %s transaction boundary",
  (_name, actual, expected) => {
    assert.equal(actual, expected);
  },
);

test("local stand locks the fixture tables before reading their identities", () => {
  const lockIndex = indexOfLine(
    /^LOCK TABLE "ReportingGroup", "User" IN SHARE ROW EXCLUSIVE MODE NOWAIT;$/u,
  );
  const guardIndex = indexOfLine(/^RAISE EXCEPTION /u);
  assert.ok(lockIndex >= 0, "lock statement is missing");
  assert.ok(lockIndex < guardIndex, "guard reads before the tables are locked");
});

test("local stand refuses a non-fixture dataset before any write", () => {
  const guardIndex = indexOfLine(/^RAISE EXCEPTION /u);
  const firstWriteIndex = executableLines.findIndex((line) =>
    /^(INSERT INTO|UPDATE) /u.test(line),
  );
  assert.ok(guardIndex >= 0, "dataset guard is missing");
  assert.ok(guardIndex < firstWriteIndex, "a write precedes the dataset guard");
});

test("local stand guard admits only the four fixture e-mail and samlId pairs", () => {
  for (const email of [
    "lead1@weeklyreport.local",
    "head@weeklyreport.local",
    "viewer@weeklyreport.local",
    "admin@weeklyreport.local",
  ]) {
    assert.ok(
      sqlText.includes(`('${email}', '${email}')`),
      `fixture pair for ${email} is missing from the guard`,
    );
  }
  assert.match(
    sqlText,
    /WHERE id <> '00000000-0000-4000-8000-0000000000a1'/u,
    "guard must refuse any reporting group other than the fixture group",
  );
});
