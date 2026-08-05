import { expect, test } from "@playwright/test";

import { seedProfileSchema } from "./contracts.ts";
import { runOpenCodeDrives } from "./run-opencode-drives.ts";

test("OpenCode Flash drives the current-source runtime server sequentially", async ({}, testInfo) => {
  test.setTimeout(0);
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string" || baseURL.trim() === "")
    throw new Error("OpenCode Driver requires the Playwright project baseURL");
  expect(baseURL).toMatch(
    /^https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/u,
  );
  const profile = seedProfileSchema.parse(process.env.RUNTIME_SWEEP_PROFILE);
  await runOpenCodeDrives({ baseURL, profile });
});
