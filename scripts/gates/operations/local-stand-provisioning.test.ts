import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { test } from "vitest";

const executableLines = readFileSync(
  new URL("../../../deploy/local-prod/provision-users.sql", import.meta.url),
  "utf8",
)
  .split(/\r?\n/u)
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("--"));

test.each([
  ["first", executableLines[0], "BEGIN;"],
  ["last", executableLines.at(-1), "COMMIT;"],
] as const)(
  "local stand psql stdin keeps %s transaction boundary",
  (_name, actual, expected) => {
    assert.equal(actual, expected);
  },
);
