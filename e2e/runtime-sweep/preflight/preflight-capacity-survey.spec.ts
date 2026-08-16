import { access } from "node:fs/promises";
import * as path from "node:path";

import { expect, test } from "@playwright/test";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime capacity survey requires ${name}`);
  return value;
};

const resultPath = path.resolve(
  requiredEnv("RUNTIME_SWEEP_CAPACITY_SURVEY_RESULT"),
);

test("capacity global setup produced a terminal result candidate", async () => {
  await expect(access(resultPath)).resolves.toBeUndefined();
});
